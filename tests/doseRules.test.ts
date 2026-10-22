import { describe, expect, it } from '@jest/globals';
import { pickNextDose } from '../src/features/elder/nextDose';
import { liveDose } from '../src/lib/doseLive';
import {
  CONFIRM_OPENS_BEFORE_MIN,
  MARGIN_AFTER_ALERT_MIN,
  closesAfterMinutes,
  confirmedByText,
  doseWindow,
  getConfirmability,
  isConfirmed,
  isMissed,
  isRegistered,
  resolveDisplayStatus,
  statusOnConfirm,
  summarize,
  toleranceError,
} from '../src/lib/doseRules';
import type { DoseView } from '../src/types/views';

const HORARIO = new Date(2026, 9, 18, 8, 0);
const minutos = (m: number) => new Date(HORARIO.getTime() + m * 60_000);

describe('status exibido', () => {
  it('dose registrada mostra o status gravado em qualquer momento', () => {
    for (const s of ['CONFIRMADA_NO_HORARIO', 'NAO_TOMADA', 'CONFIRMADA_COM_ATRASO'] as const) {
      expect(resolveDisplayStatus(s, HORARIO, minutos(500), 30)).toBe(s);
    }
  });

  it.each([5, 30, 120])('com tolerância de %i min: ATRASADA depois do aviso e NAO_TOMADA depois de aviso + 30 (limites inclusivos)', (tol) => {
    const encerra = tol + MARGIN_AFTER_ALERT_MIN;
    expect(resolveDisplayStatus('PENDENTE', HORARIO, minutos(-10), tol)).toBe('PENDENTE');
    expect(resolveDisplayStatus('PENDENTE', HORARIO, minutos(tol), tol)).toBe('PENDENTE');
    expect(resolveDisplayStatus('PENDENTE', HORARIO, minutos(tol + 1), tol)).toBe('ATRASADA');
    expect(resolveDisplayStatus('PENDENTE', HORARIO, minutos(encerra), tol)).toBe('ATRASADA');
    expect(resolveDisplayStatus('PENDENTE', HORARIO, minutos(encerra + 1), tol)).toBe('NAO_TOMADA');
  });

  it('a tolerância do cuidador move o aviso e o encerramento', () => {
    expect(closesAfterMinutes(30)).toBe(60);
    expect(closesAfterMinutes(120)).toBe(150);
    expect(resolveDisplayStatus('PENDENTE', HORARIO, minutos(45), 60)).toBe('PENDENTE');
    expect(resolveDisplayStatus('PENDENTE', HORARIO, minutos(61), 60)).toBe('ATRASADA');
    expect(resolveDisplayStatus('PENDENTE', HORARIO, minutos(90), 60)).toBe('ATRASADA');
    expect(resolveDisplayStatus('PENDENTE', HORARIO, minutos(91), 60)).toBe('NAO_TOMADA');
  });
});

describe('janela e confirmabilidade', () => {
  it('janela abre 60 min antes, avisa após a tolerância e encerra 30 min depois do aviso', () => {
    expect(doseWindow(HORARIO, 30)).toEqual({ opensAt: '2026-10-18T07:00', alertAt: '2026-10-18T08:30', closesAt: '2026-10-18T09:00' });
    expect(doseWindow(HORARIO, 5)).toEqual({ opensAt: '2026-10-18T07:00', alertAt: '2026-10-18T08:05', closesAt: '2026-10-18T08:35' });
    expect(doseWindow(HORARIO, 120)).toEqual({ opensAt: '2026-10-18T07:00', alertAt: '2026-10-18T10:00', closesAt: '2026-10-18T10:30' });
  });

  it.each([5, 30, 120])('com tolerância de %i min: muito cedo antes da abertura, encerrada depois do limite e ok nos limites', (tol) => {
    const encerra = closesAfterMinutes(tol);
    expect(getConfirmability('PENDENTE', HORARIO, minutos(-CONFIRM_OPENS_BEFORE_MIN - 1), tol)).toBe('MUITO_CEDO');
    expect(getConfirmability('PENDENTE', HORARIO, minutos(-CONFIRM_OPENS_BEFORE_MIN), tol)).toBe('OK');
    expect(getConfirmability('PENDENTE', HORARIO, minutos(encerra), tol)).toBe('OK');
    expect(getConfirmability('PENDENTE', HORARIO, minutos(encerra + 1), tol)).toBe('ENCERRADA');
    expect(getConfirmability('CONFIRMADA_NO_HORARIO', HORARIO, minutos(0), tol)).toBe('JA_REGISTRADA');
  });

  it('quem confirmou: o primeiro nome do idoso, "você" para o cuidador, ou só a hora', () => {
    expect(confirmedByText('IDOSO', 'José', '08:05')).toBe('Confirmada por José às 08:05');
    expect(confirmedByText('CUIDADOR', 'José', '08:05')).toBe('Confirmada por você às 08:05');
    expect(confirmedByText(undefined, 'José', '08:05')).toBe('Confirmada às 08:05');
  });

  it('confirmação até o aviso (inclusive) é CONFIRMADA_NO_HORARIO, depois é com atraso', () => {
    expect(statusOnConfirm(HORARIO, minutos(30), 30)).toBe('CONFIRMADA_NO_HORARIO');
    expect(statusOnConfirm(HORARIO, minutos(31), 30)).toBe('CONFIRMADA_COM_ATRASO');
  });

  it('tolerância aceita só inteiro de 5 a 120', () => {
    expect(toleranceError(5)).toBeNull();
    expect(toleranceError(120)).toBeNull();
    expect(toleranceError(4)).toMatch(/entre 5 e 120/);
    expect(toleranceError(121)).toMatch(/entre 5 e 120/);
    expect(toleranceError(30.5)).toMatch(/entre 5 e 120/);
  });
});

