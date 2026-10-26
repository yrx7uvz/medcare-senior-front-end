import type { PatientService } from '../../services/types';
import type { Patient, LinkCode } from '../../types/domain';
import { httpError } from '../../services/errors';
import { getNow } from '../../lib/clock';
import { firstName } from '../../lib/date';
import { uid } from '../../lib/ids';
import { getDb, mutateDb } from '../../mocks/db';
import { simulate } from './simulate';
import { avatarColors } from '../../theme/colors';

const AVATAR_COLORS = avatarColors;
const LINK_CODE_TTL_MS = 24 * 3_600_000; // RN11
const MAX_FAILURES = 5; // RN12
const FAILURE_WINDOW_MS = 15 * 60_000;
const GENERIC_CODE_ERROR = 'Código inválido ou expirado. Confira os números com quem cuida de você.';

/** Falhas de validação do código neste aparelho (tempo real, como o RateLimiter). */
let failures: number[] = [];
export const resetPairingAttempts = () => {
  failures = [];
};

function activeCode(patientId: string): LinkCode | null {
  const now = getNow().getTime();
  return getDb().linkCodes.find((c) => c.patientId === patientId && !c.used && c.expiresAt > now) ?? null;
}

export const mockPatientService: PatientService = {
  list: () => simulate(() => [...getDb().patients].sort((a, b) => a.name.localeCompare(b.name))),

  get: (id) =>
    simulate(() => {
      const patient = getDb().patients.find((e) => e.id === id);
      if (!patient) throw httpError(404, 'Paciente não encontrado.');
      return patient;
    }),

  create: (input) =>
    simulate(() => {
      const db = getDb();
      const name = input.name.trim().replace(/\s+/g, ' ');
      // RN03: mesmo nome (sem diferenciar maiúsculas) e nascimento → 409.
      const duplicate = db.patients.some(
        (e) => e.name.toLowerCase() === name.toLowerCase() && e.birthDate === input.birthDate,
      );
      if (duplicate) {
        throw httpError(409, 'Você já cadastrou um paciente com este nome e data de nascimento.', 'PACIENTE_DUPLICADO');
      }
      const patient: Patient = {
        id: uid('e'),
        caregiverId: db.activeCaregiverId,
        name,
        birthDate: input.birthDate,
        phone: input.phone || undefined,
        avatarColor: AVATAR_COLORS[db.patients.length % AVATAR_COLORS.length],
      };
      mutateDb((d) => {
        d.patients.push(patient);
      });
      return patient;
    }, 300),

  generateLinkCode: (patientId) =>
    simulate(() => {
      const db = getDb();
      if (!db.patients.some((e) => e.id === patientId)) throw httpError(404, 'Paciente não encontrado.');
      const now = getNow().getTime();
      const taken = new Set(db.linkCodes.filter((c) => !c.used && c.expiresAt > now).map((c) => c.code));
      let code = '';
      for (let i = 0; i < 10 && (!code || taken.has(code)); i += 1) {
        code = String(Math.floor(100000 + Math.random() * 900000)); // NOSONAR: só no modo demonstração; o código real vem do backend (SecureRandom)
      }
      const link: LinkCode = { code, patientId, expiresAt: now + LINK_CODE_TTL_MS, used: false };
      mutateDb((d) => {
        d.linkCodes.push(link);
      });
      return link;
    }),

  getActiveLinkCode: (patientId) => simulate(() => activeCode(patientId)),

  /** POST /api/vinculo/validar — RN11 (uso único, 24 h) e RN12 (5 falhas em 15 min). */
  validateLinkCode: (code) =>
    simulate(() => {
      const realNow = Date.now();
      failures = failures.filter((t) => realNow - t < FAILURE_WINDOW_MS);
      if (failures.length >= MAX_FAILURES) {
        const retryAfterSec = Math.ceil((failures[0] + FAILURE_WINDOW_MS - realNow) / 1000);
        throw httpError(429, 'Muitas tentativas. Aguarde para tentar de novo.', 'LIMITE_TENTATIVAS', retryAfterSec);
      }
      const now = getNow().getTime();
      const db = getDb();
      const link = db.linkCodes.find((c) => c.code === code && !c.used && c.expiresAt > now);
      if (!link) {
        failures.push(realNow);
        throw httpError(400, GENERIC_CODE_ERROR, 'CODIGO_INVALIDO');
      }
      mutateDb(() => {
        link.used = true;
      });
      const patient = db.patients.find((e) => e.id === link.patientId)!;
      return { patientId: patient.id, patientName: patient.name, token: `mock.jwt.paciente.${patient.id}` };
    }, 300),

  getProfile: (patientId) =>
    simulate(() => {
      const db = getDb();
      const patient = db.patients.find((e) => e.id === patientId);
      if (!patient) throw httpError(404, 'Paciente não encontrado.');
      const caregiver = db.accounts.find((a) => a.id === db.activeCaregiverId);
      return { patient, caregiverFirstName: firstName(caregiver?.name ?? 'Cuidador') };
    }),
};
