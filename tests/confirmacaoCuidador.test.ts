import { describe, expect, it } from '@jest/globals';
import { caregiverConfirmState, confirmFailure, confirmQuestion, doseCardDetail } from '../src/lib/doseConfirm';
import type { DoseView } from '../src/types/views';

const dose = (over: Partial<DoseView> = {}): DoseView => ({
  id: '1',
  elderId: '12',
  elderName: 'José Ferreira',
  medication: { id: '501', elderId: '12', name: 'Losartana', dosage: '50mg', type: 'COMPRIMIDO', appearanceSource: 'MANUAL', createdAt: '' },
  treatmentId: '900',
  scheduledAt: '2026-10-18T08:00',
  storedStatus: 'PENDENTE',
  status: 'PENDENTE',
  doseQuantity: '1 comprimido',
  route: 'Via oral',
  // Tolerância de 45 min no servidor: o limite (09:15) vem pronto, o app não recalcula
  window: { opensAt: '2026-10-18T07:00', alertAt: '2026-10-18T08:45', closesAt: '2026-10-18T09:15' },
  confirmUntil: '2026-10-18T09:15',
  confirmability: 'OK',
  toleranceMinutes: 45,
  ...over,
});

describe('botão "Confirmar dose" do cuidador', () => {
  it('pendente dentro da janela: pode confirmar até o limite que veio do servidor', () => {
    expect(caregiverConfirmState(dose())).toEqual({ kind: 'pode', message: 'Pode ser confirmada até 09:15' });
    expect(caregiverConfirmState(dose({ status: 'ATRASADA' }))).toEqual({ kind: 'pode', message: 'Pode ser confirmada até 09:15' });
  });

  it('antes da abertura: diz quando abre', () => {
    expect(caregiverConfirmState(dose({ confirmability: 'MUITO_CEDO' }))).toEqual({ kind: 'cedo', message: 'A confirmação abre às 07:00' });
  });

  it('depois do limite: diz quando terminou', () => {
    expect(caregiverConfirmState(dose({ confirmability: 'ENCERRADA', status: 'NAO_TOMADA' }))).toEqual({
      kind: 'encerrada',
      message: 'O prazo terminou às 09:15',
    });
    // Exibida como não confirmada pelo relógio da tela, antes de a confirmabilidade mudar
    expect(caregiverConfirmState(dose({ status: 'NAO_TOMADA' })).kind).toBe('encerrada');
  });

  it('registrada: sem botão, com quem confirmou', () => {
    const registrada = { storedStatus: 'CONFIRMADA_NO_HORARIO' as const, status: 'CONFIRMADA_NO_HORARIO' as const, confirmability: 'JA_REGISTRADA' as const };
    expect(caregiverConfirmState(dose({ ...registrada, confirmedAt: '2026-10-18T08:05', confirmedBy: 'IDOSO' }))).toEqual({
      kind: 'registrada',
      message: 'Confirmada por José às 08:05',
    });
    expect(caregiverConfirmState(dose({ ...registrada, confirmedAt: '2026-10-18T08:07', confirmedBy: 'CUIDADOR' }))).toEqual({
      kind: 'registrada',
      message: 'Confirmada por você às 08:07',
    });
    expect(caregiverConfirmState(dose({ storedStatus: 'NAO_TOMADA', status: 'NAO_TOMADA', confirmability: 'JA_REGISTRADA' }))).toEqual({
      kind: 'registrada',
      message: null,
    });
  });

  it('pergunta antes de enviar com nome, remédio e horário', () => {
    expect(confirmQuestion(dose())).toBe('Confirmar que José tomou Losartana das 08:00?');
  });
});

describe('falhas da confirmação pelo cuidador', () => {
  it('409 já registrada, encerrada ou cedo: mensagem clara e a tela recarrega', () => {
    expect(confirmFailure({ kind: 'HTTP', status: 409, code: 'DOSE_JA_REGISTRADA' })).toEqual({
      message: 'Esta dose já foi registrada. Veja abaixo o status atual.',
      reload: true,
    });
    expect(confirmFailure({ kind: 'HTTP', status: 409, code: 'DOSE_ENCERRADA' }).reload).toBe(true);
    expect(confirmFailure({ kind: 'HTTP', status: 409, code: 'DOSE_MUITO_CEDO' }).reload).toBe(true);
    expect(confirmFailure({ kind: 'HTTP', status: 404, code: 'RECURSO_NAO_ENCONTRADO' }).reload).toBe(true);
  });

  it('sem rede: avisa que não foi confirmada, sem recarregar', () => {
    expect(confirmFailure({ kind: 'NETWORK', status: 0 })).toEqual({
      message: 'Sem conexão. A dose não foi confirmada; tente de novo quando a internet voltar.',
      reload: false,
    });
  });

  it('outro erro: a mensagem da API ou uma genérica', () => {
    expect(confirmFailure({ kind: 'HTTP', status: 500, message: 'Erro interno' })).toEqual({ message: 'Erro interno', reload: false });
    expect(confirmFailure({ kind: 'HTTP', status: 500 }).message).toBe('Não foi possível confirmar a dose. Tente de novo.');
  });
});

describe('texto da linha da dose nas listas', () => {
  it('atrasada mostra o aviso e até quando pode ser confirmada; confirmada mostra quem confirmou', () => {
    expect(doseCardDetail(dose({ status: 'ATRASADA' }))).toBe('Aviso enviado às 08:45. Pode ser confirmada até 09:15');
    expect(doseCardDetail(dose())).toBe('Aguardando confirmação');
    expect(doseCardDetail(dose({ status: 'NAO_TOMADA' }))).toBe('Prazo encerrado sem confirmação');
    expect(doseCardDetail(dose({ storedStatus: 'CONFIRMADA_COM_ATRASO', status: 'CONFIRMADA_COM_ATRASO', confirmedAt: '2026-10-18T09:00', confirmedBy: 'CUIDADOR' })))
      .toBe('Confirmada por você às 09:00');
    expect(doseCardDetail(dose({ storedStatus: 'CONFIRMADA_NO_HORARIO', status: 'CONFIRMADA_NO_HORARIO' }))).toBeNull();
  });
});
