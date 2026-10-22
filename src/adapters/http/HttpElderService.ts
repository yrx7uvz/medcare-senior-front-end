import { apiDateTimeToEpochMs } from '../../lib/apiTime';
import { firstName } from '../../lib/date';
import { AppError } from '../../services/errors';
import type { ElderService } from '../../services/types';
import type { Elder, LinkCode } from '../../types/domain';
import type { ElderInput, ElderPairing, ElderProfile } from '../../types/views';
import { endpoints } from './endpoints';
import { request } from './httpClient';
import { fromApiId, toApiId } from './ids';
import { avatarColors } from '../../theme/colors';

/** GET/POST /api/idosos (IdosoResponseDTO). */
export interface IdosoResponse {
  id: number;
  nome: string;
  dataNascimento: string;
  telefone: string | null;
  cuidadorId: number;
}

/** POST /api/idosos/{id}/gerar-codigo (CodigoVinculoResponseDTO). expiraEm é LocalDateTime de São Paulo, sem fuso. */
export interface CodigoVinculoResponse {
  codigo: string;
  idosoId: number;
  expiraEm: string;
}

/** POST /api/vinculo/validar (AuthResponseDTO). */
interface AuthResponse {
  token: string;
  tipo: string;
  id: number;
  nome: string;
}

/** GET /api/idosos/me (IdosoAutenticadoResponseDTO). */
interface IdosoAutenticadoResponse {
  id: number;
  nome: string;
  cuidadorNome: string;
}

/** A API não guarda cor: a do avatar sai do ID, para ser a mesma em todas as telas e aberturas. */
const AVATAR_COLORS = avatarColors;
export const avatarColorFor = (apiId: number) => AVATAR_COLORS[Math.abs(apiId) % AVATAR_COLORS.length];

export function toElder(dto: IdosoResponse): Elder {
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
  return { code: dto.codigo, elderId: fromApiId(dto.idosoId), expiresAt, used: false };
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

export const httpElderService: ElderService = {
  async list() {
    const dtos = await request<IdosoResponse[]>('GET', endpoints.elders);
    return dtos.map(toElder);
  },

  async get(id) {
    return toElder(await request<IdosoResponse>('GET', endpoints.elder(String(toApiId(id)))));
  },

  async create(input: ElderInput) {
    const dto = await request<IdosoResponse>('POST', endpoints.elders, {
      nome: input.name.trim().replace(/\s+/g, ' '),
      dataNascimento: input.birthDate,
      telefone: digitsOnly(input.phone),
    });
    return toElder(dto);
  },

  async generateLinkCode(elderId) {
    const link = toLinkCode(await request<CodigoVinculoResponse>('POST', endpoints.generateLinkCode(String(toApiId(elderId)))));
    lastCodes.set(link.elderId, link);
    return link;
  },

  async getActiveLinkCode(elderId) {
    const link = lastCodes.get(elderId);
    if (link && link.expiresAt > Date.now()) return link;
    lastCodes.delete(elderId);
    return null;
  },

  /** Lado do idoso. 400 CODIGO_INVALIDO e 429 LIMITE_TENTATIVAS (Retry-After) chegam como AppError. */
  async validateLinkCode(code): Promise<ElderPairing> {
    const res = await request<AuthResponse>('POST', endpoints.validateLinkCode, { codigo: code.trim() });
    return { elderId: fromApiId(res.id), elderName: res.nome, token: res.token };
  },

  /** Lado do idoso (token do idoso): o elderId vem do token na API; o parâmetro só confere a sessão. */
  async getProfile(elderId): Promise<ElderProfile> {
    const res = await request<IdosoAutenticadoResponse>('GET', endpoints.elderMe);
    const id = fromApiId(res.id);
    if (id !== elderId) throw new AppError('HTTP', 401, 'Sessão inválida. Conecte este aparelho de novo.', 'SESSAO_INVALIDA');
    return {
      // A rota do idoso não devolve nascimento nem cuidadorId: as telas do idoso só usam nome e cor
      elder: { id, caregiverId: '', name: res.nome, birthDate: '', avatarColor: avatarColorFor(res.id) },
      caregiverFirstName: firstName(res.cuidadorNome),
    };
  },
};
