import { describe, expect, it } from '@jest/globals';
import { liveDose } from '../src/lib/doseLive';
import { initialQueryState } from '../src/lib/useQuery';
import type { DoseView } from '../src/types/views';

/**
 * Abrir a dose pelo início do paciente: a tela de confirmação nasce com a dose da lista (sem skeleton, sem o rodapé
 * surgindo depois) e o status não muda só por abrir.
 */

const view = (over: Partial<DoseView> = {}): DoseView => ({
  id: '1',
  patientId: '12',
  patientName: 'José',
  medication: { id: '501', patientId: '12', name: 'Losartana', dosage: '50mg', type: 'COMPRIMIDO', appearanceSource: 'MANUAL', createdAt: '' },
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

const instante = (key: string) => Date.UTC(2026, 9, 18, Number(key.slice(11, 13)), Number(key.slice(14, 16)));
const em = (hh: number, mm: number) => Date.UTC(2026, 9, 18, hh, mm);

describe('estado inicial da consulta', () => {
  it('sem dado inicial: carregando (era o que fazia a tela da dose abrir com skeleton e o rodapé aparecer depois)', () => {
    expect(initialQueryState(true, undefined)).toEqual({ data: undefined, error: undefined, loading: true });
  });

  it('com a dose da lista: pronta no primeiro quadro, sem carregamento', () => {
    const dose = view();
    expect(initialQueryState(true, dose)).toEqual({ data: dose, error: undefined, loading: false });
  });

  it('consulta desabilitada ignora o dado inicial', () => {
    expect(initialQueryState(false, view())).toEqual({ data: undefined, error: undefined, loading: false });
  });
});

describe('status ao abrir a dose', () => {
  it('a dose da lista, recalculada na tela da dose no mesmo instante, não muda (sem "Atrasado" piscando)', () => {
    for (const agora of [em(7, 30), em(8, 30), em(8, 31), em(9, 0), em(9, 1)]) {
      const naLista = liveDose(view(), agora, instante);
      expect(liveDose(naLista, agora, instante)).toBe(naLista);
    }
  });

  it('a resposta do servidor (status do início da janela) não faz a tela voltar atrás do que a lista já mostrava', () => {
    const naLista = liveDose(view(), em(8, 40), instante);
    expect(naLista.status).toBe('ATRASADA');
    // O servidor ainda devolve PENDENTE se o cache dele é do minuto anterior: a tela continua ATRASADA
    const doServidor = liveDose(view({ status: 'PENDENTE' }), em(8, 40), instante);
    expect(doServidor.status).toBe('ATRASADA');
    expect(doServidor.confirmability).toBe(naLista.confirmability);
  });
});
