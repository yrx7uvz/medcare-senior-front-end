import { MESSAGE_PAGE_SIZE } from '../../lib/messages';
import type { MessageService } from '../../services/types';
import type { ID, Message, MessageAuthor } from '../../types/domain';
import type { ConversationView, MessagePage } from '../../types/views';
import { endpoints } from './endpoints';
import { avatarColorFor } from './HttpElderService';
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
  idosoId: number;
  idosoNome: string;
  ultimaMensagem: { conteudo: string; remetente: MessageAuthor; criadaEm: string } | null;
  naoLidas: number;
}

/** LocalDateTime da API para a chave do app ('AAAA-MM-DDTHH:mm'), sem mudar o fuso. */
const toKey = (value: string) => value.slice(0, 16);

/** A mensagem não traz o idoso: ele vem da conversa pedida. */
export function toMessage(dto: MensagemResponse, elderId: ID): Message {
  return { id: fromApiId(dto.id), elderId, from: dto.remetente, text: dto.conteudo, sentAt: toKey(dto.criadaEm), read: dto.lidaEm !== null };
}

export function toMessagePage(dto: MensagensResponse, elderId: ID): MessagePage {
  return { items: dto.conteudo.map((m) => toMessage(m, elderId)), page: dto.pagina, totalPages: dto.totalPaginas, totalElements: dto.totalElementos };
}

/** A conversa traz só o id e o nome do idoso: o resto do Elder não é usado na lista. */
export function toConversation(dto: ConversaResponse): ConversationView {
  const last = dto.ultimaMensagem;
  return {
    elder: { id: fromApiId(dto.idosoId), caregiverId: '', name: dto.idosoNome, birthDate: '', avatarColor: avatarColorFor(dto.idosoId) },
    lastMessage: last ? { text: last.conteudo, sentAt: toKey(last.criadaEm), from: last.remetente } : undefined,
    unread: dto.naoLidas,
  };
}

/**
 * Mensagens reais na API (UC-010). Quem escreve e quem lê vem do token; o idosoId vai sempre (o cuidador precisa
 * dele; o idoso manda o próprio, que a API confere). Erros chegam como AppError: VALIDACAO (vazia ou longa),
 * SESSAO_INVALIDA, ACESSO_NEGADO e RECURSO_NAO_ENCONTRADO.
 */
export const httpMessageService: MessageService = {
  async listConversations() {
    return (await request<ConversaResponse[]>('GET', endpoints.conversations)).map(toConversation);
  },

  async listThread(elderId, page = 0) {
    return toMessagePage(await request<MensagensResponse>('GET', endpoints.messageThread(String(toApiId(elderId)), page, MESSAGE_PAGE_SIZE)), elderId);
  },

  async send(elderId, _from, text) {
    return toMessage(await request<MensagemResponse>('POST', endpoints.messages, { idosoId: toApiId(elderId), conteudo: text }), elderId);
  },

  async markRead(elderId) {
    return (await request<{ marcadas: number }>('PUT', endpoints.markMessagesRead(String(toApiId(elderId))))).marcadas;
  },

  async unreadCount() {
    return (await request<{ naoLidas: number }>('GET', endpoints.unreadMessages)).naoLidas;
  },
};
