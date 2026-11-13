import { AppState, Platform } from 'react-native';
import { services } from '../services';
import { useAppStore } from '../store/appStore';
import { getNow } from './clock';
import { push } from './push';
import { parseReminderPayload } from './pushPayload';
import { createReminderScheduler, type ReminderNotificationsModule } from './reminderCore';
import { reminderDays } from './reminderHealth';
import { planReminders, reminderId } from './reminderPlan';
import { appNowMs, appTodayKey, doseInstantMs } from './serverClock';

/**
 * Lembrete de dose no aparelho do paciente, ligado à sessão: agenda as notificações locais a partir das doses do
 * paciente (camada principal, funciona sem internet) e as mantém em dia. O plano é puro (reminderPlan.ts) e o
 * agendamento fica em reminderCore.ts.
 *
 * Quando sincroniza: ao abrir o app e ao voltar ao primeiro plano, a cada 5 minutos com o app aberto, quando o início
 * do paciente vê a lista de doses do dia mudar (remédio novo ou horário alterado pelo cuidador), quando a sessão
 * muda (pareou, saiu, desconectou, trocou de perfil), quando chega o reforço do servidor e em segundo plano
 * (reminderTask.ts). Ao confirmar a dose, os dois lembretes dela são cancelados na hora.
 */
export const reminderScheduler = createReminderScheduler(
  { os: Platform.OS },
  // Carregado só no Android: na web o expo-notifications nem é avaliado
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  () => require('expo-notifications') as ReminderNotificationsModule,
);

export type ReminderSyncOutcome = 'SEM_SUPORTE' | 'AGUARDANDO' | 'NAO_PACIENTE' | 'SEM_REDE' | 'PARCIAL' | 'SINCRONIZADO';

let running: Promise<ReminderSyncOutcome> | null = null;
let again = false;
let forceNext = false;

/**
 * Função única e idempotente: deixa os lembretes agendados iguais às doses PENDENTES das próximas 72 horas. Fora do
 * perfil do paciente (ou sem sessão), cancela tudo. Sem rede, mantém o que já está agendado (e só cancela os lembretes
 * das doses que vieram confirmadas). Chamadas ao mesmo tempo viram uma só, repetida uma vez no fim se algo mudou.
 *
 * @param options.reagendarTudo reagenda até o que não mudou (o paciente acabou de liberar o alarme exato)
 */
export function sincronizarLembretesDoPaciente(options: { reagendarTudo?: boolean } = {}): Promise<ReminderSyncOutcome> {
  if (!reminderScheduler.supported) return Promise.resolve('SEM_SUPORTE');
  if (options.reagendarTudo) forceNext = true;
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      let outcome: ReminderSyncOutcome;
      do {
        again = false;
        outcome = await syncOnce();
      } while (again);
      return outcome;
    } finally {
      running = null;
    }
  })();
  return running;
}

async function syncOnce(): Promise<ReminderSyncOutcome> {
  const state = useAppStore.getState();
  // Antes do boot ler o perfil e a sessão, não há o que decidir (e nada pode ser cancelado por engano)
  if (!state.profileLoaded || !state.patientSessionLoaded) return 'AGUARDANDO';
  if (state.viewAs !== 'PATIENT' || !state.patientSession) {
    // O cuidador não recebe lembrete de dose: o aparelho dele só tem o aviso de dose não confirmada
    await reminderScheduler.cancelAll();
    return 'NAO_PACIENTE';
  }
  const patientId = state.patientSession.patientId;
  const days = reminderDays(appTodayKey(getNow()));
  const lists = await Promise.allSettled(days.map((day) => services.doses.listForDay(patientId, day)));

  // A sessão pode ter mudado durante a busca (desconexão, troca de perfil): a próxima rodada decide
  const after = useAppStore.getState();
  if (after.viewAs !== 'PATIENT' || after.patientSession?.patientId !== patientId) {
    again = true;
    return 'NAO_PACIENTE';
  }
  const doses = lists.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  if (!lists.some((r) => r.status === 'fulfilled')) return 'SEM_REDE';
  const complete = lists.every((r) => r.status === 'fulfilled');

  const deviceNowMs = Date.now();
  const planned = planReminders(doses, { appNowMs: appNowMs(getNow()), deviceNowMs }, doseInstantMs);
  await reminderScheduler.ensureChannel();
  const force = forceNext;
  forceNext = false;
  await reminderScheduler.sync(planned, { complete, seenDoseIds: new Set(doses.map((d) => d.id)), force });
  return complete ? 'SINCRONIZADO' : 'PARCIAL';
}

