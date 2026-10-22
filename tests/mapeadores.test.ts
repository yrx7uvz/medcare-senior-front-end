import { describe, expect, it } from '@jest/globals';
import { parseApiError, parseJsonBody } from '../src/adapters/http/apiError';
import { toDoseView, toHistoryPage, type DoseResponse } from '../src/adapters/http/HttpDoseService';
import { avatarColorFor, toElder, toLinkCode } from '../src/adapters/http/HttpElderService';
import {
  apiColorToHex,
  toMedicamentoRequest,
  toMedication,
  toTratamentoEdicaoRequest,
  toTratamentoRequest,
  toTreatment,
} from '../src/adapters/http/HttpMedicationService';
import { toDailyReport } from '../src/adapters/http/HttpReportService';
import { fromApiId, toApiId } from '../src/adapters/http/ids';
import { emptyMedicationValues, toMedicationInput, valuesFromMedication } from '../src/features/medications/formValues';
import { dailyTotals } from '../src/lib/dailyReport';
import { historyPath, hasMoreHistory, mergeHistory } from '../src/lib/history';
import {
  describeAppearance,
  isTreatmentActive,
  pickCurrentTreatment,
  scheduleSummary,
  sizeComparison,
  stockLabel,
  weekdaySummary,
} from '../src/lib/medicationMeta';
import { parseNotificationPrefs } from '../src/lib/secureStorage';
import { AppError } from '../src/services/errors';
import type { Treatment } from '../src/types/domain';

const DOSE: DoseResponse = {
  id: 5000,
  idosoId: 12,
  idosoNome: 'José',
  medicamentoId: 501,
  medicamentoNome: 'Losartana',
  dosagem: '50mg',
  tipo: 'COMPRIMIDO',
  cor: '#3D7DCA',
  tratamentoId: 900,
  horarioProgramado: '2026-10-18T08:00:00',
  horaConfirmacao: null,
  status: 'PENDENTE',
  statusExibicao: 'ATRASADA',
  toleranciaMinutos: 30,
  janela: { abreEm: '2026-10-18T07:00:00', avisoEm: '2026-10-18T08:30:00', encerraEm: '2026-10-18T11:00:00' },
  confirmabilidade: 'OK',
};

describe('ids opacos', () => {
  it('string numérica vai e volta; inválidos são recusados', () => {
    expect(toApiId('12')).toBe(12);
    expect(fromApiId(12)).toBe('12');
    for (const ruim of ['abc', '-1', '1.5', '']) expect(() => toApiId(ruim)).toThrow();
  });
});

describe('idoso e código de vínculo', () => {
  it('IdosoResponse vira Elder com cor estável pelo id e telefone opcional', () => {
    const e = toElder({ id: 7, nome: 'Maria', dataNascimento: '1945-03-12', telefone: null, cuidadorId: 1 });
    expect(e).toEqual({ id: '7', caregiverId: '1', name: 'Maria', birthDate: '1945-03-12', phone: undefined, avatarColor: avatarColorFor(7) });
    expect(toElder({ id: 7, nome: 'Maria', dataNascimento: '1945-03-12', telefone: '11999998888', cuidadorId: 1 }).phone).toBe('11999998888');
  });

  it('CodigoVinculoResponse vira LinkCode com validade em São Paulo; validade ilegível é erro', () => {
    expect(toLinkCode({ codigo: '123456', idosoId: 7, expiraEm: '2026-10-19T08:00:00' })).toEqual({
      code: '123456',
      elderId: '7',
      expiresAt: Date.UTC(2026, 9, 19, 11, 0),
      used: false,
    });
    expect(() => toLinkCode({ codigo: '1', idosoId: 7, expiraEm: 'amanhã' })).toThrow(AppError);
  });
});

