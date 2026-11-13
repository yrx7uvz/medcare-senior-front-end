import type { DoseView } from '../types/views';

/**
 * Lembrete de dose no aparelho do paciente: o que agendar. Puro (sem React Native nem expo-notifications), testável no
 * Node. O agendamento em si fica em reminderCore.ts e a ligação com a sessão em reminders.ts.
 *
 * Duas notificações por dose PENDENTE, agendadas de antemão:
 * - lembrete 1, no horário da dose ("Hora do remédio");
 * - lembrete 2, 10 minutos depois ("Você ainda não confirmou o remédio"), cancelado quando a dose é confirmada.
 *
 * Só as doses das próximas 72 horas, no máximo 60 notificações (as mais próximas primeiro). Identificador fixo por dose
 * e tipo (dose-{id}-1 e dose-{id}-2): sincronizar de novo substitui em vez de duplicar, e o servidor usa a mesma tag no
 * push de reforço para o Android trocar uma notificação pela outra.
 */

/** Canal de notificação do lembrete (o servidor manda o reforço para o mesmo canal). */
export const REMINDER_CHANNEL_ID = 'lembrete-dose';
export const REMINDER_CHANNEL_NAME = 'Lembrete de remédio';
export const REMINDER_CHANNEL_DESCRIPTION = 'Toca na hora de tomar o remédio, mesmo com o celular bloqueado.';

/** Tipo no payload do lembrete local e do reforço do servidor (PushNotificadorDeLembreteDoPacienteAdapter). */
export const REMINDER_TYPE = 'LEMBRETE_DOSE';

export const REMINDER_WINDOW_MS = 72 * 60 * 60_000;
export const MAX_SCHEDULED_REMINDERS = 60;
export const SECOND_REMINDER_DELAY_MS = 10 * 60_000;
/** Lembrete que tocaria em menos que isso já não é agendado (o Android poderia entregá-lo atrasado e fora de ordem). */
const MIN_LEAD_MS = 5_000;

export const FIRST_REMINDER_TITLE = 'Hora do remédio';
export const SECOND_REMINDER_TITLE = 'Você ainda não confirmou o remédio';

export type ReminderKind = 1 | 2;

/** dose-{id}-1 (no horário) e dose-{id}-2 (insistência). */
export const reminderId = (doseId: string, kind: ReminderKind) => `dose-${doseId}-${kind}`;
export const reminderIdsOf = (doseId: string) => [reminderId(doseId, 1), reminderId(doseId, 2)];

const ID_RE = /^dose-(.+)-([12])$/;

/** Identificador de um lembrete deste app (o resto, como os avisos do cuidador, nunca é tocado). */
export const isReminderId = (id: string) => ID_RE.test(id);

/** Dose do identificador dose-{id}-N, ou null. */
export function doseIdOfReminder(id: string): string | null {
  return ID_RE.exec(id)?.[1] ?? null;
}

export type ReminderDose = Pick<DoseView, 'id' | 'patientId' | 'scheduledAt' | 'storedStatus' | 'confirmUntil'> & {
  medication: Pick<DoseView['medication'], 'name'>;
};

/**
 * Relógio do servidor visto do aparelho, no mesmo instante: `appNowMs` é o "agora" com que os horários das doses são
 * comparados (serverClock.appNowMs: relógio do aparelho corrigido pelo servidor; no demo, o relógio simulado) e
 * `deviceNowMs` é o relógio do aparelho, que é o que o Android usa para disparar a notificação.
 */
export interface ReminderClock {
  appNowMs: number;
  deviceNowMs: number;
}

export interface PlannedReminder {
  id: string;
  doseId: string;
  kind: ReminderKind;
  /** Quando tocar, no relógio do APARELHO. */
  triggerAtMs: number;
  title: string;
  body: string;
  /** Payload do toque (mesmo formato do reforço do servidor) e a assinatura para a sincronização idempotente. */
  data: Record<string, string>;
}

/** "Tomar Losartana às 08:00": o horário como o servidor gravou (fuso de São Paulo; no demo, o do relógio simulado). */
export function reminderBody(dose: ReminderDose, kind: ReminderKind): string {
  const time = dose.scheduledAt.slice(11, 16);
  const base = `Tomar ${dose.medication.name.trim()} às ${time}`;
  return kind === 1 ? base : `${base}. Toque para confirmar.`;
}

/** Instante da dose (no relógio do servidor) levado para o relógio do aparelho. */
export const toDeviceMs = (instantMs: number, clock: ReminderClock) => instantMs - (clock.appNowMs - clock.deviceNowMs);

/**
 * Lembretes a agendar, dos mais próximos para os mais distantes. Ignora doses que não estão PENDENTES (confirmadas ou
 * encerradas), horários ilegíveis, lembretes que já passaram e os que passam da janela de 72 horas; o segundo
 * lembrete só entra se a dose ainda puder ser confirmada naquela hora. Doses repetidas (a mesma dose em duas listas)
 * contam uma vez.
 *
 * @param toInstantMs horário da dose ('AAAA-MM-DDTHH:mm', fuso do servidor) para instante (serverClock.doseInstantMs)
 */
