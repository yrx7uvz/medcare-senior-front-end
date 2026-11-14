import type { MedcareAlarmesNativo } from '../../modules/medcare-alarmes';
import {
  FIRST_REMINDER_TITLE,
  MAX_SCHEDULED_REMINDERS,
  REMINDER_TYPE,
  REMINDER_WINDOW_MS,
  reminderBody,
  toDeviceMs,
  type ReminderClock,
  type ReminderDose,
} from './reminderPlan';

/**
 * Alarme da dose no aparelho do paciente (módulo nativo medcare-alarmes, AlarmesDaDose.kt): no horário da dose toca
 * som de alarme sem parar, acende a tela e abre a tela do alarme por cima do bloqueio; só para quando a dose é
 * confirmada no app ou quando acaba o prazo de confirmação. O paciente pode adiar 5 minutos.
 *
 * Onde o módulo existe, o alarme substitui os dois lembretes do expo-notifications (o "no horário" e o "você ainda não
 * confirmou", 10 minutos depois): ele mesmo volta a tocar a cada 2 minutos. Onde não existe (Expo Go, web, APK
 * antigo), tudo continua como antes. O plano é puro e testável no Node; o nativo chega por injeção.
 */

/** O que o app manda ao nativo, por dose (instantes no relógio do APARELHO). */
export interface AlarmeDeDose {
  doseId: string;
  pacienteId: string;
  /** Dia da dose (AAAA-MM-DD): o app abre a dose certa depois de "Tomar o remédio". */
  data: string;
  titulo: string;
  corpo: string;
  /** Horário da dose: primeiro toque. */
  disparoMs: number;
  /** Prazo de confirmação: depois disso o alarme some. */
  ateMs: number;
}

/** Sem prazo vindo do servidor (não deveria acontecer), o alarme não toca para sempre: 1 hora depois do horário. */
export const FALLBACK_DEADLINE_MS = 60 * 60_000;

/**
 * Alarmes a manter, dos mais próximos para os mais distantes: doses PENDENTES cujo prazo de confirmação ainda não
 * passou e cujo horário cabe na janela de 72 horas. Diferente do lembrete, uma dose cujo horário já passou continua no
 * plano enquanto puder ser confirmada: o alarme dela pode estar tocando ou adiado, e o nativo mantém esse estado
 * (mesmo horário = mesmo alarme). Doses repetidas contam uma vez.
 *
 * @param toInstantMs horário da dose ('AAAA-MM-DDTHH:mm', fuso do servidor) para instante (serverClock.doseInstantMs)
 */
export function planAlarms(
  doses: readonly ReminderDose[],
  clock: ReminderClock,
  toInstantMs: (key: string) => number | null,
  limits: { windowMs?: number; max?: number } = {},
): AlarmeDeDose[] {
  const latest = clock.deviceNowMs + (limits.windowMs ?? REMINDER_WINDOW_MS);
  const seen = new Set<string>();
  const planned: AlarmeDeDose[] = [];

  for (const dose of doses) {
    if (seen.has(dose.id) || dose.storedStatus !== 'PENDENTE') continue;
    seen.add(dose.id);
    const scheduledMs = toInstantMs(dose.scheduledAt);
    if (scheduledMs === null || !Number.isFinite(scheduledMs)) continue;
    const confirmUntilMs = toInstantMs(dose.confirmUntil);
    const deadlineMs = confirmUntilMs !== null && Number.isFinite(confirmUntilMs) ? confirmUntilMs : scheduledMs + FALLBACK_DEADLINE_MS;

    const disparoMs = toDeviceMs(scheduledMs, clock);
    const ateMs = toDeviceMs(deadlineMs, clock);
    // Prazo encerrado (não dá mais para confirmar) ou dose além da janela
    if (ateMs <= clock.deviceNowMs || ateMs <= disparoMs || disparoMs > latest) continue;
    planned.push({
      doseId: dose.id,
      pacienteId: dose.patientId,
      data: dose.scheduledAt.slice(0, 10),
      titulo: FIRST_REMINDER_TITLE,
      corpo: reminderBody(dose, 1),
      disparoMs: Math.round(disparoMs),
      ateMs: Math.round(ateMs),
    });
  }

  planned.sort((a, b) => a.disparoMs - b.disparoMs || a.doseId.localeCompare(b.doseId));
  return planned.slice(0, limits.max ?? MAX_SCHEDULED_REMINDERS);
}

