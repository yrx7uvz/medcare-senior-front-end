import { describe, expect, it } from '@jest/globals';
import {
  TOO_SOON_MESSAGE,
  firstDoseAfter,
  firstDoseNotice,
  localNowOf,
  newTimes,
  parseFirstDose,
  saoPauloNow,
  tooSoonTimes,
  type LocalNow,
  type TreatmentSchedule,
} from '../src/lib/treatmentTime';
import { savedMessage, scheduleTiming } from '../src/features/medications/formValues';

// 08/10/2026 é uma quinta-feira (4)
const HOJE = '2026-10-08';
const QUINTA = [4];
const agora = (h: number, m: number, s = 0): LocalNow => ({ dateKey: HOJE, weekday: 4, secondsOfDay: h * 3600 + m * 60 + s });
const tratamento = (times: string[], extra: Partial<TreatmentSchedule> = {}): TreatmentSchedule => ({
  startDate: HOJE,
  weekdays: QUINTA,
  times,
  ...extra,
});

describe('antecedência mínima do horário de hoje', () => {
  it('o texto é o mesmo da API', () => {
    expect(TOO_SOON_MESSAGE).toBe(
      'Não é possível cadastrar um horário que seja agora ou daqui a menos de 5 minutos. Escolha um horário com pelo menos 5 minutos de diferença do horário atual.',
    );
  });

  it('o minuto atual é recusado, mesmo com segundos passados', () => {
    expect(tooSoonTimes(tratamento(['10:00']), ['10:00'], agora(10, 0))).toEqual(['10:00']);
    expect(tooSoonTimes(tratamento(['10:00']), ['10:00'], agora(10, 0, 30))).toEqual(['10:00']);
  });

  it('a menos de 5 minutos é recusado; com 5 minutos ou mais, aceito', () => {
    expect(tooSoonTimes(tratamento(['10:04']), ['10:04'], agora(10, 0))).toEqual(['10:04']);
    // 10:00:01 -> 10:05 fica a 4min59s
    expect(tooSoonTimes(tratamento(['10:05']), ['10:05'], agora(10, 0, 1))).toEqual(['10:05']);
    expect(tooSoonTimes(tratamento(['10:05']), ['10:05'], agora(10, 0))).toEqual([]);
    expect(tooSoonTimes(tratamento(['10:06']), ['10:06'], agora(10, 0, 59))).toEqual([]);
  });

  it('horário que já passou hoje é aceito', () => {
    expect(tooSoonTimes(tratamento(['09:59']), ['09:59'], agora(10, 0))).toEqual([]);
  });

  it('início amanhã ou hoje fora dos dias do tratamento não é afetado', () => {
    expect(tooSoonTimes(tratamento(['10:02'], { startDate: '2026-10-09', weekdays: [0, 1, 2, 3, 4, 5, 6] }), ['10:02'], agora(10, 0))).toEqual([]);
    expect(tooSoonTimes(tratamento(['10:02'], { weekdays: [1] }), ['10:02'], agora(10, 0))).toEqual([]);
    expect(tooSoonTimes(tratamento(['10:02'], { startDate: '2026-09-01', endDate: '2026-10-07' }), ['10:02'], agora(10, 0))).toEqual([]);
  });

  it('na edição, só os horários novos contam', () => {
    const salvo = ['10:01', '18:00'];
    const editado = ['10:01', '18:00', '10:03'];
    expect(newTimes(['10:01', '18:00'], salvo)).toEqual([]);
    expect(tooSoonTimes(tratamento(editado), newTimes(['10:01', '18:00'], salvo), agora(10, 0))).toEqual([]);
    expect(tooSoonTimes(tratamento(editado), newTimes(editado, salvo), agora(10, 0))).toEqual(['10:03']);
  });

  it('na virada do dia: 00:02 às 23:58 é horário que já passou hoje', () => {
    expect(tooSoonTimes(tratamento(['00:02'], { weekdays: [4, 5] }), ['00:02'], agora(23, 58))).toEqual([]);
    expect(tooSoonTimes(tratamento(['23:59']), ['23:59'], agora(23, 57))).toEqual(['23:59']);
  });
});

