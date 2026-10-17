import type { Medication, Treatment } from '../../types/domain';
import type { MedicationInput } from '../../types/views';
import { dateBRToKey, formatDateBR } from '../../lib/date';
import { DEFAULT_PRIMARY, DEFAULT_SECONDARY } from '../../lib/medicationMeta';
import { parseMm, type MedicationFormValues } from '../../lib/schemas';

export function emptyMedicationValues(elderId: string, today: Date): MedicationFormValues {
  return {
    elderId,
    name: '',
    dosage: '',
    type: 'COMPRIMIDO',
    shape: 'REDONDO',
    primaryColor: DEFAULT_PRIMARY.COMPRIMIDO,
    secondaryColor: DEFAULT_SECONDARY.COMPRIMIDO,
    lengthMm: '',
    widthMm: '',
    imprint: '',
    hasScore: false,
    stock: '',
    doseQuantity: '',
    leaflet: '',
    appearanceSource: 'MANUAL',
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    times: [{ time: '08:00', note: '' }],
    startDate: formatDateBR(today),
    endDate: '',
  };
}

export function valuesFromMedication(m: Medication, t: Treatment | undefined, today: Date): MedicationFormValues {
  const base = emptyMedicationValues(m.elderId, today);
  return {
    ...base,
    name: m.name,
    dosage: m.dosage,
    type: m.type,
    shape: m.shape ?? 'REDONDO',
    primaryColor: m.primaryColor ?? DEFAULT_PRIMARY[m.type],
    secondaryColor: m.secondaryColor ?? DEFAULT_SECONDARY[m.type],
    lengthMm: m.lengthMm ? String(m.lengthMm) : '',
    widthMm: m.widthMm ? String(m.widthMm) : '',
    imprint: m.imprint ?? '',
    hasScore: !!m.hasScore,
    stock: m.stock !== undefined ? String(m.stock) : '',
    leaflet: m.leaflet ?? '',
    appearanceSource: m.appearanceSource,
    doseQuantity: t?.doseQuantity ?? '',
    weekdays: t?.weekdays ?? base.weekdays,
    times: t?.times.map((x) => ({ time: x.time, note: x.note ?? '' })) ?? base.times,
    startDate: t ? formatDateBR(t.startDate) : base.startDate,
    endDate: t?.endDate ? formatDateBR(t.endDate) : '',
  };
}

export function toMedicationInput(v: MedicationFormValues): MedicationInput {
  const length = parseMm(v.lengthMm);
  const width = v.type === 'COMPRIMIDO' && v.shape === 'REDONDO' ? length : parseMm(v.widthMm);
  return {
    elderId: v.elderId,
    name: v.name,
    dosage: v.dosage,
    type: v.type,
    shape: v.shape,
    primaryColor: v.primaryColor,
    secondaryColor: v.secondaryColor,
    lengthMm: length,
    widthMm: width,
    imprint: v.imprint,
    hasScore: v.hasScore,
    stock: v.stock.trim() === '' ? undefined : Number(v.stock),
    leaflet: v.leaflet,
    appearanceSource: v.appearanceSource,
    treatment: {
      startDate: dateBRToKey(v.startDate)!,
      endDate: v.endDate ? dateBRToKey(v.endDate)! : undefined,
      weekdays: v.weekdays,
      times: v.times.map((t) => ({ time: t.time, note: t.note.trim() || undefined })).sort((a, b) => a.time.localeCompare(b.time)),
      doseQuantity: v.doseQuantity.trim() || undefined,
    },
  };
}
