import type { Dose } from '../../types/domain';
import type { DoseView } from '../../types/views';
import { parseDateTime } from '../../lib/date';
import { doseWindow, getConfirmability, resolveDisplayStatus } from '../../lib/doseRules';
import { defaultDoseQuantity, routeLabel } from '../../lib/medicationMeta';
import { getDb } from '../../mocks/db';

/** Monta a visão da dose como a API faria (status resolvido no servidor). */
export function toDoseView(d: Dose, now: Date): DoseView {
  const db = getDb();
  const medication = db.medications.find((m) => m.id === d.medicationId)!;
  const elder = db.elders.find((e) => e.id === d.elderId);
  const treatment = db.treatments.find((t) => t.id === d.treatmentId);
  const scheduled = parseDateTime(d.scheduledAt);
  const tol = db.toleranceMinutes;
  const window = doseWindow(scheduled, tol);
  return {
    id: d.id,
    elderId: d.elderId,
    elderName: elder?.name ?? 'Paciente',
    medication,
    treatmentId: d.treatmentId,
    scheduledAt: d.scheduledAt,
    confirmedAt: d.confirmedAt,
    confirmedBy: d.confirmedBy,
    storedStatus: d.status,
    status: resolveDisplayStatus(d.status, scheduled, now, tol),
    timeNote: d.timeNote,
    doseQuantity: treatment?.doseQuantity || defaultDoseQuantity(medication.type),
    route: routeLabel(medication.type),
    window,
    confirmUntil: window.closesAt,
    confirmability: getConfirmability(d.status, scheduled, now, tol),
    toleranceMinutes: tol,
  };
}