/**
 * Alarmes gravados no aparelho que não valem mais. Com a lista completa, sai todo alarme fora do plano (dose
 * confirmada, removida, prazo encerrado). Sem ela (sem rede em algum dia), só os das doses que vieram nas listas: o
 * paciente precisa ser lembrado mesmo sem internet.
 */
export function alarmsToCancel(
  planned: readonly AlarmeDeDose[],
  scheduledDoseIds: readonly string[],
  options: { complete: boolean; seenDoseIds?: ReadonlySet<string> },
): string[] {
  const keep = new Set(planned.map((a) => a.doseId));
  return scheduledDoseIds.filter((id) => !keep.has(id) && (options.complete || options.seenDoseIds?.has(id) === true));
}

export interface DoseAlarms {
  /** O alarme nativo existe neste aparelho (APK com o módulo novo, no Android). */
  readonly supported: boolean;
  /** Deixa os alarmes iguais ao planejado. false: o nativo falhou (quem chama volta para o lembrete comum). */
  sync(planned: readonly AlarmeDeDose[], options: { complete: boolean; seenDoseIds?: ReadonlySet<string>; force?: boolean }): boolean;
  /** Dose confirmada: o alarme para e não volta. */
  cancelDose(doseId: string): void;
  cancelAll(): void;
  /** Esta dose tem alarme (agendado, tocando ou adiado). */
  has(doseId: string): boolean;
  /** Dose que o paciente pediu para confirmar na tela do alarme, no formato do payload do lembrete; uma vez só. */
  takePendingOpen(): Record<string, string> | null;
}

type AlarmNative = Required<
  Pick<MedcareAlarmesNativo, 'agendarAlarmes' | 'listarAlarmes' | 'cancelarAlarme' | 'cancelarTodosOsAlarmes' | 'tomarAberturaPendente'>
>;

const INERT: DoseAlarms = {
  supported: false,
  sync: () => false,
  cancelDose: () => undefined,
  cancelAll: () => undefined,
  has: () => false,
  takePendingOpen: () => null,
};

function hasAlarmFunctions(native: MedcareAlarmesNativo | null | undefined): native is MedcareAlarmesNativo & AlarmNative {
  return (
    !!native &&
    typeof native.agendarAlarmes === 'function' &&
    typeof native.listarAlarmes === 'function' &&
    typeof native.cancelarAlarme === 'function' &&
    typeof native.cancelarTodosOsAlarmes === 'function' &&
    typeof native.tomarAberturaPendente === 'function'
  );
}

const ID_RE = /^[\w.:-]{1,80}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A abertura pendente do nativo vira o payload do lembrete (parseReminderPayload); qualquer outra coisa, null. */
export function pendingOpenPayload(json: string | null | undefined): Record<string, string> | null {
  if (!json) return null;
  try {
    const d = JSON.parse(json) as Record<string, unknown>;
    const doseId = typeof d.doseId === 'string' ? d.doseId : '';
    const day = typeof d.data === 'string' ? d.data : '';
    if (!ID_RE.test(doseId) || !DAY_RE.test(day)) return null;
    const patientId = typeof d.pacienteId === 'string' && ID_RE.test(d.pacienteId) ? d.pacienteId : '';
    return { tipo: REMINDER_TYPE, doseId, data: day, pacienteId: patientId };
  } catch {
    return null;
  }
}

/**
 * @param native módulo nativo (null fora do Android ou sem o módulo). Nada aqui lança: uma falha do nativo vira o
 *               valor neutro, e o app nunca cai por causa do alarme.
 */
export function createDoseAlarms(env: { os: string }, native: MedcareAlarmesNativo | null | undefined): DoseAlarms {
  if (env.os !== 'android' || !hasAlarmFunctions(native)) return INERT;
  const list = (): string[] => {
    try {
      return native.listarAlarmes();
    } catch {
      return [];
    }
  };

  return {
    supported: true,

    sync(planned, options) {
      try {
        for (const id of alarmsToCancel(planned, list(), options)) native.cancelarAlarme(id);
        native.agendarAlarmes(JSON.stringify(planned), options.force === true);
        return true;
      } catch {
        return false;
      }
    },

    cancelDose(doseId) {
      try {
        native.cancelarAlarme(doseId);
      } catch {
        // A próxima sincronização cancela (a dose virá confirmada)
      }
    },

    cancelAll() {
      try {
        native.cancelarTodosOsAlarmes();
      } catch {
        // Idem
      }
    },

    has: (doseId) => list().includes(doseId),

    takePendingOpen() {
      try {
        return pendingOpenPayload(native.tomarAberturaPendente());
      } catch {
        return null;
      }
    },
  };
}
