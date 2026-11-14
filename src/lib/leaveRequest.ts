import type { ID, LeaveRequest, LeaveRequestStatus } from '../types/domain';

/**
 * Saída da conta do paciente com autorização do cuidador: regras puras usadas pelas telas (o paciente pede e espera;
 * o cuidador autoriza ou recusa). As telas só desenham o estado que sai daqui.
 */

/** Consulta do pedido enquanto a tela de espera está aberta e o app em primeiro plano. */
export const LEAVE_POLL_MS = 5_000;

export const LEAVE_MESSAGES = {
  explanation: 'Para sair, o seu cuidador precisa autorizar. Vamos avisá-lo agora.',
  authorized: 'Você saiu da conta com a autorização do seu cuidador.',
  denied: 'Seu cuidador não autorizou. Você continua conectado.',
  expired: 'O pedido expirou. Você pode pedir de novo.',
  cancelled: 'Pedido cancelado. Você continua conectado.',
  network: 'Não foi possível falar com o servidor. Confira a internet e tente de novo.',
} as const;

export const waitingTitle = (caregiverName: string) => `Aguardando autorização de ${caregiverName}`;
export const pendingCardTitle = (patientName: string) => `${patientName} pediu para sair da conta`;
export const AUTHORIZE_CONFIRM_MESSAGE =
  'O celular do paciente será desconectado. Para ele voltar a usar o app, você vai precisar gerar um código novo.';
export const DISCONNECT_CONFIRM_MESSAGE =
  'O celular do paciente sai da conta agora. Os remédios e o histórico continuam. Para ele voltar, gere um código novo.';

/**
 * Status valendo agora: um pendente que passou do prazo já conta como expirado (como na API, antes do job marcar).
 * Vence exatamente em expiresAt.
 */
export function effectiveStatus(request: Pick<LeaveRequest, 'status' | 'expiresAt'>, nowMs: number): LeaveRequestStatus {
  return request.status === 'PENDENTE' && nowMs >= request.expiresAt ? 'EXPIRADO' : request.status;
}

/** O que a tela de saída do paciente mostra. */
export type LeaveView =
  | { kind: 'explicar' }
  | { kind: 'aguardando' }
  | { kind: 'saiu' }
  | { kind: 'recusado'; message: string }
  | { kind: 'expirado'; message: string }
  | { kind: 'cancelado'; message: string }
  | { kind: 'erro-rede'; message: string };

interface LeaveErrorLike {
  kind?: string;
  status?: number;
  code?: string;
}

/**
 * Do resultado da consulta (ou do pedido) ao que a tela mostra.
 *
 * - sem pedido (404 ou null): explicação e o botão de pedir;
 * - 401 (a API invalidou a sessão do aparelho): a autorização chegou; saída limpa, sem tela de erro;
 * - falha de rede ou do servidor: mensagem amigável com "Tentar de novo";
 * - pedido: conforme o status valendo agora.
 */
export function leaveViewFrom(result: { request?: LeaveRequest | null; error?: LeaveErrorLike | null }, nowMs: number): LeaveView {
  const { request, error } = result;
  if (error) {
    if (error.status === 401) return { kind: 'saiu' };
    if (error.status === 404 || error.code === 'RECURSO_NAO_ENCONTRADO') return { kind: 'explicar' };
    return { kind: 'erro-rede', message: LEAVE_MESSAGES.network };
  }
  if (!request) return { kind: 'explicar' };
  switch (effectiveStatus(request, nowMs)) {
    case 'PENDENTE':
      return { kind: 'aguardando' };
    case 'AUTORIZADO':
      return { kind: 'saiu' };
    case 'RECUSADO':
      return { kind: 'recusado', message: LEAVE_MESSAGES.denied };
    case 'EXPIRADO':
      return { kind: 'expirado', message: LEAVE_MESSAGES.expired };
    case 'CANCELADO':
      return { kind: 'cancelado', message: LEAVE_MESSAGES.cancelled };
  }
}

/** Ao abrir a tela: um pedido já decidido antes (recusado, vencido, cancelado) não é notícia; volta à explicação. */
export function initialLeaveView(view: LeaveView): LeaveView {
  return view.kind === 'aguardando' || view.kind === 'saiu' || view.kind === 'erro-rede' ? view : { kind: 'explicar' };
}

/** Consulta periódica só enquanto espera a decisão. */
export const shouldPollLeave = (view: LeaveView) => view.kind === 'aguardando';

/** Mensagem da tela de pareamento quando a API desconecta o aparelho do paciente. */
export function patientDisconnectedFlash(leaveRequested: boolean, genericMessage: string): string {
  return leaveRequested ? LEAVE_MESSAGES.authorized : genericMessage;
}

/** Para onde levar o cuidador ao tocar no aviso de pedido de saída. */
export interface LeaveOpenTarget {
  patientId: ID;
  requestId: ID;
}

const ID_RE = /^\d{1,18}$/;

/**
 * Payload de dados do push do backend (PushNotificadorDePedidoDeDesconexaoAdapter): tipo = PEDIDO_DESCONEXAO, pacienteId
 * e pedidoId como texto. Qualquer outra coisa é ignorada com segurança (null).
 */
export function parseLeavePayload(data: unknown): LeaveOpenTarget | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '');
  const patientId = text(d.pacienteId);
  const requestId = text(d.pedidoId);
  if (d.tipo !== 'PEDIDO_DESCONEXAO' || !ID_RE.test(patientId) || !ID_RE.test(requestId)) return null;
  return { patientId, requestId };
}
