import { describe, expect, it } from '@jest/globals';
import { toLeaveRequest, toPendingLeaveRequest } from '../src/adapters/http/HttpLeaveRequestService';
import {
  effectiveStatus,
  initialLeaveView,
  LEAVE_MESSAGES,
  leaveViewFrom,
  parseLeavePayload,
  patientDisconnectedFlash,
  pendingCardTitle,
  shouldPollLeave,
  waitingTitle,
} from '../src/lib/leaveRequest';
import type { LeaveRequest, LeaveRequestStatus } from '../src/types/domain';

const H = 3_600_000;
const CRIADO = Date.UTC(2026, 10, 9, 17, 30);

const pedido = (status: LeaveRequestStatus, expiresAt = CRIADO + 24 * H): LeaveRequest => ({
  id: '7',
  patientId: '10',
  status,
  createdAt: CRIADO,
  expiresAt,
});

describe('status do pedido de saída', () => {
  it('pendente até 23h59 e expirado exatamente em 24h', () => {
    expect(effectiveStatus(pedido('PENDENTE'), CRIADO + 23 * H + 59 * 60_000)).toBe('PENDENTE');
    expect(effectiveStatus(pedido('PENDENTE'), CRIADO + 24 * H - 1)).toBe('PENDENTE');
    expect(effectiveStatus(pedido('PENDENTE'), CRIADO + 24 * H)).toBe('EXPIRADO');
  });

  it('decidido não muda com o tempo', () => {
    expect(effectiveStatus(pedido('RECUSADO'), CRIADO + 48 * H)).toBe('RECUSADO');
    expect(effectiveStatus(pedido('AUTORIZADO'), CRIADO + 48 * H)).toBe('AUTORIZADO');
  });
});

describe('tela de saída do paciente', () => {
  const agora = CRIADO + H;

  it('cada status vira um estado com texto (não só cor)', () => {
    expect(leaveViewFrom({ request: pedido('PENDENTE') }, agora)).toEqual({ kind: 'aguardando' });
    expect(leaveViewFrom({ request: pedido('AUTORIZADO') }, agora)).toEqual({ kind: 'saiu' });
    expect(leaveViewFrom({ request: pedido('RECUSADO') }, agora)).toEqual({ kind: 'recusado', message: 'Seu cuidador não autorizou. Você continua conectado.' });
    expect(leaveViewFrom({ request: pedido('EXPIRADO') }, agora)).toEqual({ kind: 'expirado', message: 'O pedido expirou. Você pode pedir de novo.' });
    expect(leaveViewFrom({ request: pedido('CANCELADO') }, agora).kind).toBe('cancelado');
    expect(leaveViewFrom({ request: pedido('PENDENTE', agora) }, agora).kind).toBe('expirado');
  });

  it('sem pedido mostra a explicação', () => {
    expect(leaveViewFrom({ request: null }, agora)).toEqual({ kind: 'explicar' });
    expect(leaveViewFrom({ error: { status: 404, code: 'RECURSO_NAO_ENCONTRADO' } }, agora)).toEqual({ kind: 'explicar' });
  });

  it('401 da API é a saída autorizada, sem tela de erro', () => {
    expect(leaveViewFrom({ error: { status: 401, code: 'SESSAO_INVALIDA' } }, agora)).toEqual({ kind: 'saiu' });
  });

  it('falha de rede ou do servidor oferece tentar de novo', () => {
    expect(leaveViewFrom({ error: { kind: 'NETWORK', status: 0 } }, agora)).toEqual({ kind: 'erro-rede', message: LEAVE_MESSAGES.network });
    expect(leaveViewFrom({ error: { status: 500 } }, agora).kind).toBe('erro-rede');
  });

  it('ao abrir, decisão antiga não é notícia: volta à explicação', () => {
    expect(initialLeaveView({ kind: 'recusado', message: '' })).toEqual({ kind: 'explicar' });
    expect(initialLeaveView({ kind: 'expirado', message: '' })).toEqual({ kind: 'explicar' });
    expect(initialLeaveView({ kind: 'aguardando' })).toEqual({ kind: 'aguardando' });
    expect(initialLeaveView({ kind: 'saiu' })).toEqual({ kind: 'saiu' });
  });

  it('consulta periódica só enquanto espera', () => {
    expect(shouldPollLeave({ kind: 'aguardando' })).toBe(true);
    for (const kind of ['explicar', 'saiu'] as const) expect(shouldPollLeave({ kind })).toBe(false);
    expect(shouldPollLeave({ kind: 'recusado', message: '' })).toBe(false);
  });

  it('textos', () => {
    expect(LEAVE_MESSAGES.explanation).toBe('Para sair, o seu cuidador precisa autorizar. Vamos avisá-lo agora.');
    expect(waitingTitle('Maria')).toBe('Aguardando autorização de Maria');
    expect(pendingCardTitle('José Souza')).toBe('José Souza pediu para sair da conta');
  });

  it('desconexão da API depois do pedido mostra a mensagem da autorização', () => {
    expect(patientDisconnectedFlash(true, 'genérica')).toBe('Você saiu da conta com a autorização do seu cuidador.');
    expect(patientDisconnectedFlash(false, 'genérica')).toBe('genérica');
  });
});

describe('aviso de pedido de saída (push)', () => {
  it('abre o pedido do paciente', () => {
    expect(parseLeavePayload({ tipo: 'PEDIDO_DESCONEXAO', pacienteId: '10', pedidoId: '7' })).toEqual({ patientId: '10', requestId: '7' });
  });

  it('ignora outro tipo ou IDs inválidos', () => {
    expect(parseLeavePayload({ tipo: 'DOSE_NAO_CONFIRMADA', pacienteId: '10', pedidoId: '7' })).toBeNull();
    expect(parseLeavePayload({ tipo: 'PEDIDO_DESCONEXAO', pacienteId: 'abc', pedidoId: '7' })).toBeNull();
    expect(parseLeavePayload({ tipo: 'PEDIDO_DESCONEXAO', pacienteId: '10' })).toBeNull();
    expect(parseLeavePayload(null)).toBeNull();
  });
});

describe('mapeador do pedido de saída', () => {
  it('converte o pedido da API (horário de São Paulo)', () => {
    const r = toLeaveRequest({ id: 7, pacienteId: 10, status: 'PENDENTE', criadoEm: '2026-11-09T14:30:00', expiraEm: '2026-11-10T14:30:00', decididoEm: null });
    expect(r).toEqual({ id: '7', patientId: '10', status: 'PENDENTE', createdAt: Date.UTC(2026, 10, 9, 17, 30), expiresAt: Date.UTC(2026, 10, 10, 17, 30), decidedAt: undefined });
  });

  it('converte o pendente da lista do cuidador', () => {
    expect(toPendingLeaveRequest({ id: 7, pacienteId: 10, pacienteNome: 'Maria', criadoEm: '2026-11-09T14:30:00', expiraEm: '2026-11-10T14:30:00' }).patientName).toBe('Maria');
  });

  it('recusa status desconhecido', () => {
    expect(() => toLeaveRequest({ id: 7, pacienteId: 10, status: 'OUTRO' as LeaveRequestStatus, criadoEm: '2026-11-09T14:30:00', expiraEm: '2026-11-10T14:30:00', decididoEm: null })).toThrow();
  });
});
