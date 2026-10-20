import { describe, expect, it } from '@jest/globals';
import { pickNextDose } from '../src/features/elder/nextDose';
import { liveDose } from '../src/lib/doseLive';
import {
  CLOSE_AFTER_MIN,
  CONFIRM_OPENS_BEFORE_MIN,
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

describe('status exibido (RN09)', () => {
  it('dose registrada mostra o status gravado em qualquer momento', () => {
    for (const s of ['TOMADA', 'NAO_TOMADA', 'CONFIRMADA_COM_ATRASO'] as const) {
      expect(resolveDisplayStatus(s, HORARIO, minutos(500), 30)).toBe(s);
    }
  });

  it('pendente vira ATRASADA só depois da tolerância e NAO_TOMADA só depois do encerramento (limites inclusivos)', () => {
    expect(resolveDisplayStatus('PENDENTE', HORARIO, minutos(-10), 30)).toBe('PENDENTE');
    expect(resolveDisplayStatus('PENDENTE', HORARIO, minutos(30), 30)).toBe('PENDENTE');
    expect(resolveDisplayStatus('PENDENTE', HORARIO, minutos(31), 30)).toBe('ATRASADA');
    expect(resolveDisplayStatus('PENDENTE', HORARIO, minutos(CLOSE_AFTER_MIN), 30)).toBe('ATRASADA');
    expect(resolveDisplayStatus('PENDENTE', HORARIO, minutos(CLOSE_AFTER_MIN + 1), 30)).toBe('NAO_TOMADA');
  });

  it('a tolerância do cuidador move só o aviso', () => {
    expect(resolveDisplayStatus('PENDENTE', HORARIO, minutos(45), 60)).toBe('PENDENTE');
    expect(resolveDisplayStatus('PENDENTE', HORARIO, minutos(61), 60)).toBe('ATRASADA');
  });
});

describe('janela e confirmabilidade (RN14)', () => {
  it('janela abre 60 min antes, avisa após a tolerância e encerra 180 min depois', () => {
    expect(doseWindow(HORARIO, 30)).toEqual({ opensAt: '2026-10-18T07:00', alertAt: '2026-10-18T08:30', closesAt: '2026-10-18T11:00' });
    expect(doseWindow(HORARIO, 120).alertAt).toBe('2026-10-18T10:00');
  });

  it('muito cedo antes da abertura, encerrada depois do encerramento e ok nos limites', () => {
    expect(getConfirmability('PENDENTE', HORARIO, minutos(-CONFIRM_OPENS_BEFORE_MIN - 1))).toBe('MUITO_CEDO');
    expect(getConfirmability('PENDENTE', HORARIO, minutos(-CONFIRM_OPENS_BEFORE_MIN))).toBe('OK');
    expect(getConfirmability('PENDENTE', HORARIO, minutos(CLOSE_AFTER_MIN))).toBe('OK');
    expect(getConfirmability('PENDENTE', HORARIO, minutos(CLOSE_AFTER_MIN + 1))).toBe('ENCERRADA');
    expect(getConfirmability('TOMADA', HORARIO, minutos(0))).toBe('JA_REGISTRADA');
  });

  it('confirmação até o aviso (inclusive) é TOMADA, depois é com atraso', () => {
    expect(statusOnConfirm(HORARIO, minutos(30), 30)).toBe('TOMADA');
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
    expect(isConfirmed('TOMADA') && isConfirmed('CONFIRMADA_COM_ATRASO')).toBe(true);
    expect(isConfirmed('ATRASADA')).toBe(false);
    expect(isMissed('ATRASADA') && isMissed('NAO_TOMADA')).toBe(true);
    expect(isMissed('PENDENTE')).toBe(false);
    expect(isRegistered('NAO_TOMADA')).toBe(true);
    expect(isRegistered('ATRASADA')).toBe(false);
  });

  it('resume os cards do painel', () => {
    expect(summarize(['TOMADA', 'CONFIRMADA_COM_ATRASO', 'ATRASADA', 'NAO_TOMADA', 'PENDENTE'])).toEqual({ confirmed: 2, missed: 2, pending: 1, total: 5 });
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
  window: { opensAt: '2026-10-18T07:00', alertAt: '2026-10-18T08:30', closesAt: '2026-10-18T11:00' },
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
    const encerrada = liveDose(view(), em(11, 1), instante);
    expect(encerrada.status).toBe('NAO_TOMADA');
    expect(encerrada.confirmability).toBe('ENCERRADA');
  });

  it('nunca volta atrás do servidor nem mexe em dose registrada ou com janela ilegível', () => {
    const atrasada = view({ status: 'ATRASADA' });
    expect(liveDose(atrasada, em(7, 30), instante)).toBe(atrasada);
    const tomada = view({ storedStatus: 'TOMADA', status: 'TOMADA', confirmability: 'JA_REGISTRADA' });
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
