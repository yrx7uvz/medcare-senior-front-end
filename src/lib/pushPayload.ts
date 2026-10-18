import type { DateKey, ID } from '../types/domain';

/** Para onde levar o cuidador ao tocar num aviso de dose não confirmada. */
export interface DoseOpenTarget {
  doseId: ID;
  elderId: ID;
  day: DateKey;
}

const ID_RE = /^\d{1,18}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Payload de dados do push do backend (PushNotificadorDeDoseNaoTomadaAdapter): tipo = DOSE_NAO_CONFIRMADA, doseId,
 * idosoId e data (AAAA-MM-DD, fuso da API), tudo como texto. Qualquer outra coisa é ignorada com segurança (null).
 */
export function parseDosePayload(data: unknown): DoseOpenTarget | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '');
  const doseId = text(d.doseId);
  const elderId = text(d.idosoId);
  const day = text(d.data);
  if (d.tipo !== 'DOSE_NAO_CONFIRMADA' || !ID_RE.test(doseId) || !ID_RE.test(elderId) || !DAY_RE.test(day)) return null;
  return { doseId, elderId, day };
}
