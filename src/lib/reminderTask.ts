import type * as BackgroundTask from 'expo-background-task';
import type * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { IS_DEMO } from '../config/env';
import { useAppStore } from '../store/appStore';
import { reminderScheduler, sincronizarLembretesDoPaciente } from './reminders';
import { bootSession, registerSessionHandlers, sessionBooted } from './session';

/**
 * Renovação da janela de lembretes em segundo plano (expo-background-task: WorkManager no Android), para o paciente
 * continuar sendo lembrado mesmo que fique dias sem abrir o app: a cada rodada, os lembretes das próximas 72 horas são
 * conferidos e reagendados.
 *
 * - Intervalo mínimo permitido pelo Android: 15 minutos. O sistema decide a hora exata (com rede, sem economia
 *   extrema de bateria); por isso esta é a renovação, não o lembrete em si, que é o alarme agendado no aparelho.
 * - A tarefa é definida ao carregar este arquivo (index.ts o importa antes de tudo): com o app fechado, o Android
 *   sobe o JavaScript sem tela, e a tarefa precisa existir nesse momento.
 * - Sem tela, o app não passou pelo boot: a tarefa liga a sessão ao cliente HTTP e lê a sessão guardada antes de
 *   sincronizar. Fora do perfil do paciente, a tarefa sai de cena (e o lembrete é todo cancelado).
 * - No demo não roda: os dados de demonstração vivem só na memória do app aberto.
 */
export const REMINDER_TASK = 'medcare-lembretes-do-paciente';
export const REMINDER_TASK_INTERVAL_MINUTES = 15;

type TaskManagerModule = typeof TaskManager;
type BackgroundTaskModule = typeof BackgroundTask;

const supported = Platform.OS === 'android' && !IS_DEMO;

function load(): { tasks: TaskManagerModule; background: BackgroundTaskModule } | null {
  if (!supported) return null;
  try {
    return {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      tasks: require('expo-task-manager') as TaskManagerModule,
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      background: require('expo-background-task') as BackgroundTaskModule,
    };
  } catch {
    // Expo Go ou build sem o módulo nativo: o lembrete continua com as outras sincronizações
    return null;
  }
}

/** O que a tarefa faz: boot sem tela, se preciso, e a sincronização. Exportada para teste. */
export async function runReminderTask(): Promise<'OK' | 'FALHOU'> {
  try {
    if (!sessionBooted()) {
      registerSessionHandlers();
      await bootSession();
    }
    const outcome = await sincronizarLembretesDoPaciente();
    return outcome === 'SEM_REDE' ? 'FALHOU' : 'OK';
  } catch {
    return 'FALHOU';
  }
}

const modules = load();
if (modules) {
  try {
    modules.tasks.defineTask(REMINDER_TASK, async () => {
      const result = await runReminderTask();
      return result === 'OK' ? modules.background.BackgroundTaskResult.Success : modules.background.BackgroundTaskResult.Failed;
    });
  } catch {
    // Sem a definição, a renovação em segundo plano não acontece; o resto do lembrete segue
  }
}

/** Liga ou desliga a tarefa conforme o aparelho é (ou deixa de ser) do paciente. Nunca lança erro. */
export async function updateReminderTask(): Promise<'REGISTRADA' | 'REMOVIDA' | 'SEM_SUPORTE'> {
  if (!modules || !reminderScheduler.supported) return 'SEM_SUPORTE';
  const s = useAppStore.getState();
  const patient = s.viewAs === 'PATIENT' && !!s.patientSession;
  try {
    const registered = await modules.tasks.isTaskRegisteredAsync(REMINDER_TASK);
    if (patient) {
      if (!registered) {
        await modules.background.registerTaskAsync(REMINDER_TASK, { minimumInterval: REMINDER_TASK_INTERVAL_MINUTES });
      }
      return 'REGISTRADA';
    }
    if (registered) await modules.background.unregisterTaskAsync(REMINDER_TASK);
    return 'REMOVIDA';
  } catch {
    return 'SEM_SUPORTE';
  }
}

/** Mantém a tarefa em dia com a sessão (pareou, saiu, trocou de perfil). */
export function startReminderTask(): () => void {
  if (!modules) return () => undefined;
  const unsubscribe = useAppStore.subscribe((state, prev) => {
    if (state.viewAs !== prev.viewAs || state.patientSession?.token !== prev.patientSession?.token || state.profileLoaded !== prev.profileLoaded) {
      if (state.profileLoaded) void updateReminderTask();
    }
  });
  if (useAppStore.getState().profileLoaded) void updateReminderTask();
  return unsubscribe;
}
