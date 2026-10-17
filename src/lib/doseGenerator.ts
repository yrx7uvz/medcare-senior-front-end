import type { Dose, Medication, Treatment } from '../types/domain';
import { addDays, parseDateTime, startOfDay, toDateKey, toDateTimeKey, withTime } from './date';

/** Janela rolante de geração, igual ao backend (hoje + 30 dias). */
export const GENERATION_WINDOW_DAYS = 30;

export const doseId = (treatmentId: string, scheduledAt: string) => `d-${treatmentId}-${scheduledAt}`;

/**
 * Gera doses PENDENTES de `from` até `from + days`, respeitando início/fim e dias
 * da semana. `skipUntil` ignora horários já passados (o backend só gera, para
 * hoje, horários futuros).
 */
export function generateDoses(
  treatment: Treatment,
  medication: Medication,
  from: Date,
  days: number,
  skipUntil?: Date,
): Dose[] {
  const doses: Dose[] = [];
  const first = startOfDay(from);
  const start = parseDateTime(treatment.startDate);
  const end = treatment.endDate ? parseDateTime(treatment.endDate) : undefined;
  for (let i = 0; i <= days; i += 1) {
    const day = addDays(first, i);
    const key = toDateKey(day);
    if (key < toDateKey(start)) continue;
    if (end && key > toDateKey(end)) continue;
    if (!treatment.weekdays.includes(day.getDay())) continue;
    for (const t of treatment.times) {
      const scheduled = withTime(day, t.time);
      if (skipUntil && scheduled <= skipUntil) continue;
      const scheduledAt = toDateTimeKey(scheduled);
      doses.push({
        id: doseId(treatment.id, scheduledAt),
        elderId: medication.elderId,
        medicationId: medication.id,
        treatmentId: treatment.id,
        scheduledAt,
        status: 'PENDENTE',
        timeNote: t.note || undefined,
      });
    }
  }
  return doses;
}
