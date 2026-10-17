import type { DisplayStatus, DoseStatus } from '../types/domain';
import type { Confirmability, DoseWindow } from '../types/views';
import { addMinutes, minutesBetween, toDateTimeKey } from './date';

/** RN14: confirmação liberada a partir de 60 min antes do horário. */
export const CONFIRM_OPENS_BEFORE_MIN = 60;
/** RN09: encerramento padrão, 180 min após o horário programado. */
export const CLOSE_AFTER_MIN = 180;
/** RN09: tolerância padrão e limites configuráveis. */
export const DEFAULT_TOLERANCE_MIN = 30;
export const TOLERANCE_MIN = 5;
export const TOLERANCE_MAX = 120;
export const TOLERANCE_STEP = 5;

export function resolveDisplayStatus(stored: DoseStatus, scheduled: Date, now: Date, toleranceMin: number): DisplayStatus {
  if (stored !== 'PENDENTE') return stored;
  const late = minutesBetween(now, scheduled);
  if (late > CLOSE_AFTER_MIN) return 'NAO_TOMADA';
  if (late > toleranceMin) return 'ATRASADA';
  return 'PENDENTE';
}

export function getConfirmability(stored: DoseStatus, scheduled: Date, now: Date): Confirmability {
  if (stored !== 'PENDENTE') return 'JA_REGISTRADA';
  const diff = minutesBetween(now, scheduled);
  if (diff < -CONFIRM_OPENS_BEFORE_MIN) return 'MUITO_CEDO';
  if (diff > CLOSE_AFTER_MIN) return 'ENCERRADA';
  return 'OK';
}

/** Status gravado na confirmação: depois do aviso, vira "confirmada com atraso". */
export function statusOnConfirm(scheduled: Date, now: Date, toleranceMin: number): 'TOMADA' | 'CONFIRMADA_COM_ATRASO' {
  return minutesBetween(now, scheduled) > toleranceMin ? 'CONFIRMADA_COM_ATRASO' : 'TOMADA';
}

export function doseWindow(scheduled: Date, toleranceMin: number): DoseWindow {
  return {
    opensAt: toDateTimeKey(addMinutes(scheduled, -CONFIRM_OPENS_BEFORE_MIN)),
    alertAt: toDateTimeKey(addMinutes(scheduled, toleranceMin)),
    closesAt: toDateTimeKey(addMinutes(scheduled, CLOSE_AFTER_MIN)),
  };
}

export const isConfirmed = (s: DisplayStatus) => s === 'TOMADA' || s === 'CONFIRMADA_COM_ATRASO';
export const isMissed = (s: DisplayStatus) => s === 'ATRASADA' || s === 'NAO_TOMADA';
export const isRegistered = (s: DisplayStatus) => s === 'TOMADA' || s === 'CONFIRMADA_COM_ATRASO' || s === 'NAO_TOMADA';

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
