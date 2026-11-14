import type * as Notifications from 'expo-notifications';
import { palette } from '../theme/colors';
import type { PushPermission } from './pushCore';
import { responseData } from './pushCore';
import {
  REMINDER_CHANNEL_DESCRIPTION,
  REMINDER_CHANNEL_ID,
  REMINDER_CHANNEL_NAME,
  diffReminders,
  isReminderId,
  reminderIdsOf,
  type PlannedReminder,
  type ReminderDiff,
  type ScheduledReminder,
} from './reminderPlan';

/**
 * Núcleo do lembrete local (sem React Native importado aqui): embrulha o expo-notifications para agendar, conferir e
 * cancelar os lembretes de dose do paciente. Testável no Node com um módulo falso.
 *
 * Diferente do push (pushCore), o lembrete local funciona também no Expo Go e no modo demo: só depende do Android.
 * Nada aqui lança erro: uma falha do módulo nativo vira o valor neutro (o app nunca cai por causa do lembrete).
 */
export type ReminderNotificationsModule = Pick<
  typeof Notifications,
  | 'setNotificationChannelAsync'
  | 'getAllScheduledNotificationsAsync'
  | 'scheduleNotificationAsync'
  | 'cancelScheduledNotificationAsync'
  | 'dismissNotificationAsync'
  | 'getPresentedNotificationsAsync'
  | 'getPermissionsAsync'
  | 'requestPermissionsAsync'
  | 'addNotificationResponseReceivedListener'
  | 'getLastNotificationResponseAsync'
  | 'clearLastNotificationResponse'
  | 'setNotificationHandler'
  | 'AndroidImportance'
  | 'AndroidNotificationVisibility'
  | 'AndroidAudioUsage'
  | 'AndroidAudioContentType'
  | 'AndroidNotificationPriority'
  | 'SchedulableTriggerInputTypes'
>;

/** Vibração forte e longa: três pulsos de 0,6 s (idosos podem não ouvir o som). */
export const REMINDER_VIBRATION = [0, 600, 300, 600, 300, 600];

export interface ReminderSyncResult {
  scheduled: number;
  cancelled: number;
  kept: number;
}

export interface ReminderScheduler {
  /** Lembrete local existe neste aparelho (Android; também no Expo Go e no demo). */
  readonly supported: boolean;
  /** Cria (ou mantém) o canal "Lembrete de remédio". O canal de avisos do cuidador não é tocado. */
  ensureChannel(): Promise<void>;
  /** Lembretes de dose agendados agora (só os deste app: dose-{id}-N). */
  listScheduled(): Promise<ScheduledReminder[]>;
  /** Aplica o planejado: cancela o que não vale mais e agenda o que falta ou mudou. Idempotente. */
  sync(
    planned: readonly PlannedReminder[],
    options: { complete: boolean; seenDoseIds?: ReadonlySet<string>; force?: boolean },
  ): Promise<ReminderSyncResult>;
  /** Dose confirmada: cancela os dois lembretes e tira da tela os que já apareceram. */
  cancelDose(doseId: string): Promise<void>;
  /** Saída da conta, desconexão ou troca de perfil: cancela e tira da tela todos os lembretes de dose. */
  cancelAll(): Promise<void>;
  /** Um lembrete com este identificador está na tela (para o reforço do servidor não repetir o mesmo aviso). */
  isPresented(id: string): Promise<boolean>;
  getPermission(): Promise<PushPermission>;
  canAskAgain(): Promise<boolean>;
  requestPermission(): Promise<PushPermission>;
  /** Toque num lembrete (só usado onde o push não existe; com o push, quem ouve é o pushSession). */
  onOpen(listener: (data: Record<string, unknown>) => void): () => void;
  getLaunchData(): Promise<Record<string, unknown> | null>;
  /** Mostra o lembrete com o app aberto (só onde o push não existe e não registrou o seu handler). */
  showInForeground(decide: (data: Record<string, unknown>) => boolean): void;
}

const noop = () => undefined;

const INERT: ReminderScheduler = {
  supported: false,
  ensureChannel: async () => undefined,
  listScheduled: async () => [],
  sync: async () => ({ scheduled: 0, cancelled: 0, kept: 0 }),
  cancelDose: async () => undefined,
  cancelAll: async () => undefined,
  isPresented: async () => false,
  getPermission: async () => 'unavailable',
  canAskAgain: async () => false,
  requestPermission: async () => 'unavailable',
  onOpen: () => noop,
  getLaunchData: async () => null,
  showInForeground: noop,
};

const toPermission = (status: string | undefined): PushPermission =>
  status === 'granted' || status === 'denied' || status === 'undetermined' ? status : 'unavailable';

/** Identificador e assinatura de um pedido agendado (getAllScheduledNotificationsAsync). */
function toScheduled(request: { identifier?: unknown; content?: { data?: unknown } }): ScheduledReminder | null {
  const id = typeof request.identifier === 'string' ? request.identifier : '';
  if (!isReminderId(id)) return null;
  const data = request.content?.data as Record<string, unknown> | undefined;
  return { id, signature: typeof data?.assinatura === 'string' ? data.assinatura : null };
}

/**
 * @param load carrega o expo-notifications; só é chamado no Android (na web o módulo nem é avaliado)
 */