describe('medicamento e tratamento', () => {
  const dto = { id: 501, nome: 'Losartana', dosagem: '50mg', tipo: 'CAPSULA', formato: 'oval', cor: '#3D7DCA', quantidadeEstoque: 30, bulaUrl: null, idosoId: 12 };

  it('MedicamentoResponse vira Medication; tipo legado e cor fora do padrão são tolerados', () => {
    const m = toMedication(dto);
    expect(m).toMatchObject({ id: '501', elderId: '12', type: 'CAPSULA', shape: 'OVAL', primaryColor: '#3D7DCA', stock: 30, bulaUrl: undefined });
    const legado = toMedication({ ...dto, tipo: 'Comprimido revestido', formato: 'Redondinho', cor: 'Branco', quantidadeEstoque: null });
    expect(legado).toMatchObject({ type: 'COMPRIMIDO', shape: undefined, primaryColor: undefined, stock: undefined });
    expect(apiColorToHex('#abcdef')).toBe('#abcdef');
    expect(apiColorToHex('#abc')).toBeUndefined();
    expect(apiColorToHex(null)).toBeUndefined();
  });

  it('pedido leva só os campos da API, formato só de comprimido e estoque opcional', () => {
    const input = {
      elderId: '12', name: ' Losartana ', dosage: ' 50mg ', type: 'COMPRIMIDO' as const, shape: 'OVAL' as const, primaryColor: 'azul',
      stock: 0, bulaUrl: '  ', appearanceSource: 'MANUAL' as const,
      treatment: { startDate: '2026-10-18', weekdays: [1], times: [{ time: '08:00' }] },
    };
    expect(toMedicamentoRequest(input)).toEqual({
      nome: 'Losartana', dosagem: '50mg', tipo: 'COMPRIMIDO', formato: 'OVAL', cor: undefined, quantidadeEstoque: 0, bulaUrl: undefined, idosoId: 12,
    });
    expect(toMedicamentoRequest({ ...input, type: 'GOTAS', stock: undefined }).formato).toBeUndefined();
  });

  it('tratamento: horários únicos e ordenados, dias em inglês; resposta vira HH:mm e índice', () => {
    const treatment = { startDate: '2026-10-18', endDate: '2026-12-31', weekdays: [5, 1], times: [{ time: '20:00' }, { time: '08:00' }, { time: '08:00' }] };
    expect(toTratamentoRequest(treatment)).toEqual({ dataInicio: '2026-10-18', dataFim: '2026-12-31', horarios: ['08:00', '20:00'], diasSemana: ['MONDAY', 'FRIDAY'] });
    expect(toTratamentoEdicaoRequest({ ...treatment, endDate: undefined })).toEqual({ dataFim: null, horarios: ['08:00', '20:00'], diasSemana: ['MONDAY', 'FRIDAY'] });
    expect(toTreatment({ id: 900, medicamentoId: 501, dataInicio: '2026-10-18', dataFim: null, horarios: ['20:00:00', '08:00:00', 'xx'], diasSemana: ['FRIDAY', 'MONDAY', 'X'] })).toEqual({
      id: '900', medicationId: '501', startDate: '2026-10-18', endDate: undefined, weekdays: [1, 5], times: [{ time: '08:00' }, { time: '20:00' }],
    });
  });

  it('tratamento vigente, resumo de horários e aparência', () => {
    const t = (id: string, endDate?: string): Treatment => ({ id, medicationId: '501', startDate: '2026-01-01', endDate, weekdays: [0, 1, 2, 3, 4, 5, 6], times: [{ time: '08:00' }] });
    expect(isTreatmentActive(t('1', '2026-10-18'), '2026-10-18')).toBe(true);
    expect(isTreatmentActive(t('1', '2026-10-17'), '2026-10-18')).toBe(false);
    expect(pickCurrentTreatment([t('1'), t('2', '2026-01-02')], '2026-10-18')?.id).toBe('1');
    expect(pickCurrentTreatment([t('1', '2026-01-01'), t('2', '2026-01-02')], '2026-10-18')?.id).toBe('2');
    expect(scheduleSummary({ ...t('1'), times: [{ time: '20:00' }, { time: '08:00' }, { time: '14:00' }] })).toBe('08:00, 14:00 e 20:00 • Todos os dias');
    expect(scheduleSummary(undefined)).toBe('Sem tratamento');
    expect(weekdaySummary([1, 2, 3, 4, 5])).toBe('Segunda a sexta');
    expect(weekdaySummary([3, 1])).toBe('Seg, Qua');
    expect(stockLabel({ type: 'GOTAS', stock: 1 })).toBe('1 frasco');
    expect(stockLabel({ type: 'COMPRIMIDO', stock: 30 })).toBe('30 un.');
    expect(stockLabel({ type: 'COMPRIMIDO' })).toBeNull();
    expect(sizeComparison(8)).toBe('do tamanho de um grão de feijão');
    expect(describeAppearance({ type: 'CAPSULA', primaryColor: '#3D7DCA', secondaryColor: '#FFFFFF', lengthMm: 18, hasScore: true })).toBe(
      'Cápsula, azul e branco, cerca de 18 milímetros, com sulco',
    );
  });

  it('formulário: valores do remédio salvo voltam iguais ao pedido', () => {
    const m = toMedication(dto);
    const t = toTreatment({ id: 900, medicamentoId: 501, dataInicio: '2026-10-18', dataFim: null, horarios: ['08:00:00'], diasSemana: ['MONDAY'] });
    const values = valuesFromMedication(m, t, new Date(2026, 9, 18));
    expect(values).toMatchObject({ name: 'Losartana', type: 'CAPSULA', stock: '30', startDate: '18/10/2026', endDate: '', weekdays: [1] });
    expect(toMedicationInput(values)).toMatchObject({ elderId: '12', shape: undefined, stock: 30, treatment: { startDate: '2026-10-18', endDate: undefined, weekdays: [1] } });
    expect(toMedicationInput({ ...emptyMedicationValues('12', new Date(2026, 9, 18)), name: 'X', dosage: 'Y' }).stock).toBeUndefined();
  });
});

