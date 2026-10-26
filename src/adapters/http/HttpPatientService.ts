import { apiDateTimeToEpochMs } from '../../lib/apiTime';
import { firstName } from '../../lib/date';
import { AppError } from '../../services/errors';
import type { PatientService } from '../../services/types';
import type { Patient, LinkCode } from '../../types/domain';
import type { PatientInput, PatientPairing, PatientProfile } from '../../types/views';
import { endpoints } from './endpoints';
import { request } from './httpClient';
import { fromApiId, toApiId } from './ids';
import { avatarColors } from '../../theme/colors';

/** GET/POST /api/pacientes (PacienteResponseDTO). */
export interface PacienteResponse {
  id: number;
  nome: string;
  dataNascimento: string;
  telefone: string | null;
  cuidadorId: number;
}

/** POST /api/pacientes/{id}/gerar-codigo (CodigoVinculoResponseDTO). expiraEm é LocalDateTime de São Paulo, sem fuso. */
export interface CodigoVinculoResponse {
  codigo: string;
  pacienteId: number;
  expiraEm: string;
}

/** POST /api/vinculo/validar (AuthResponseDTO). */
interface AuthResponse {
  token: string;
  tipo: string;
  id: number;
  nome: string;
}

/** GET /api/pacientes/me (PacienteAutenticadoResponseDTO). */
interface PacienteAutenticadoResponse {
  id: number;
  nome: string;
  cuidadorNome: string;
}

/** A API não guarda cor: a do avatar sai do ID, para ser a mesma em todas as telas e aberturas. */
const AVATAR_COLORS = avatarColors;
export const avatarColorFor = (apiId: number) => AVATAR_COLORS[Math.abs(apiId) % AVATAR_COLORS.length];

export function toPatient(dto: PacienteResponse): Patient {
  return {
    id: fromApiId(dto.id),
    caregiverId: fromApiId(dto.cuidadorId),
    name: dto.nome,
    birthDate: dto.dataNascimento,
    phone: dto.telefone ?? undefined,
    avatarColor: avatarColorFor(dto.id),
  };
}

export function toLinkCode(dto: CodigoVinculoResponse): LinkCode {
  const expiresAt = apiDateTimeToEpochMs(dto.expiraEm);
  if (expiresAt === null) throw new AppError('HTTP', 500, 'O servidor devolveu um código de vínculo com validade inválida.');
  return { code: dto.codigo, patientId: fromApiId(dto.pacienteId), expiresAt, used: false };
}

/** Telefone só com dígitos (a máscara é da tela; a API guarda até 20 caracteres). */
const digitsOnly = (phone?: string) => phone?.replace(/\D/g, '') || undefined;

/**
 * A API não tem rota para "código ativo": o código só aparece na resposta da geração. Guardamos o
 * último gerado por paciente NESTA abertura do app (só em memória) para a tela continuar mostrando
 * enquanto ele vale; fechar o app esquece, e o cuidador gera outro.
 */
const lastCodes = new Map<string, LinkCode>();
export const forgetLinkCodes = () => lastCodes.clear();

export const httpPatientService: PatientService = {
  async list() {
    const dtos = await request<PacienteResponse[]>('GET', endpoints.patients);
    return dtos.map(toPatient);
  },

  async get(id) {
    return toPatient(await request<PacienteResponse>('GET', endpoints.patient(String(toApiId(id)))));
  },

  async create(input: PatientInput) {
    const dto = await request<PacienteResponse>('POST', endpoints.patients, {
      nome: input.name.trim().replace(/\s+/g, ' '),
      dataNascimento: input.birthDate,
      telefone: digitsOnly(input.phone),
    });
    return toPatient(dto);
  },

  async generateLinkCode(patientId) {
    const link = toLinkCode(await request<CodigoVinculoResponse>('POST', endpoints.generateLinkCode(String(toApiId(patientId)))));
    lastCodes.set(link.patientId, link);
    return link;
  },

  async getActiveLinkCode(patientId) {
    const link = lastCodes.get(patientId);
    if (link && link.expiresAt > Date.now()) return link;
    lastCodes.delete(patientId);
    return null;
  },

  /** Lado do paciente. 400 CODIGO_INVALIDO e 429 LIMITE_TENTATIVAS (Retry-After) chegam como AppError. */
  async validateLinkCode(code): Promise<PatientPairing> {
    const res = await request<AuthResponse>('POST', endpoints.validateLinkCode, { codigo: code.trim() });
    return { patientId: fromApiId(res.id), patientName: res.nome, token: res.token };
  },

  /** Lado do paciente (token do paciente): o patientId vem do token na API; o parâmetro só confere a sessão. */
  async getProfile(patientId): Promise<PatientProfile> {
    const res = await request<PacienteAutenticadoResponse>('GET', endpoints.patientMe);
    const id = fromApiId(res.id);
    if (id !== patientId) throw new AppError('HTTP', 401, 'Sessão inválida. Conecte este aparelho de novo.', 'SESSAO_INVALIDA');
    return {
      // A rota do paciente não devolve nascimento nem cuidadorId: as telas do paciente só usam nome e cor
      patient: { id, caregiverId: '', name: res.nome, birthDate: '', avatarColor: avatarColorFor(res.id) },
      caregiverFirstName: firstName(res.cuidadorNome),
    };
  },
};