export function createReminderScheduler(env: { os: string }, load: () => ReminderNotificationsModule): ReminderScheduler {
  if (env.os !== 'android') return INERT;

  let mod: ReminderNotificationsModule | null = null;
  const notifications = (): ReminderNotificationsModule | null => {
    if (mod) return mod;
    try {
      mod = load();
    } catch {
      mod = null;
    }
    return mod;
  };
  const safe = async <T>(fn: (n: ReminderNotificationsModule) => Promise<T>, fallback: T): Promise<T> => {
    const n = notifications();
    if (!n) return fallback;
    try {
      return await fn(n);
    } catch {
      return fallback;
    }
  };
  // Cada cancelamento isolado: um que falha não impede os outros
  const cancel = async (n: ReminderNotificationsModule, ids: readonly string[]) => {
    for (const id of ids) {
      await n.cancelScheduledNotificationAsync(id).catch(noop);
    }
  };
  const dismiss = async (n: ReminderNotificationsModule, ids: readonly string[]) => {
    for (const id of ids) {
      await n.dismissNotificationAsync(id).catch(noop);
    }
  };

  const listScheduled = () =>
    safe(async (n) => {
      const requests = await n.getAllScheduledNotificationsAsync();
      return requests.map(toScheduled).filter((r): r is ScheduledReminder => r !== null);
    }, [] as ScheduledReminder[]);

  async function schedule(n: ReminderNotificationsModule, reminder: PlannedReminder) {
    await n.scheduleNotificationAsync({
      identifier: reminder.id,
      content: {
        title: reminder.title,
        body: reminder.body,
        data: reminder.data,
        sound: 'default',
        vibrate: REMINDER_VIBRATION,
        priority: n.AndroidNotificationPriority.MAX,
        // Sai da tela quando o paciente toca; ao confirmar a dose, o app tira os lembretes dela
        autoDismiss: true,
        sticky: false,
      },
      trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: reminder.triggerAtMs, channelId: REMINDER_CHANNEL_ID },
    });
  }

  return {
    supported: true,

    ensureChannel: () =>
      safe(async (n) => {
        await n.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
          name: REMINDER_CHANNEL_NAME,
          description: REMINDER_CHANNEL_DESCRIPTION,
          importance: n.AndroidImportance.MAX,
          sound: 'default',
          // Toca no volume de alarme, que o idoso costuma deixar alto, e o Android não silencia por "volume de
          // notificação" baixo. Não Perturbe continua valendo (bypassDnd false): só o paciente libera isso
          audioAttributes: {
            usage: n.AndroidAudioUsage.ALARM,
            contentType: n.AndroidAudioContentType.SONIFICATION,
            flags: { enforceAudibility: true, requestHardwareAudioVideoSynchronization: false },
          },
          enableVibrate: true,
          vibrationPattern: REMINDER_VIBRATION,
          enableLights: true,
          lightColor: palette.primary,
          lockscreenVisibility: n.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: false,
          showBadge: false,
        });
      }, undefined),

    listScheduled,

    async sync(planned, options) {
      const n = notifications();
      if (!n) return { scheduled: 0, cancelled: 0, kept: 0 };
      const scheduled = await listScheduled();
      const diff: ReminderDiff = diffReminders(planned, scheduled, options);
      try {
        // O que vai ser reagendado sai antes (mudou de horário ou de remédio, ou o alarme exato acabou de ser liberado)
        const existing = new Set(scheduled.map((s) => s.id));
        await cancel(n, [...diff.toCancel, ...diff.toSchedule.filter((r) => existing.has(r.id)).map((r) => r.id)]);
        let ok = 0;
        for (const reminder of diff.toSchedule) {
          try {
            await schedule(n, reminder);
            ok += 1;
          } catch {
            // Um lembrete que não agendou não impede os outros; a próxima sincronização tenta de novo
          }
        }
        return { scheduled: ok, cancelled: diff.toCancel.length, kept: diff.kept.length };
      } catch {
        return { scheduled: 0, cancelled: 0, kept: diff.kept.length };
      }
    },

    cancelDose: (doseId) =>
      safe(async (n) => {
        const ids = reminderIdsOf(doseId);
        await cancel(n, ids);
        await dismiss(n, ids);
      }, undefined),

    cancelAll: () =>
      safe(async (n) => {
        const scheduled = await listScheduled();
        await cancel(n, scheduled.map((s) => s.id));
        const presented = await n.getPresentedNotificationsAsync().catch(() => []);
        await dismiss(n, presented.map((p) => p.request.identifier).filter(isReminderId));
      }, undefined),

    isPresented: (id) =>
      safe(async (n) => (await n.getPresentedNotificationsAsync()).some((p) => p.request.identifier === id), false),

    getPermission: () => safe(async (n) => toPermission((await n.getPermissionsAsync()).status), 'unavailable'),

    canAskAgain: () => safe(async (n) => (await n.getPermissionsAsync()).canAskAgain !== false, false),

    requestPermission: () => safe(async (n) => toPermission((await n.requestPermissionsAsync()).status), 'unavailable'),

    onOpen(listener) {
      const n = notifications();
      if (!n) return noop;
      try {
        const sub = n.addNotificationResponseReceivedListener((response) => listener(responseData(response)));
        return () => sub.remove();
      } catch {
        return noop;
      }
    },

    getLaunchData: () =>
      safe(async (n) => {
        const response = await n.getLastNotificationResponseAsync();
        if (!response) return null;
        if (typeof n.clearLastNotificationResponse === 'function') n.clearLastNotificationResponse();
        return responseData(response);
      }, null),

    showInForeground(decide) {
      const n = notifications();
      if (!n) return;
      try {
        n.setNotificationHandler({
          handleNotification: async (notification) => {
            const data = (notification?.request?.content?.data ?? {}) as Record<string, unknown>;
            const show = decide(data);
            return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
          },
        });
      } catch {
        // Sem handler, o lembrete com o app aberto só não aparece como banner (o app já mostra a dose)
      }
    },
  };
}