describe('primeira dose e aviso', () => {
  it('ainda há horário hoje: primeira dose hoje e sem aviso', () => {
    const t = tratamento(['08:00', '20:00']);
    expect(firstDoseAfter(t, agora(10, 0))).toEqual({ dateKey: HOJE, time: '20:00' });
    expect(firstDoseNotice(t, agora(10, 0))).toBeNull();
  });

  it('horário de hoje passou: amanhã, com o texto do aviso', () => {
    const t = tratamento(['08:00'], { weekdays: [4, 5] });
    expect(firstDoseAfter(t, agora(10, 0))).toEqual({ dateKey: '2026-10-09', time: '08:00' });
    expect(firstDoseNotice(t, agora(10, 0))).toBe('Este horário de hoje já passou; a primeira dose será amanhã às 08:00.');
    expect(firstDoseNotice(tratamento(['07:00', '08:00'], { weekdays: [4, 5] }), agora(10, 0))).toBe(
      'Os horários de hoje já passaram; a primeira dose será amanhã às 07:00.',
    );
  });

  it('tratamento semanal: a próxima é na semana seguinte', () => {
    const t = tratamento(['08:00']);
    expect(firstDoseAfter(t, agora(10, 0))).toEqual({ dateKey: '2026-10-15', time: '08:00' });
    expect(firstDoseNotice(t, agora(10, 0))).toBe('Este horário de hoje já passou; a primeira dose será na quinta-feira, 15/10, às 08:00.');
    expect(firstDoseNotice(tratamento(['08:00'], { weekdays: [4, 6] }), agora(10, 0))).toBe(
      'Este horário de hoje já passou; a primeira dose será no sábado, 10/10, às 08:00.',
    );
  });

  it('sem aviso quando hoje não tem dose ou o tratamento acaba hoje', () => {
    expect(firstDoseNotice(tratamento(['08:00'], { startDate: '2026-10-09', weekdays: [5] }), agora(10, 0))).toBeNull();
    expect(firstDoseNotice(tratamento(['08:00'], { endDate: HOJE }), agora(10, 0))).toBeNull();
    expect(firstDoseAfter(tratamento(['08:00'], { endDate: HOJE }), agora(10, 0))).toBeNull();
    expect(firstDoseNotice(tratamento([]), agora(10, 0))).toBeNull();
  });

  it('início no futuro: a primeira dose é no início', () => {
    expect(firstDoseAfter(tratamento(['08:00'], { startDate: '2026-11-02', weekdays: [1] }), agora(10, 0))).toEqual({
      dateKey: '2026-11-02',
      time: '08:00',
    });
  });

  it('virada do dia: 00:02 às 23:58 fica para amanhã', () => {
    expect(firstDoseNotice(tratamento(['00:02'], { weekdays: [4, 5] }), agora(23, 58))).toBe(
      'Este horário de hoje já passou; a primeira dose será amanhã às 00:02.',
    );
  });

  it('primeiraDose da API vira dia e hora', () => {
    expect(parseFirstDose('2026-10-09T08:00:00')).toEqual({ dateKey: '2026-10-09', time: '08:00' });
    expect(parseFirstDose(null)).toBeNull();
    expect(parseFirstDose('amanhã')).toBeNull();
  });
});

describe('agora no relógio do tratamento', () => {
  it('em São Paulo (UTC-3), independente do fuso do aparelho', () => {
    // 2026-10-09T01:30Z = 08/10 às 22:30 em São Paulo
    expect(saoPauloNow(Date.UTC(2026, 9, 9, 1, 30, 15))).toEqual({ dateKey: HOJE, weekday: 4, secondsOfDay: 22 * 3600 + 30 * 60 + 15 });
  });

  it('na hora local do relógio do demo', () => {
    expect(localNowOf(new Date(2026, 9, 8, 14, 2, 30))).toEqual({ dateKey: HOJE, weekday: 4, secondsOfDay: 14 * 3600 + 2 * 60 + 30 });
  });
});

describe('formulário de remédio', () => {
  const valores = (times: string[], extra: Partial<{ startDate: string; endDate: string; weekdays: number[] }> = {}) => ({
    startDate: '08/10/2026',
    endDate: '',
    weekdays: QUINTA,
    times: times.map((time) => ({ time })),
    ...extra,
  });

  it('cadastro: horário a menos de 5 minutos dá o erro da API no campo dos horários', () => {
    expect(scheduleTiming(valores(['10:03']), [], agora(10, 0))).toEqual({ error: TOO_SOON_MESSAGE, notice: null });
    expect(scheduleTiming(valores(['10:05']), [], agora(10, 0))).toEqual({ error: null, notice: null });
  });

  it('edição: o horário salvo não bloqueia; o novo, sim', () => {
    expect(scheduleTiming(valores(['10:02']), ['10:02'], agora(10, 0)).error).toBeNull();
    expect(scheduleTiming(valores(['10:02', '10:04']), ['10:02'], agora(10, 0)).error).toBe(TOO_SOON_MESSAGE);
  });

  it('horário de hoje que passou: sem erro e com o aviso da primeira dose', () => {
    expect(scheduleTiming(valores(['08:00'], { weekdays: [4, 5] }), [], agora(10, 0))).toEqual({
      error: null,
      notice: 'Este horário de hoje já passou; a primeira dose será amanhã às 08:00.',
    });
  });

  it('data de início incompleta não valida nem avisa (o próprio campo mostra o erro)', () => {
    expect(scheduleTiming(valores(['10:01'], { startDate: '08/10' }), [], agora(10, 0))).toEqual({ error: null, notice: null });
  });

  it('aviso depois de salvar diz quando é a primeira dose, se não for hoje', () => {
    expect(savedMessage(false, undefined, agora(10, 0))).toBe('Remédio salvo e doses geradas');
    expect(savedMessage(false, { dateKey: HOJE, time: '20:00' }, agora(10, 0))).toBe('Remédio salvo e doses geradas');
    expect(savedMessage(false, { dateKey: '2026-10-09', time: '08:00' }, agora(10, 0))).toBe('Remédio salvo. A primeira dose será amanhã às 08:00.');
    expect(savedMessage(true, { dateKey: '2026-10-15', time: '08:00' }, agora(10, 0))).toBe(
      'Remédio e tratamento atualizados. A primeira dose será na quinta-feira, 15/10, às 08:00.',
    );
  });
});