describe('alertas e resumo do painel', () => {
  it('classifica confirmadas, não confirmadas e registradas', () => {
    expect(isConfirmed('CONFIRMADA_NO_HORARIO') && isConfirmed('CONFIRMADA_COM_ATRASO')).toBe(true);
    expect(isConfirmed('ATRASADA')).toBe(false);
    expect(isMissed('ATRASADA') && isMissed('NAO_TOMADA')).toBe(true);
    expect(isMissed('PENDENTE')).toBe(false);
    expect(isRegistered('NAO_TOMADA')).toBe(true);
    expect(isRegistered('ATRASADA')).toBe(false);
  });

  it('resume os cards do painel', () => {
    expect(summarize(['CONFIRMADA_NO_HORARIO', 'CONFIRMADA_COM_ATRASO', 'ATRASADA', 'NAO_TOMADA', 'PENDENTE'])).toEqual({ confirmed: 2, missed: 2, pending: 1, total: 5 });
    expect(summarize([])).toEqual({ confirmed: 0, missed: 0, pending: 0, total: 0 });
  });
});

const view = (over: Partial<DoseView> = {}): DoseView => ({
  id: '1',
  elderId: '12',
  elderName: 'José',
  medication: { id: '501', elderId: '12', name: 'Losartana', dosage: '50mg', type: 'COMPRIMIDO', appearanceSource: 'MANUAL', createdAt: '' },
  treatmentId: '900',
  scheduledAt: '2026-10-18T08:00',
  storedStatus: 'PENDENTE',
  status: 'PENDENTE',
  doseQuantity: '1 comprimido',
  route: 'Via oral',
  window: { opensAt: '2026-10-18T07:00', alertAt: '2026-10-18T08:30', closesAt: '2026-10-18T09:00' },
  confirmUntil: '2026-10-18T09:00',
  confirmability: 'OK',
  toleranceMinutes: 30,
  ...over,
});

describe('dose ao vivo (janela do servidor)', () => {
  const instante = (key: string) => Date.UTC(2026, 9, 18, Number(key.slice(11, 13)), Number(key.slice(14, 16)));
  const em = (hh: number, mm: number) => Date.UTC(2026, 9, 18, hh, mm);

  it('avança PENDENTE -> ATRASADA -> NAO_TOMADA e a confirmabilidade nos limites exatos', () => {
    expect(liveDose(view({ confirmability: 'MUITO_CEDO' }), em(7, 0), instante).confirmability).toBe('OK');
    expect(liveDose(view(), em(8, 30), instante).status).toBe('PENDENTE');
    expect(liveDose(view(), em(8, 31), instante).status).toBe('ATRASADA');
    expect(liveDose(view(), em(9, 0), instante).status).toBe('ATRASADA');
    const encerrada = liveDose(view(), em(9, 1), instante);
    expect(encerrada.status).toBe('NAO_TOMADA');
    expect(encerrada.confirmability).toBe('ENCERRADA');
  });

  it('nunca volta atrás do servidor nem mexe em dose registrada ou com janela ilegível', () => {
    const atrasada = view({ status: 'ATRASADA' });
    expect(liveDose(atrasada, em(7, 30), instante)).toBe(atrasada);
    const tomada = view({ storedStatus: 'CONFIRMADA_NO_HORARIO', status: 'CONFIRMADA_NO_HORARIO', confirmability: 'JA_REGISTRADA' });
    expect(liveDose(tomada, em(12, 0), instante)).toBe(tomada);
    const ilegivel = view();
    expect(liveDose(ilegivel, em(12, 0), () => null)).toBe(ilegivel);
  });
});

describe('próxima dose do idoso', () => {
  it('atrasada confirmável primeiro, depois a do horário; sem liberada, a próxima ainda cedo', () => {
    const noHorario = view({ id: 'a', scheduledAt: '2026-10-18T08:00' });
    const atrasada = view({ id: 'b', scheduledAt: '2026-10-18T07:30', status: 'ATRASADA' });
    const cedo = view({ id: 'c', scheduledAt: '2026-10-18T20:00', confirmability: 'MUITO_CEDO' });
    const encerrada = view({ id: 'd', status: 'NAO_TOMADA', confirmability: 'ENCERRADA' });
    expect(pickNextDose([noHorario, cedo, atrasada, encerrada])?.id).toBe('b');
    expect(pickNextDose([noHorario, cedo, atrasada], 'b')?.id).toBe('a');
    expect(pickNextDose([cedo, encerrada])?.id).toBe('c');
    expect(pickNextDose([encerrada])).toBeUndefined();
  });
});