describe('dose, relatório e histórico', () => {
  it('DoseResponseDTO vira DoseView com status, janela, confirmabilidade e cor do servidor', () => {
    const v = toDoseView(DOSE);
    expect(v).toMatchObject({
      id: '5000', elderId: '12', elderName: 'José', treatmentId: '900', scheduledAt: '2026-10-18T08:00', confirmedAt: undefined,
      storedStatus: 'PENDENTE', status: 'ATRASADA', confirmability: 'OK', toleranceMinutes: 30, doseQuantity: '1 comprimido', route: 'Via oral',
      window: { opensAt: '2026-10-18T07:00', alertAt: '2026-10-18T08:30', closesAt: '2026-10-18T11:00' },
    });
    expect(v.medication).toMatchObject({ id: '501', name: 'Losartana', dosage: '50mg', type: 'COMPRIMIDO', primaryColor: '#3D7DCA' });
    expect(toDoseView({ ...DOSE, cor: 'Branco', tratamentoId: null, horaConfirmacao: '2026-10-18T08:05:12.5', tipo: 'Legado' })).toMatchObject({
      treatmentId: null, confirmedAt: '2026-10-18T08:05', medication: { primaryColor: undefined, type: 'COMPRIMIDO' },
    });
  });

  it('RelatorioDiarioResponse vira DailyReport com totais e doses', () => {
    const r = toDailyReport({
      idoso: { id: 12, nome: 'José' },
      data: '2026-10-18',
      totais: { total: 4, confirmadasNoHorario: 1, confirmadasComAtraso: 1, naoTomadas: 1, pendentes: 1, aderenciaPercentual: 66.7 },
      doses: [DOSE],
    });
    expect(r.elder).toEqual({ id: '12', name: 'José' });
    expect(r.totals).toEqual({ total: 4, onTime: 1, late: 1, missed: 1, pending: 1, adherencePercent: 66.7 });
    expect(r.doses.map((d) => d.id)).toEqual(['5000']);
    expect(dailyTotals(['CONFIRMADA_NO_HORARIO', 'CONFIRMADA_COM_ATRASO', 'NAO_TOMADA', 'PENDENTE'])).toEqual(r.totals);
    expect(dailyTotals(['PENDENTE']).adherencePercent).toBeNull();
  });

  it('HistoricoResponse vira HistoryPage; caminho com filtros e junção das páginas', () => {
    const page = toHistoryPage({ conteudo: [DOSE, { ...DOSE, id: 4999 }], pagina: 0, tamanho: 2, totalElementos: 3, totalPaginas: 2 });
    expect(page).toMatchObject({ page: 0, size: 2, totalElements: 3, totalPages: 2 });
    expect(page.items.map((d) => d.id)).toEqual(['5000', '4999']);
    expect(hasMoreHistory(page)).toBe(true);
    const next = toHistoryPage({ conteudo: [{ ...DOSE, id: 4999 }, { ...DOSE, id: 4998 }], pagina: 1, tamanho: 2, totalElementos: 3, totalPaginas: 2 });
    expect(mergeHistory(page.items, next.items).map((d) => d.id)).toEqual(['5000', '4999', '4998']);
    expect(hasMoreHistory(next)).toBe(false);
    expect(historyPath('/api/historico', { from: '2026-10-01', to: '2026-10-18', status: 'CONFIRMADA_NO_HORARIO', page: 1, size: 20 })).toBe(
      '/api/historico?de=2026-10-01&ate=2026-10-18&status=CONFIRMADA_NO_HORARIO&page=1&size=20',
    );
  });
});

describe('erros da API e preferências guardadas', () => {
  it('ErroResponse vira AppError com código, campos e Retry-After; corpo estranho vira erro genérico', () => {
    const e = parseApiError(400, { codigo: 'VALIDACAO', mensagem: 'Dados inválidos', campos: [{ campo: 'de', mensagem: 'depois do fim' }] });
    expect(e).toMatchObject({ status: 400, code: 'VALIDACAO', fieldErrors: { de: 'depois do fim' } });
    expect(parseApiError(429, { codigo: 'LIMITE_TENTATIVAS', mensagem: 'x', campos: [] }, '90').retryAfterSec).toBe(90);
    expect(parseApiError(502, '<html>').status).toBe(502);
    expect(parseJsonBody('')).toBeNull();
    expect(parseJsonBody('não json')).toBeNull();
  });

  it('preferências antigas com "estoque baixo" são lidas sem a chave; valor ilegível volta nulo', () => {
    expect(parseNotificationPrefs('{"missedDose":false,"messages":true,"lowStock":true}')).toEqual({ missedDose: false, messages: true });
    expect(parseNotificationPrefs('{"missedDose":true}')).toBeNull();
    expect(parseNotificationPrefs('lixo')).toBeNull();
    expect(parseNotificationPrefs(null)).toBeNull();
  });
});
