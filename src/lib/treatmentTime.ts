import type { DateKey } from '../types/domain';
import { SAO_PAULO_OFFSET_MINUTES } from './apiTime';
import { pad } from './date';

/**
 * Horários de um tratamento em relação a agora, com a mesma regra da API: se hoje tem dose do tratamento, nenhum
 * horário pode cair entre o minuto atual (inclusive) e daqui a 5 minutos; horário que já passou hoje vale a partir do
 * próximo dia do tratamento. Pura: o "agora" chega pronto (no fuso de São Paulo no modo real, no relógio do demo).
 */

export const MIN_ADVANCE_MINUTES = 5;
export const TOO_SOON_MESSAGE =
  'Não é possível cadastrar um horário que seja agora ou daqui a menos de 5 minutos. Escolha um horário com pelo menos 5 minutos de diferença do horário atual.';

/** Agora no relógio do tratamento: dia, dia da semana (0 = domingo) e segundos desde a meia-noite. */
export interface LocalNow {
  dateKey: DateKey;
  weekday: number;
  secondsOfDay: number;
}

export interface TreatmentSchedule {
  startDate: DateKey;
  endDate?: DateKey;
  weekdays: readonly number[];
  /** 'HH:mm' */
  times: readonly string[];
}

const fromUtcFields = (d: Date): LocalNow => ({
  dateKey: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
  weekday: d.getUTCDay(),
  secondsOfDay: d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds() + d.getUTCMilliseconds() / 1000,
});

/** Agora em São Paulo para um instante (o fuso da API), sem depender do fuso do aparelho. */
export const saoPauloNow = (epochMs: number): LocalNow => fromUtcFields(new Date(epochMs + SAO_PAULO_OFFSET_MINUTES * 60_000));

/** Agora na hora local de um Date (relógio simulado do demo). */
export const localNowOf = (date: Date): LocalNow =>
  fromUtcFields(new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds())));

const secondsOf = (time: string) => Number(time.slice(0, 2)) * 3600 + Number(time.slice(3, 5)) * 60;

function plusDays(key: DateKey, days: number): { dateKey: DateKey; weekday: number } {
  const d = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)) + days));
  return { dateKey: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, weekday: d.getUTCDay() };
}

/** O tratamento tem dose nesse dia: dentro do período e num dos dias da semana escolhidos. */
export function hasDoseOn(schedule: TreatmentSchedule, dateKey: DateKey, weekday: number): boolean {
  return schedule.startDate <= dateKey && (!schedule.endDate || dateKey <= schedule.endDate) && schedule.weekdays.includes(weekday);
}

/**
 * Horários de `checked` recusados agora: os de hoje entre o minuto atual (inclusive) e agora + 5 minutos. Vazio se
 * hoje não tem dose do tratamento. No cadastro, `checked` são todos os horários; na edição, só os novos.
 */
export function tooSoonTimes(schedule: TreatmentSchedule, checked: readonly string[], now: LocalNow): string[] {
  if (!hasDoseOn(schedule, now.dateKey, now.weekday)) return [];
  const minuteStart = Math.floor(now.secondsOfDay / 60) * 60;
  const limit = now.secondsOfDay + MIN_ADVANCE_MINUTES * 60;
  return checked.filter((t) => secondsOf(t) >= minuteStart && secondsOf(t) < limit);
}

/** Horários da edição que não estavam no tratamento salvo (só eles passam pela antecedência). */
export const newTimes = (times: readonly string[], saved: readonly string[]) => times.filter((t) => !saved.includes(t));

/**
 * Primeira dose depois de agora, do início (ou de hoje, se já começou) até o mesmo dia da semana seguinte; null se não
 * houver (tratamento que termina antes). Hoje só contam os horários ainda por vir.
 */
export function firstDoseAfter(schedule: TreatmentSchedule, now: LocalNow): { dateKey: DateKey; time: string } | null {
  const sorted = [...schedule.times].sort((a, b) => a.localeCompare(b));
  const base = schedule.startDate > now.dateKey ? schedule.startDate : now.dateKey;
  for (let i = 0; i <= 7; i++) {
    const day = plusDays(base, i);
    if (!hasDoseOn(schedule, day.dateKey, day.weekday)) continue;
    const time = sorted.find((t) => day.dateKey !== now.dateKey || secondsOf(t) > now.secondsOfDay);
    if (time) return { dateKey: day.dateKey, time };
  }
  return null;
}

const WEEKDAY_NAMES = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

/**
 * Aviso quando hoje é dia do tratamento mas os horários de hoje já passaram: "Este horário de hoje já passou; a
 * primeira dose será amanhã às 08:00." (ou "na quinta-feira, 15/10, às 08:00"). null se a primeira dose é hoje,
 * se hoje não tem dose do tratamento ou se não há próxima dose.
 */
export function firstDoseNotice(schedule: TreatmentSchedule, now: LocalNow): string | null {
  if (!schedule.times.length || !hasDoseOn(schedule, now.dateKey, now.weekday)) return null;
  const first = firstDoseAfter(schedule, now);
  if (!first || first.dateKey === now.dateKey) return null;
  const subject = schedule.times.length > 1 ? 'Os horários de hoje já passaram' : 'Este horário de hoje já passou';
  return `${subject}; a primeira dose será ${firstDoseWhen(first, now)}.`;
}

/** "amanhã às 08:00" ou "na quinta-feira, 15/10, às 08:00". */
export function firstDoseWhen(first: { dateKey: DateKey; time: string }, now: LocalNow): string {
  if (first.dateKey === now.dateKey) return `hoje às ${first.time}`;
  if (first.dateKey === plusDays(now.dateKey, 1).dateKey) return `amanhã às ${first.time}`;
  const { weekday } = plusDays(first.dateKey, 0);
  const article = weekday === 0 || weekday === 6 ? 'no' : 'na';
  return `${article} ${WEEKDAY_NAMES[weekday]}, ${first.dateKey.slice(8, 10)}/${first.dateKey.slice(5, 7)}, às ${first.time}`;
}

/** primeiraDose da API ('2026-10-09T08:00:00') para dia e 'HH:mm'; fora do formato, null. */
export function parseFirstDose(value: string | null | undefined): { dateKey: DateKey; time: string } | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value ?? '');
  return m ? { dateKey: m[1], time: m[2] } : null;
}
