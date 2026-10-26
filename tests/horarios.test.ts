import { describe, expect, it } from '@jest/globals';
import { medicationFormSchema } from '../src/lib/schemas';
import { DUPLICATE_TIME_MESSAGE, EMPTY_TIMES_MESSAGE, addTime, removeTime } from '../src/lib/timeList';
import {
  indexFromOffset, numberToWords, parseHHmm, spokenTime, stepValue, toHHmm, wheelItemHeight,
} from '../src/lib/timeWheel';
import { emptyMedicationValues } from '../src/features/medications/formValues';

describe('lista de horários do formulário', () => {
  it('adiciona em ordem', () => {
    const r = addTime([{ time: '08:00' }, { time: '20:00' }], '12:30');
    expect(r).toEqual({ times: [{ time: '08:00' }, { time: '12:30' }, { time: '20:00' }], error: null });
  });

  it('remove o horário escolhido (o botão de apagar funciona)', () => {
    expect(removeTime([{ time: '08:00' }, { time: '12:30' }, { time: '20:00' }], '12:30')).toEqual([{ time: '08:00' }, { time: '20:00' }]);
  });

  it('remove o único horário e permite escolher outro; ao salvar, pede ao menos um', () => {
    const vazia = removeTime([{ time: '08:00' }], '08:00');
    expect(vazia).toEqual([]);
    expect(addTime(vazia, '09:15')).toEqual({ times: [{ time: '09:15' }], error: null });

    const semHorario = medicationFormSchema.safeParse({ ...emptyMedicationValues('e1', new Date(2026, 9, 18)), name: 'Losartana', dosage: '50mg', times: [] });
    expect(semHorario.success).toBe(false);
    if (!semHorario.success) expect(semHorario.error.issues.map((i) => i.message)).toContain(EMPTY_TIMES_MESSAGE);
  });

  it('horário repetido não entra e explica o motivo; o formulário também recusa repetidos', () => {
    expect(addTime([{ time: '08:00' }], '08:00')).toEqual({ times: [{ time: '08:00' }], error: DUPLICATE_TIME_MESSAGE });

    const repetido = medicationFormSchema.safeParse({
      ...emptyMedicationValues('e1', new Date(2026, 9, 18)), name: 'Losartana', dosage: '50mg', times: [{ time: '08:00' }, { time: '08:00' }],
    });
    expect(repetido.success).toBe(false);
    if (!repetido.success) expect(repetido.error.issues.map((i) => i.message)).toContain(DUPLICATE_TIME_MESSAGE);
  });

  it('com horários válidos e diferentes o formulário passa', () => {
    const ok = medicationFormSchema.safeParse({
      ...emptyMedicationValues('e1', new Date(2026, 9, 18)), name: 'Losartana', dosage: '50mg', times: [{ time: '08:00' }, { time: '20:00' }],
    });
    expect(ok.success).toBe(true);
  });
});

describe('seletor de horário em rolagem', () => {
  it('passo com volta nas duas pontas', () => {
    expect(stepValue(23, 1, 24)).toBe(0);
    expect(stepValue(0, -1, 24)).toBe(23);
    expect(stepValue(59, 1, 60)).toBe(0);
    expect(stepValue(30, -1, 60)).toBe(29);
  });

  it('encaixa no item mais próximo do centro e não sai da lista', () => {
    expect(indexFromOffset(0, 48, 24)).toBe(0);
    expect(indexFromOffset(48 * 8 + 20, 48, 24)).toBe(8);
    expect(indexFromOffset(48 * 8 + 30, 48, 24)).toBe(9);
    expect(indexFromOffset(-100, 48, 24)).toBe(0);
    expect(indexFromOffset(48 * 99, 48, 24)).toBe(23);
  });

  it('linhas com pelo menos 48 dp, maiores com a fonte ampliada', () => {
    expect(wheelItemHeight(1)).toBe(48);
    expect(wheelItemHeight(0.85)).toBe(48);
    expect(wheelItemHeight(1.5)).toBe(72);
  });

  it('lê e escreve HH:mm', () => {
    expect(parseHHmm('08:30')).toEqual([8, 30]);
    expect(parseHHmm('24:00')).toBeNull();
    expect(parseHHmm('8:30')).toBeNull();
    expect(parseHHmm(undefined)).toBeNull();
    expect(toHHmm(7, 5)).toBe('07:05');
  });

  it('fala o horário por extenso para o leitor de tela', () => {
    expect(spokenTime(8, 30)).toBe('oito horas e trinta minutos');
    expect(spokenTime(1, 1)).toBe('uma hora e um minuto');
    expect(spokenTime(22, 2)).toBe('vinte e duas horas e dois minutos');
    expect(spokenTime(21, 45)).toBe('vinte e uma horas e quarenta e cinco minutos');
    expect(spokenTime(12, 0)).toBe('doze horas em ponto');
    expect(spokenTime(0, 15)).toBe('zero horas e quinze minutos');
    expect(numberToWords(59)).toBe('cinquenta e nove');
  });
});
