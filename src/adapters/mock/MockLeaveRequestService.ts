import { getNow } from '../../lib/clock';
import { effectiveStatus } from '../../lib/leaveRequest';
import { httpError } from '../../services/errors';
import type { LeaveRequestService } from '../../services/types';
import type { LeaveRequest, LeaveRequestStatus } from '../../types/domain';
import { uid } from '../../lib/ids';
import { getDb, mutateDb } from '../../mocks/db';
import { simulate } from './simulate';

const VALIDITY_MS = 24 * 3_600_000;
const SESSION_INVALID = 'Sessão inválida. Conecte este aparelho de novo.';

const now = () => getNow().getTime();

/** Pedido gravado com o status valendo agora (um pendente vencido conta como expirado, como na API). */
const seen = (r: LeaveRequest): LeaveRequest => {
  const status = effectiveStatus(r, now());
  return status === r.status ? r : { ...r, status, decidedAt: r.expiresAt };
};

const latestOf = (patientId: string) =>
  [...getDb().leaveRequests].reverse().find((r) => r.patientId === patientId);

const pendingOf = (patientId: string) =>
  getDb().leaveRequests.find((r) => r.patientId === patientId && effectiveStatus(r, now()) === 'PENDENTE');

/** Aparelho desconectado: como a API, qualquer chamada do paciente responde 401 SESSAO_INVALIDA. */
function ensureConnected(patientId: string) {
  if (getDb().disconnectedPatientIds.includes(patientId)) throw httpError(401, SESSION_INVALID, 'SESSAO_INVALIDA');
}

/** Desconecta o aparelho: sessão inválida e códigos não usados inutilizados (o vínculo e os dados continuam). */
function disconnect(patientId: string) {
  mutateDb((d) => {
    if (!d.disconnectedPatientIds.includes(patientId)) d.disconnectedPatientIds.push(patientId);
    d.linkCodes.forEach((c) => {
      if (c.patientId === patientId) c.used = true;
    });
  });
}

function decide(patientId: string, requestId: string, decision: Extract<LeaveRequestStatus, 'AUTORIZADO' | 'RECUSADO'>) {
  const db = getDb();
  if (!db.patients.some((p) => p.id === patientId)) throw httpError(404, 'Paciente não encontrado.');
  const request = db.leaveRequests.find((r) => r.id === requestId && r.patientId === patientId);
  if (!request) throw httpError(404, 'Pedido não encontrado.');
  const status = effectiveStatus(request, now());
  if (status === decision) return seen(request);
  if (status !== 'PENDENTE') throw httpError(409, 'Este pedido já foi decidido, cancelado ou expirou.', 'PEDIDO_ENCERRADO');
  mutateDb(() => {
    request.status = decision;
    request.decidedAt = now();
  });
  if (decision === 'AUTORIZADO') disconnect(patientId);
  return { ...request };
}

export const mockLeaveRequestService: LeaveRequestService = {
  request: (patientId) =>
    simulate(() => {
      ensureConnected(patientId);
      const pending = pendingOf(patientId);
      if (pending) return { ...pending };
      const created: LeaveRequest = { id: uid('ped'), patientId, status: 'PENDENTE', createdAt: now(), expiresAt: now() + VALIDITY_MS };
      mutateDb((d) => {
        // Um pendente vencido deixa de bloquear o novo
        d.leaveRequests.forEach((r) => {
          if (r.patientId === patientId && r.status === 'PENDENTE') Object.assign(r, seen(r));
        });
        d.leaveRequests.push(created);
      });
      return { ...created };
    }),

  current: (patientId) =>
    simulate(() => {
      ensureConnected(patientId);
      const latest = latestOf(patientId);
      return latest ? seen(latest) : null;
    }),

  cancel: (patientId) =>
    simulate(() => {
      ensureConnected(patientId);
      const pending = pendingOf(patientId);
      if (pending) {
        mutateDb(() => {
          pending.status = 'CANCELADO';
          pending.decidedAt = now();
        });
      }
    }),

  listPending: () =>
    simulate(() => {
      const db = getDb();
      return db.leaveRequests
        .filter((r) => effectiveStatus(r, now()) === 'PENDENTE')
        .flatMap((r) => {
          const patient = db.patients.find((p) => p.id === r.patientId);
          return patient ? [{ id: r.id, patientId: r.patientId, patientName: patient.name, createdAt: r.createdAt, expiresAt: r.expiresAt }] : [];
        });
    }),

  approve: (patientId, requestId) => simulate(() => decide(patientId, requestId, 'AUTORIZADO')),

  deny: (patientId, requestId) => simulate(() => decide(patientId, requestId, 'RECUSADO')),

  disconnectDevice: (patientId) =>
    simulate(() => {
      if (!getDb().patients.some((p) => p.id === patientId)) throw httpError(404, 'Paciente não encontrado.');
      const pending = pendingOf(patientId);
      if (pending) {
        mutateDb(() => {
          pending.status = 'AUTORIZADO';
          pending.decidedAt = now();
        });
      }
      disconnect(patientId);
    }),
};

/** Pareamento com um código novo reconecta o aparelho no demo. */
export function reconnectDemoPatient(patientId: string) {
  mutateDb((d) => {
    d.disconnectedPatientIds = d.disconnectedPatientIds.filter((id) => id !== patientId);
  });
}
