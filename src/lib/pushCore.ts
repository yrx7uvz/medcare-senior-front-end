import type * as Notifications from 'expo-notifications';

/**
 * Núcleo do push (sem React Native nem módulos nativos importados aqui): decide se o push existe neste aparelho e
 * embrulha o expo-notifications, carregado só quando suportado. Testável no Node com um módulo falso.
 *
 * O push real só existe no app Android de development/produção (FCM). No Expo Go, no iOS, na web e no modo demo tudo
 * aqui é inerte: nenhuma função lança erro, os tokens vêm nulos e os ouvintes não fazem nada.
 */
export type NotificationsModule = Pick<
  typeof Notifications,
  | 'getDevicePushTokenAsync'
  | 'addPushTokenListener'
  | 'setNotificationChannelAsync'
  | 'getPermissionsAsync'
  | 'requestPermissionsAsync'
  | 'addNotificationResponseReceivedListener'
  | 'getLastNotificationResponseAsync'
  | 'clearLastNotificationResponse'
  | 'setNotificationHandler'
  | 'AndroidImportance'
>;

export interface PushEnvironment {
  /** Platform.OS */
  os: string;
  /** Rodando dentro do Expo Go (sem push remoto). */
  isExpoGo: boolean;
  isDemo: boolean;
}

export type PushPermission = 'granted' | 'denied' | 'undetermined' | 'unavailable';

/** Canal de notificação de alta importância; o backend envia os avisos de dose para este canal (FCMService). */
export const ALERT_CHANNEL_ID = 'alertas-dose';
export const ALERT_CHANNEL_NAME = 'Alertas de dose';

export interface PushService {
  /** O push existe neste aparelho (Android, fora do Expo Go e do demo). */
  readonly supported: boolean;
  /** Token FCM bruto do aparelho (não o token Expo), ou null se indisponível ou se falhar. */
  getDeviceToken(): Promise<string | null>;
  /** Avisa quando o FCM troca o token do aparelho. Devolve a função que cancela. */
  onTokenChange(listener: (token: string) => void): () => void;
  /** Cria (ou atualiza) o canal "Alertas de dose" de importância alta. */
  ensureAlertChannel(): Promise<void>;
  getPermission(): Promise<PushPermission>;
  /** Pede a permissão de notificações (Android 13+: POST_NOTIFICATIONS). */
  requestPermission(): Promise<PushPermission>;
  /** Toque numa notificação (app aberto, em segundo plano ou fechado). Devolve a função que cancela. */
  onOpen(listener: (data: Record<string, unknown>) => void): () => void;
  /** Dados da notificação que abriu o app fechado, se houver. */
  getLaunchData(): Promise<Record<string, unknown> | null>;
  /** Mostra banner e som com o app em primeiro plano, enquanto `enabled()` for verdadeiro (preferência do usuário). */
  showInForeground(enabled?: () => boolean): void;
}

export function isPushSupported(env: PushEnvironment): boolean {
  return env.os === 'android' && !env.isExpoGo && !env.isDemo;
}

const noop = () => undefined;

const INERT: PushService = {
  supported: false,
  getDeviceToken: async () => null,
  onTokenChange: () => noop,
  ensureAlertChannel: async () => undefined,
  getPermission: async () => 'unavailable',
  requestPermission: async () => 'unavailable',
  onOpen: () => noop,
  getLaunchData: async () => null,
  showInForeground: noop,
};

const toPermission = (status: string | undefined): PushPermission =>
  status === 'granted' || status === 'denied' || status === 'undetermined' ? status : 'unavailable';

/** Dados de uma notificação como objeto simples (o FCM manda tudo como texto). */
const dataOf = (data: unknown): Record<string, unknown> => (data && typeof data === 'object' ? (data as Record<string, unknown>) : {});

/**
 * Dados do push tocado. No Android, conforme a versão e o estado do app, o payload do FCM chega em content.data ou só
 * em trigger.remoteMessage.data: usa o primeiro que tiver conteúdo.
 */
export function responseData(response: unknown): Record<string, unknown> {
  const request = (response as { notification?: { request?: { content?: { data?: unknown }; trigger?: unknown } } })?.notification?.request;
  const content = dataOf(request?.content?.data);
  if (Object.keys(content).length > 0) return content;
  const remote = (request?.trigger as { remoteMessage?: { data?: unknown } } | undefined)?.remoteMessage?.data;
  return dataOf(remote);
}

/**
 * @param load carrega o expo-notifications; só é chamado se o push for suportado (no Expo Go e no iOS o módulo nem é
 *             avaliado)
 */
export function createPushService(env: PushEnvironment, load: () => NotificationsModule): PushService {
  if (!isPushSupported(env)) return INERT;

  let mod: NotificationsModule | null = null;
  const notifications = (): NotificationsModule | null => {
    if (mod) return mod;
    try {
      mod = load();
    } catch {
      mod = null;
    }
    return mod;
  };
  // Nada aqui pode derrubar o app: qualquer falha do módulo nativo vira o valor neutro
  const safe = async <T>(fn: (n: NotificationsModule) => Promise<T>, fallback: T): Promise<T> => {
    const n = notifications();
    if (!n) return fallback;
    try {
      return await fn(n);
    } catch {
      return fallback;
    }
  };

  return {
    supported: true,

    getDeviceToken: () =>
      safe(async (n) => {
        const token = await n.getDevicePushTokenAsync();
        return typeof token.data === 'string' && token.data ? token.data : null;
      }, null),

    onTokenChange(listener) {
      const n = notifications();
      if (!n) return noop;
      try {
        const sub = n.addPushTokenListener((token) => {
          if (typeof token.data === 'string' && token.data) listener(token.data);
        });
        return () => sub.remove();
      } catch {
        return noop;
      }
    },

    ensureAlertChannel: () =>
      safe(async (n) => {
        await n.setNotificationChannelAsync(ALERT_CHANNEL_ID, {
          name: ALERT_CHANNEL_NAME,
          importance: n.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          description: 'Avisa quando um paciente não confirma uma dose no prazo.',
        });
      }, undefined),

    getPermission: () => safe(async (n) => toPermission((await n.getPermissionsAsync()).status), 'unavailable'),

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
        // Já consumida: sem limpar, a mesma notificação abriria a dose de novo em toda abertura do app
        if (typeof n.clearLastNotificationResponse === 'function') n.clearLastNotificationResponse();
        return responseData(response);
      }, null),

    showInForeground(enabled = () => true) {
      const n = notifications();
      if (!n) return;
      try {
        n.setNotificationHandler({
          handleNotification: async () => {
            const show = enabled();
            return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
          },
        });
      } catch {
        // Sem handler, a notificação em primeiro plano só não aparece como banner
      }
    },
  };
}
