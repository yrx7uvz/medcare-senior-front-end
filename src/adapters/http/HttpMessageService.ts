import { MESSAGE_PAGE_SIZE } from '../../lib/messages';
import type { MessageService } from '../../services/types';
import type { ID, Message, MessageAuthor } from '../../types/domain';
import type { ConversationView, MessagePage } from '../../types/views';
import { endpoints } from './endpoints';
import { avatarColorFor } from './HttpPatientService';
import { request } from './httpClient';
import { fromApiId, toApiId } from './ids';

/** POST e GET /api/mensagens (MensagemResponseDTO). */
export interface MensagemResponse {
  id: number;
  remetente: MessageAuthor;
  conteudo: string;
  criadaEm: string;
  lidaEm: string | null;
}

/** GET /api/mensagens (MensagensResponseDTO). */
export interface MensagensResponse {
  conteudo: MensagemResponse[];
  pagina: number;
  tamanho: number;
  totalElementos: number;
  totalPaginas: number;
}

/** GET /api/mensagens/conversas (ConversaResponseDTO). */
export interface ConversaResponse {
  pacienteId: number;
  pacienteNome: string;
  ultimaMensagem: { conteudo: string; remetente: MessageAuthor; criadaEm: string } | null;
  naoLidas: number;
}

/** LocalDateTime da API para a chave do app ('AAAA-MM-DDTHH:mm'), sem mudar o fuso. */
const toKey = (value: string) => value.slice(0, 16);

/** A mensagem não traz o paciente: ele vem da conversa pedida. */
export function toMessage(dto: MensagemResponse, patientId: ID): Message {
  return { id: fromApiId(dto.id), patientId, from: dto.remetente, text: dto.conteudo, sentAt: toKey(dto.criadaEm), read: dto.lidaEm !== null };
}

export function toMessagePage(dto: MensagensResponse, patientId: ID): MessagePage {
  return { items: dto.conteudo.map((m) => toMessage(m, patientId)), page: dto.pagina, totalPages: dto.totalPaginas, totalElements: dto.totalElementos };
}

/** A conversa traz só o id e o nome do paciente: o resto do Patient não é usado na lista. */
export function toConversation(dto: ConversaResponse): ConversationView {
  const last = dto.ultimaMensagem;
  return {
    patient: { id: fromApiId(dto.pacienteId), caregiverId: '', name: dto.pacienteNome, birthDate: '', avatarColor: avatarColorFor(dto.pacienteId) },
    lastMessage: last ? { text: last.conteudo, sentAt: toKey(last.criadaEm), from: last.remetente } : undefined,
    unread: dto.naoLidas,
  };
}

/**
 * Mensagens reais na API (UC-010). Quem escreve e quem lê vem do token; o pacienteId vai sempre (o cuidador precisa
 * dele; o paciente manda o próprio, que a API confere). Erros chegam como AppError: VALIDACAO (vazia ou longa),
 * SESSAO_INVALIDA, ACESSO_NEGADO e RECURSO_NAO_ENCONTRADO.
 */
export const httpMessageService: MessageService = {
  async listConversations() {
    return (await request<ConversaResponse[]>('GET', endpoints.conversations)).map(toConversation);
  },

  async listThread(patientId, page = 0) {
    return toMessagePage(await request<MensagensResponse>('GET', endpoints.messageThread(String(toApiId(patientId)), page, MESSAGE_PAGE_SIZE)), patientId);
  },

  async send(patientId, _from, text) {
    return toMessage(await request<MensagemResponse>('POST', endpoints.messages, { pacienteId: toApiId(patientId), conteudo: text }), patientId);
  },

  async markRead(patientId) {
    return (await request<{ marcadas: number }>('PUT', endpoints.markMessagesRead(String(toApiId(patientId))))).marcadas;
  },

  async unreadCount() {
    return (await request<{ naoLidas: number }>('GET', endpoints.unreadMessages)).naoLidas;
  },
};
