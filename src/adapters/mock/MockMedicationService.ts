import type { MedicationService } from '../../services/types';
import type { Medication, Treatment } from '../../types/domain';
import type { MedicationInput, MedicationView } from '../../types/views';
import { httpError } from '../../services/errors';
import { getNow } from '../../lib/clock';
import { toDateKey, toDateTimeKey } from '../../lib/date';
import { GENERATION_WINDOW_DAYS, generateDoses } from '../../lib/doseGenerator';
import { uid } from '../../lib/ids';
import { isLowStock, isTreatmentActive, scheduleSummary } from '../../lib/medicationMeta';
import { getDb, mutateDb } from '../../mocks/db';
import { simulate } from './simulate';

function toView(m: Medication): MedicationView {
  const db = getDb();
  const treatment = db.treatments.find((t) => t.medicationId === m.id && !t.removedAt);
  return {
    medication: m,
    elderName: db.elders.find((e) => e.id === m.elderId)?.name ?? 'Paciente',
    treatment,
    activeTreatment: isTreatmentActive(treatment, toDateKey(getNow())),
    lowStock: isLowStock(m),
    scheduleSummary: scheduleSummary(treatment),
  };
}

/** Regras do backend repetidas no mock (RN05, RN07, início ≤ fim). */
function validate(input: MedicationInput) {
  if (!input.name.trim() || !input.dosage.trim() || !input.type) {
    throw httpError(400, 'Nome, dosagem e tipo são obrigatórios (RN05).');
  }
  const times = input.treatment.times.map((t) => t.time);
  if (new Set(times).size !== times.length) throw httpError(400, 'Há horários repetidos no mesmo dia (RN07).');
  if (!times.length || !input.treatment.weekdays.length) throw httpError(400, 'Informe dias e horários do tratamento.');
  if (input.treatment.endDate && input.treatment.startDate > input.treatment.endDate) {
    throw httpError(400, 'A data de início não pode ser posterior à data de fim.');
  }
  if (!getDb().elders.some((e) => e.id === input.elderId)) throw httpError(404, 'Paciente não encontrado.');
}

function medicationFields(input: MedicationInput) {
  return {
    elderId: input.elderId,
    name: input.name.trim(),
    dosage: input.dosage.trim(),
    type: input.type,
    shape: input.type === 'COMPRIMIDO' ? input.shape : undefined,
    primaryColor: input.primaryColor,
    secondaryColor: input.secondaryColor,
    lengthMm: input.lengthMm,
    widthMm: input.widthMm,
    imprint: input.imprint?.trim() || undefined,
    hasScore: input.type === 'COMPRIMIDO' ? input.hasScore : false,
    stock: input.stock,
    bulaUrl: input.bulaUrl?.trim() || undefined,
    appearanceSource: input.appearanceSource,
  };
}

/** Apaga só doses PENDENTES futuras; registradas nunca são tocadas (RN08). */
function dropFuturePending(treatmentId: string, now: Date) {
  const nowKey = toDateTimeKey(now);
  mutateDb((db) => {
    db.doses = db.doses.filter((d) => !(d.treatmentId === treatmentId && d.status === 'PENDENTE' && d.scheduledAt > nowKey));
  });
}

function generate(treatment: Treatment, medication: Medication, now: Date) {
  const existing = new Set(getDb().doses.map((d) => d.id));
  const fresh = generateDoses(treatment, medication, now, GENERATION_WINDOW_DAYS, now).filter((d) => !existing.has(d.id));
  mutateDb((db) => {
    db.doses.push(...fresh);
  });
}

export const mockMedicationService: MedicationService = {
  list: (filter) =>
    simulate(() =>
      getDb()
        .medications.filter((m) => !m.removedAt && (filter === 'ALL' || m.elderId === filter))
        .map(toView)
        .sort((a, b) => a.elderName.localeCompare(b.elderName) || a.medication.name.localeCompare(b.medication.name)),
    ),

  get: (id) =>
    simulate(() => {
      const db = getDb();
      const medication = db.medications.find((m) => m.id === id && !m.removedAt);
      if (!medication) throw httpError(404, 'Medicamento não encontrado.');
      return { medication, treatment: db.treatments.find((t) => t.medicationId === id && !t.removedAt) };
    }),

  create: (input) =>
    simulate(() => {
      validate(input);
      const now = getNow();
      const medication: Medication = {
        id: uid('m'),
        createdAt: toDateTimeKey(now),
        ...medicationFields(input),
      };
      const treatment: Treatment = {
        id: uid('t'),
        medicationId: medication.id,
        ...input.treatment,
      };
      mutateDb((db) => {
        db.medications.push(medication);
        db.treatments.push(treatment);
      });
      generate(treatment, medication, now);
      return toView(medication);
    }, 400),

  update: (id, input) =>
    simulate(() => {
      validate(input);
      const now = getNow();
      const db = getDb();
      const index = db.medications.findIndex((m) => m.id === id && !m.removedAt);
      if (index < 0) throw httpError(404, 'Medicamento não encontrado.');
      const medication: Medication = { ...db.medications[index], ...medicationFields(input) };
      const tIndex = db.treatments.findIndex((t) => t.medicationId === id && !t.removedAt);
      const treatment: Treatment = { id: tIndex >= 0 ? db.treatments[tIndex].id : uid('t'), medicationId: id, ...input.treatment };
      mutateDb((d) => {
        d.medications[index] = medication;
        if (tIndex >= 0) d.treatments[tIndex] = treatment;
        else d.treatments.push(treatment);
      });
      // Edição regenera apenas as doses pendentes futuras.
      dropFuturePending(treatment.id, now);
      generate(treatment, medication, now);
      return toView(medication);
    }, 400),

  createTreatment: (medicationId, input) =>
    simulate(() => {
      const now = getNow();
      const medication = getDb().medications.find((m) => m.id === medicationId && !m.removedAt);
      if (!medication) throw httpError(404, 'Medicamento não encontrado.');
      const treatment: Treatment = { id: uid('t'), medicationId, ...input };
      mutateDb((db) => {
        db.treatments.push(treatment);
      });
      generate(treatment, medication, now);
      return toView(medication);
    }, 300),

  remove: (id, { confirmed }) =>
    simulate(() => {
      const now = getNow();
      const db = getDb();
      const medication = db.medications.find((m) => m.id === id && !m.removedAt);
      if (!medication) throw httpError(404, 'Medicamento não encontrado.');
      const treatment = db.treatments.find((t) => t.medicationId === id && !t.removedAt);
      if (isTreatmentActive(treatment, toDateKey(now)) && !confirmed) {
        throw httpError(409, 'Este remédio tem tratamento ativo. Confirme a remoção (RN06).', 'TRATAMENTO_ATIVO');
      }
      const stamp = toDateTimeKey(now);
      mutateDb(() => {
        medication.removedAt = stamp;
        if (treatment) treatment.removedAt = stamp;
      });
      if (treatment) dropFuturePending(treatment.id, now);
    }),
};
