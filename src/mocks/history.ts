import type { Dose, DoseStatus, Medication, Treatment } from '../types/domain';
import { addDays, addMinutes, parseDateTime, toDateKey, toDateTimeKey, withTime } from '../lib/date';
import { doseId } from '../lib/doseGenerator';

/**
 * Padrões determinísticos do histórico. Os índices contam as doses de cada
 * tratamento em ordem cronológica, do início até ontem. Taxas resultantes
 * (encerradas, sem contar pendentes):
 *  - Metformina   50 doses → 4 não tomadas → 92%
 *  - Losartana    25 doses → 3 não tomadas → 88%
 *  - Atorvastatina 20 doses → 7 não tomadas → 65%
 *  - Omeprazol    10 doses → 0 não tomadas → 100%
 *  - Levotiroxina 25 doses → 2 não tomadas → 92% (5 com atraso)
 *  - Lactulose    15 doses → 2 não tomadas → 87%
 *  - Vitamina D    4 doses → 0 não tomadas → 100%
 */
export const HISTORY_PATTERNS: Record<string, { missed: number[]; late: number[] }> = {
  't-metformina': { missed: [3, 11, 24, 37], late: [7, 30] },
  't-losartana': { missed: [4, 13, 20], late: [9, 17] },
  't-atorvastatina': { missed: [1, 4, 7, 10, 13, 16, 18], late: [5, 12] },
  't-omeprazol': { missed: [], late: [6] },
  't-levotiroxina': { missed: [8, 19], late: [2, 5, 11, 15, 22] },
  't-lactulose': { missed: [6, 12], late: [3] },
  't-vitaminad': { missed: [], late: [2] },
};

export function buildHistory(treatment: Treatment, medication: Medication, today: Date): Dose[] {
  const pattern = HISTORY_PATTERNS[treatment.id] ?? { missed: [], late: [] };
  const doses: Dose[] = [];
  const todayKey = toDateKey(today);
  let index = 0;
  for (let day = parseDateTime(treatment.startDate); toDateKey(day) < todayKey; day = addDays(day, 1)) {
    if (!treatment.weekdays.includes(day.getDay())) continue;
    for (const t of treatment.times) {
      const scheduled = withTime(day, t.time);
      let status: DoseStatus = 'CONFIRMADA_NO_HORARIO';
      let confirmed: Date | undefined = addMinutes(scheduled, 2 + ((index * 7) % 12));
      if (pattern.missed.includes(index)) {
        status = 'NAO_TOMADA';
        confirmed = undefined;
      } else if (pattern.late.includes(index)) {
        status = 'CONFIRMADA_COM_ATRASO';
        // Depois do aviso (30 min) e antes do encerramento (aviso + 30 min), como o servidor aceita
        confirmed = addMinutes(scheduled, 31 + ((index * 13) % 29));
      }
      const scheduledAt = toDateTimeKey(scheduled);
      doses.push({
        id: doseId(treatment.id, scheduledAt),
        elderId: medication.elderId,
        medicationId: medication.id,
        treatmentId: treatment.id,
        scheduledAt,
        status,
        confirmedAt: confirmed ? toDateTimeKey(confirmed) : undefined,
        // Algumas confirmadas pelo cuidador, na tela da dose
        confirmedBy: confirmed ? (index % 9 === 4 ? 'CUIDADOR' : 'IDOSO') : undefined,
        timeNote: t.note,
      });
      index += 1;
    }
  }
  return doses;
}
