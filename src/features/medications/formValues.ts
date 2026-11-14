import type { Medication, Treatment } from '../../types/domain';
import type { MedicationInput } from '../../types/views';
import { dateBRToKey, formatDateBR } from '../../lib/date';
import { DEFAULT_PRIMARY } from '../../lib/medicationMeta';
import type { MedicationFormValues } from '../../lib/schemas';
import { IS_TEST_MODE } from '../../config/env';
import { MIN_ADVANCE_MINUTES, TOO_SOON_MESSAGE, firstDoseNotice, firstDoseWhen, newTimes, tooSoonTimes, type LocalNow, type TreatmentSchedule } from '../../lib/treatmentTime';

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

/**
 * Horários do formulário em relação a agora, com a regra da API: `error` quando algum horário de hoje fica a menos
 * de 5 minutos (na edição, só os que não estavam salvos) e `notice` quando os horários de hoje já passaram.
 */
export function scheduleTiming(
  v: Pick<MedicationFormValues, 'startDate' | 'endDate' | 'weekdays' | 'times'>,
  savedTimes: readonly string[],
  now: LocalNow,
): { error: string | null; notice: string | null } {
  const startDate = dateBRToKey(v.startDate);
  if (!startDate) return { error: null, notice: null };
  const schedule: TreatmentSchedule = {
    startDate,
    endDate: (v.endDate && dateBRToKey(v.endDate)) || undefined,
    weekdays: v.weekdays,
    times: v.times.map((t) => t.time),
  };
  return {
    error: tooSoonTimes(schedule, newTimes(schedule.times, savedTimes), now, IS_TEST_MODE ? 0 : MIN_ADVANCE_MINUTES).length
      ? TOO_SOON_MESSAGE
      : null,
    notice: firstDoseNotice(schedule, now),
  };
}

/** Aviso depois de salvar; quando a primeira dose (da resposta) não é hoje, diz quando ela será. */
export function savedMessage(isEdit: boolean, firstDose: { dateKey: string; time: string } | undefined, now: LocalNow): string {
  const base = isEdit ? 'Remédio e tratamento atualizados' : 'Remédio salvo e doses geradas';
  if (!firstDose || firstDose.dateKey === now.dateKey) return base;
  return `${isEdit ? base : 'Remédio salvo'}. A primeira dose será ${firstDoseWhen(firstDose, now)}.`;
}
