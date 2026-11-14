import { apiDateTimeToEpochMs } from '../../lib/apiTime';
import { AppError } from '../../services/errors';
import type { LeaveRequestService } from '../../services/types';
import type { LeaveRequest, LeaveRequestStatus, PendingLeaveRequest } from '../../types/domain';
import { endpoints } from './endpoints';
import { forgetLinkCode } from './HttpPatientService';
import { request } from './httpClient';
import { fromApiId, toApiId } from './ids';

/** PedidoDesconexaoResponseDTO. Datas são LocalDateTime de São Paulo, sem fuso. */
export interface PedidoDesconexaoResponse {
  id: number;
  pacienteId: number;
  status: LeaveRequestStatus;
  criadoEm: string;
  expiraEm: string;
  decididoEm: string | null;
}

/** PedidoDesconexaoPendenteResponseDTO. */
export interface PedidoDesconexaoPendenteResponse {
  id: number;
  pacienteId: number;
  pacienteNome: string;
  criadoEm: string;
  expiraEm: string;
}

const STATUSES: readonly LeaveRequestStatus[] = ['PENDENTE', 'AUTORIZADO', 'RECUSADO', 'EXPIRADO', 'CANCELADO'];

const invalid = () => new AppError('HTTP', 500, 'O servidor devolveu um pedido de saída inválido.');

function epoch(value: string): number {
  const ms = apiDateTimeToEpochMs(value);
  if (ms === null) throw invalid();
  return ms;
}

export function toLeaveRequest(dto: PedidoDesconexaoResponse): LeaveRequest {
  if (!STATUSES.includes(dto.status)) throw invalid();
  return {
    id: fromApiId(dto.id),
    patientId: fromApiId(dto.pacienteId),
    status: dto.status,
    createdAt: epoch(dto.criadoEm),
    expiresAt: epoch(dto.expiraEm),
    decidedAt: dto.decididoEm ? epoch(dto.decididoEm) : undefined,
  };
}

export function toPendingLeaveRequest(dto: PedidoDesconexaoPendenteResponse): PendingLeaveRequest {
  return {
    id: fromApiId(dto.id),
    patientId: fromApiId(dto.pacienteId),
    patientName: dto.pacienteNome,
    createdAt: epoch(dto.criadoEm),
    expiresAt: epoch(dto.expiraEm),
  };
}

async function decide(patientId: string, requestId: string, action: 'autorizar' | 'recusar') {
  const decided = toLeaveRequest(await request<PedidoDesconexaoResponse>('PUT',
    endpoints.decideLeaveRequest(String(toApiId(patientId)), String(toApiId(requestId)), action)));
  // Autorizado: a API inutilizou os códigos não usados do paciente; o guardado em memória também sai
  if (decided.status === 'AUTORIZADO') forgetLinkCode(patientId);
  return decided;
}

export const httpLeaveRequestService: LeaveRequestService = {
  async request() {
    return toLeaveRequest(await request<PedidoDesconexaoResponse>('POST', endpoints.myLeaveRequest));
  },

  async current() {
    try {
      return toLeaveRequest(await request<PedidoDesconexaoResponse>('GET', endpoints.myLeaveRequest));
    } catch (e) {
      // Nunca pediu: não é erro
      if (e instanceof AppError && e.status === 404) return null;
      throw e;
    }
  },

  async cancel() {
    await request<void>('DELETE', endpoints.myLeaveRequest);
  },

  async listPending() {
    const dtos = await request<PedidoDesconexaoPendenteResponse[]>('GET', endpoints.pendingLeaveRequests);
    return dtos.map(toPendingLeaveRequest);
  },

  approve: (patientId, requestId) => decide(patientId, requestId, 'autorizar'),

  deny: (patientId, requestId) => decide(patientId, requestId, 'recusar'),

  async disconnectDevice(patientId) {
    await request<void>('POST', endpoints.disconnectDevice(String(toApiId(patientId))));
    forgetLinkCode(patientId);
  },
};
