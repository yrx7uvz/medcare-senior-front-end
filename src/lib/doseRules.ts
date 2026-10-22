import type { ConfirmedBy, DisplayStatus, DoseStatus } from '../types/domain';
import type { Confirmability, DoseWindow } from '../types/views';
import { addMinutes, minutesBetween, toDateTimeKey } from './date';

/**
 * Regras de tempo da dose, as mesmas do servidor (PoliticaDeJanela). No app real a janela de cada dose vem da API
 * (janela e limiteConfirmacao) e as telas usam só esses instantes; estas funções servem ao modo demonstração e ao
 * exemplo explicativo das Configurações.
 */

/** A confirmação abre 60 min antes do horário. */
export const CONFIRM_OPENS_BEFORE_MIN = 60;
/** Depois do aviso (horário + tolerância), a dose ainda pode ser confirmada por mais 30 min. */
export const MARGIN_AFTER_ALERT_MIN = 30;
/** Tolerância padrão e limites configuráveis pelo cuidador. */
export const DEFAULT_TOLERANCE_MIN = 30;
export const TOLERANCE_MIN = 5;
export const TOLERANCE_MAX = 120;
export const TOLERANCE_STEP = 5;

/** Mesma regra da API (PUT /api/configuracoes/tolerancia): inteiro de 5 a 120, inclusive. Null = válido. */
export function toleranceError(minutes: number): string | null {
  return Number.isInteger(minutes) && minutes >= TOLERANCE_MIN && minutes <= TOLERANCE_MAX
    ? null
    : `A tolerância deve ficar entre ${TOLERANCE_MIN} e ${TOLERANCE_MAX} minutos`;
}

/** Minutos depois do horário em que a dose deixa de poder ser confirmada: tolerância + margem depois do aviso. */
export const closesAfterMinutes = (toleranceMin: number) => toleranceMin + MARGIN_AFTER_ALERT_MIN;

/** Limites exatos contam como dentro (como no servidor): no aviso ainda é PENDENTE; no encerramento, ATRASADA. */
export function resolveDisplayStatus(stored: DoseStatus, scheduled: Date, now: Date, toleranceMin: number): DisplayStatus {
  if (stored !== 'PENDENTE') return stored;
  const late = minutesBetween(now, scheduled);
  if (late > closesAfterMinutes(toleranceMin)) return 'NAO_TOMADA';
  if (late > toleranceMin) return 'ATRASADA';
  return 'PENDENTE';
}

export function getConfirmability(stored: DoseStatus, scheduled: Date, now: Date, toleranceMin: number): Confirmability {
  if (stored !== 'PENDENTE') return 'JA_REGISTRADA';
  const diff = minutesBetween(now, scheduled);
  if (diff < -CONFIRM_OPENS_BEFORE_MIN) return 'MUITO_CEDO';
  if (diff > closesAfterMinutes(toleranceMin)) return 'ENCERRADA';
  return 'OK';
}

/** Status gravado na confirmação: até o aviso (inclusive), no horário; depois, com atraso. */
export function statusOnConfirm(scheduled: Date, now: Date, toleranceMin: number): 'CONFIRMADA_NO_HORARIO' | 'CONFIRMADA_COM_ATRASO' {
  return minutesBetween(now, scheduled) > toleranceMin ? 'CONFIRMADA_COM_ATRASO' : 'CONFIRMADA_NO_HORARIO';
}

export function doseWindow(scheduled: Date, toleranceMin: number): DoseWindow {
  return {
    opensAt: toDateTimeKey(addMinutes(scheduled, -CONFIRM_OPENS_BEFORE_MIN)),
    alertAt: toDateTimeKey(addMinutes(scheduled, toleranceMin)),
    closesAt: toDateTimeKey(addMinutes(scheduled, closesAfterMinutes(toleranceMin))),
  };
}

export const isConfirmed = (s: DisplayStatus) => s === 'CONFIRMADA_NO_HORARIO' || s === 'CONFIRMADA_COM_ATRASO';
export const isMissed = (s: DisplayStatus) => s === 'ATRASADA' || s === 'NAO_TOMADA';
export const isRegistered = (s: DisplayStatus) => s === 'CONFIRMADA_NO_HORARIO' || s === 'CONFIRMADA_COM_ATRASO' || s === 'NAO_TOMADA';

/**
 * "Confirmada por José às 08:05" (idoso, com o primeiro nome) ou "Confirmada por você às 08:05" (cuidador vendo a
 * própria confirmação). Sem quem confirmou (dados antigos), só a hora.
 */
export function confirmedByText(by: ConfirmedBy | undefined, elderFirstName: string, time: string): string {
  if (by === 'CUIDADOR') return `Confirmada por você às ${time}`;
  if (by === 'IDOSO') return `Confirmada por ${elderFirstName} às ${time}`;
  return `Confirmada às ${time}`;
}

export interface DoseSummary {
  confirmed: number;
  pending: number;
  missed: number;
  total: number;
}

/** Cards do painel: Confirmadas / Pendentes / Não confirmadas. */
export function summarize(statuses: DisplayStatus[]): DoseSummary {
  return statuses.reduce<DoseSummary>(
    (acc, s) => {
      if (isConfirmed(s)) acc.confirmed += 1;
      else if (isMissed(s)) acc.missed += 1;
      else acc.pending += 1;
      acc.total += 1;
      return acc;
    },
    { confirmed: 0, pending: 0, missed: 0, total: 0 },
  );
}
