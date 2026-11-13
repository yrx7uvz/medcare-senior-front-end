import type { DateKey, ID } from '../types/domain';

/** Para onde levar o cuidador ao tocar num aviso de dose não confirmada. */
export interface DoseOpenTarget {
  doseId: ID;
  patientId: ID;
  day: DateKey;
}

const ID_RE = /^\d{1,18}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Payload de dados do push do backend (PushNotificadorDeDoseNaoTomadaAdapter): tipo = DOSE_NAO_CONFIRMADA, doseId,
 * pacienteId e data (AAAA-MM-DD, fuso da API), tudo como texto. Qualquer outra coisa é ignorada com segurança (null).
 */
export function parseDosePayload(data: unknown): DoseOpenTarget | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '');
  const doseId = text(d.doseId);
  const patientId = text(d.pacienteId);
  const day = text(d.data);
  if (d.tipo !== 'DOSE_NAO_CONFIRMADA' || !ID_RE.test(doseId) || !ID_RE.test(patientId) || !DAY_RE.test(day)) return null;
  return { doseId, patientId, day };
}

/** Para onde levar o PACIENTE ao tocar num lembrete de dose (local ou o reforço do servidor). */
export interface ReminderOpenTarget {
  doseId: ID;
  day: DateKey;
  /** Paciente do lembrete, quando veio no payload (o do servidor sempre traz; o local também). */
  patientId: ID | null;
}

// IDs da API são numéricos; os do demo são textos como "d-t-losartana-2026-06-05T08:00"
const REMINDER_ID_RE = /^[\w.:-]{1,80}$/;

/**
 * Payload do lembrete de dose: tipo = LEMBRETE_DOSE, doseId, data (AAAA-MM-DD) e pacienteId, tudo como texto (mesmo
 * formato no lembrete agendado no aparelho e no push do PushNotificadorDeLembreteDoPacienteAdapter). Qualquer outra
 * coisa é ignorada com segurança (null).
 */
export function parseReminderPayload(data: unknown): ReminderOpenTarget | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '');
  const doseId = text(d.doseId);
  const day = text(d.data);
  const patientId = text(d.pacienteId);
  if (d.tipo !== 'LEMBRETE_DOSE' || !REMINDER_ID_RE.test(doseId) || !DAY_RE.test(day)) return null;
  return { doseId, day, patientId: REMINDER_ID_RE.test(patientId) ? patientId : null };
}