/** Dose confirmada: o segundo lembrete não pode tocar, e os que já estão na tela saem. */
export function cancelarLembretesDaDose(doseId: string): Promise<void> {
  return reminderScheduler.cancelDose(doseId);
}

/** Saída da conta, desconexão ou troca de perfil. */
export function cancelarTodosOsLembretes(): Promise<void> {
  return reminderScheduler.cancelAll();
}

/** Toque num lembrete (local ou do servidor): abre a dose, passando pelo PIN se for a vez dele. */
export function openReminder(data: Record<string, unknown>): boolean {
  const target = parseReminderPayload(data);
  if (!target) return false;
  useAppStore.getState().setPendingPatientDoseOpen(target);
  return true;
}

/**
 * Lembrete chegando com o app aberto. null: não é lembrete (quem chamou decide). No perfil do cuidador, nunca aparece.
 * O local aparece; o reforço do servidor dispara a sincronização e só aparece se o lembrete local da mesma dose não
 * estiver na tela (o mesmo doseId não gera duas notificações iguais).
 */
export async function reminderInForeground(data: Record<string, unknown>, remote: boolean): Promise<boolean | null> {
  const target = parseReminderPayload(data);
  if (!target) return null;
  if (useAppStore.getState().viewAs !== 'PATIENT') return false;
  if (!remote) return true;
  void sincronizarLembretesDoPaciente();
  const shown =
    (await reminderScheduler.isPresented(reminderId(target.doseId, 1))) || (await reminderScheduler.isPresented(reminderId(target.doseId, 2)));
  return !shown;
}

const PERIODIC_SYNC_MS = 5 * 60_000;

/**
 * Liga o lembrete no boot: canal, sincronização a cada mudança de sessão e a cada 5 minutos com o app aberto. Onde o
 * push não existe (demo, Expo Go), o toque e o banner em primeiro plano são tratados aqui; com o push, pelo pushSession.
 */
export function startPatientReminders(): () => void {
  if (!reminderScheduler.supported) return () => undefined;
  void reminderScheduler.ensureChannel();
  const stops: (() => void)[] = [];

  if (!push.supported) {
    reminderScheduler.showInForeground((data) => {
      if (!parseReminderPayload(data)) return false;
      return useAppStore.getState().viewAs === 'PATIENT';
    });
    stops.push(reminderScheduler.onOpen((data) => void openReminder(data)));
    void reminderScheduler.getLaunchData().then((data) => {
      if (data) openReminder(data);
    });
  }

  stops.push(
    useAppStore.subscribe((state, prev) => {
      if (
        state.viewAs !== prev.viewAs ||
        state.patientSession?.token !== prev.patientSession?.token ||
        state.profileLoaded !== prev.profileLoaded ||
        state.patientSessionLoaded !== prev.patientSessionLoaded
      ) {
        void sincronizarLembretesDoPaciente();
      }
    }),
  );

  const timer = setInterval(() => {
    if (AppState.currentState === 'active') void sincronizarLembretesDoPaciente();
  }, PERIODIC_SYNC_MS);
  stops.push(() => clearInterval(timer));
  void sincronizarLembretesDoPaciente();
  return () => stops.forEach((stop) => stop());
}