export function planReminders(
  doses: readonly ReminderDose[],
  clock: ReminderClock,
  toInstantMs: (key: string) => number | null,
  limits: { windowMs?: number; max?: number } = {},
): PlannedReminder[] {
  const windowMs = limits.windowMs ?? REMINDER_WINDOW_MS;
  const max = limits.max ?? MAX_SCHEDULED_REMINDERS;
  const earliest = clock.deviceNowMs + MIN_LEAD_MS;
  const latest = clock.deviceNowMs + windowMs;
  const seen = new Set<string>();
  const planned: PlannedReminder[] = [];

  for (const dose of doses) {
    if (seen.has(dose.id) || dose.storedStatus !== 'PENDENTE') continue;
    seen.add(dose.id);
    const scheduledMs = toInstantMs(dose.scheduledAt);
    if (scheduledMs === null || !Number.isFinite(scheduledMs)) continue;
    const confirmUntilMs = toInstantMs(dose.confirmUntil);

    for (const kind of [1, 2] as const) {
      const instantMs = kind === 1 ? scheduledMs : scheduledMs + SECOND_REMINDER_DELAY_MS;
      // Insistir depois do prazo de confirmação não serve para nada: a dose não pode mais ser confirmada
      if (kind === 2 && confirmUntilMs !== null && instantMs > confirmUntilMs) continue;
      const triggerAtMs = toDeviceMs(instantMs, clock);
      if (triggerAtMs < earliest || triggerAtMs > latest) continue;
      const body = reminderBody(dose, kind);
      planned.push({
        id: reminderId(dose.id, kind),
        doseId: dose.id,
        kind,
        triggerAtMs,
        title: kind === 1 ? FIRST_REMINDER_TITLE : SECOND_REMINDER_TITLE,
        body,
        data: {
          tipo: REMINDER_TYPE,
          doseId: dose.id,
          pacienteId: dose.patientId,
          data: dose.scheduledAt.slice(0, 10),
          lembrete: String(kind),
          assinatura: reminderSignature(triggerAtMs, body),
        },
      });
    }
  }

  planned.sort((a, b) => a.triggerAtMs - b.triggerAtMs || a.id.localeCompare(b.id));
  return planned.slice(0, max);
}

/**
 * Quando e o quê: se nada disso mudou, o lembrete agendado continua como está. Arredondada ao segundo, para uma
 * variação de milissegundos na medição do relógio do servidor não reagendar tudo a cada abertura.
 */
export function reminderSignature(triggerAtMs: number, body: string): string {
  return `${Math.round(triggerAtMs / 1000)}|${body}`;
}

/** Um lembrete já agendado no aparelho (getAllScheduledNotificationsAsync), com a assinatura gravada no payload. */
export interface ScheduledReminder {
  id: string;
  signature: string | null;
}

export interface ReminderDiff {
  /** Agendados que não valem mais (dose confirmada, removida ou fora da janela). */
  toCancel: string[];
  /** Novos ou que mudaram (horário ou remédio): agendar (substitui o de mesmo identificador). */
  toSchedule: PlannedReminder[];
  /** Agendados que continuam como estão. */
  kept: string[];
}

/**
 * O que mudar no aparelho para chegar ao planejado, sem duplicar nem reagendar o que já está certo (rodar duas vezes
 * seguidas não muda nada na segunda).
 *
 * @param complete  todas as listas de doses da janela chegaram. Sem isso (sem rede, por exemplo), só se cancelam os
 *                  lembretes das doses vistas (as confirmadas): os demais ficam, porque o paciente precisa ser lembrado
 *                  mesmo sem internet
 * @param seenDoseIds doses que vieram nas listas (inclusive as confirmadas, que não entram no planejado)
 * @param force       reagenda até o que não mudou (o Android acabou de liberar o alarme exato: os já agendados como
 *                    inexatos continuariam inexatos)
 */
export function diffReminders(
  planned: readonly PlannedReminder[],
  scheduled: readonly ScheduledReminder[],
  options: { complete: boolean; seenDoseIds?: ReadonlySet<string>; max?: number; force?: boolean },
): ReminderDiff {
  const max = options.max ?? MAX_SCHEDULED_REMINDERS;
  const ours = scheduled.filter((s) => isReminderId(s.id));
  const plannedById = new Map(planned.map((p) => [p.id, p]));
  const scheduledById = new Map(ours.map((s) => [s.id, s]));

  const toCancel: string[] = [];
  const kept: string[] = [];
  for (const s of ours) {
    const p = plannedById.get(s.id);
    if (p) {
      if (!options.force && p.data.assinatura === s.signature) kept.push(s.id);
      continue;
    }
    const doseId = doseIdOfReminder(s.id) ?? '';
    if (options.complete || options.seenDoseIds?.has(doseId)) toCancel.push(s.id);
    else kept.push(s.id);
  }

  const toSchedule = options.force ? [...planned] : planned.filter((p) => scheduledById.get(p.id)?.signature !== p.data.assinatura);
  // Sem a lista completa, os que ficaram sem conferência ocupam vaga: nunca passar do limite no total
  const room = Math.max(0, max - kept.length);
  return { toCancel, toSchedule: toSchedule.slice(0, room), kept };
}
