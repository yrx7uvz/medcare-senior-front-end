import type { Medication, Treatment } from '../../types/domain';
import type { MedicationInput } from '../../types/views';
import { dateBRToKey, formatDateBR } from '../../lib/date';
import { DEFAULT_PRIMARY } from '../../lib/medicationMeta';
import type { MedicationFormValues } from '../../lib/schemas';

export function emptyMedicationValues(patientId: string, today: Date): MedicationFormValues {
  return {
    patientId,
    name: '',
    dosage: '',
    type: 'COMPRIMIDO',
    shape: 'REDONDO',
    primaryColor: DEFAULT_PRIMARY.COMPRIMIDO,
    stock: '',
    bulaUrl: '',
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    times: [{ time: '08:00' }],
    startDate: formatDateBR(today),
    endDate: '',
  };
}

export function valuesFromMedication(m: Medication, t: Treatment | undefined, today: Date): MedicationFormValues {
  const base = emptyMedicationValues(m.patientId, today);
  return {
    ...base,
    name: m.name,
    dosage: m.dosage,
    type: m.type,
    shape: m.shape ?? 'REDONDO',
    primaryColor: m.primaryColor ?? DEFAULT_PRIMARY[m.type],
    stock: m.stock !== undefined ? String(m.stock) : '',
    bulaUrl: m.bulaUrl ?? '',
    weekdays: t?.weekdays ?? base.weekdays,
    times: t?.times.map((x) => ({ time: x.time })) ?? base.times,
    startDate: t ? formatDateBR(t.startDate) : base.startDate,
    endDate: t?.endDate ? formatDateBR(t.endDate) : '',
  };
}

/** Só o que a API guarda: nome, dosagem, tipo, formato (comprimido), cor, estoque, link da bula e o tratamento. */
export function toMedicationInput(v: MedicationFormValues): MedicationInput {
  return {
    patientId: v.patientId,
    name: v.name,
    dosage: v.dosage,
    type: v.type,
    shape: v.type === 'COMPRIMIDO' ? v.shape : undefined,
    primaryColor: v.primaryColor,
    stock: v.stock.trim() === '' ? undefined : Number(v.stock),
    bulaUrl: v.bulaUrl.trim() || undefined,
    appearanceSource: 'MANUAL',
    treatment: {
      startDate: dateBRToKey(v.startDate)!,
      endDate: v.endDate ? dateBRToKey(v.endDate)! : undefined,
      weekdays: v.weekdays,
      times: v.times.map((t) => ({ time: t.time })).sort((a, b) => a.time.localeCompare(b.time)),
    },
  };
}
