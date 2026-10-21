import type { AppError } from '../services/errors';
import type { ID, Message } from '../types/domain';
import type { MessagePage } from '../types/views';

/** Mesmo limite da API (CHECK da tabela mensagem): 1 a 500 caracteres, sem só espaços. */
export const MESSAGE_MAX_LENGTH = 500;
export const MESSAGE_PAGE_SIZE = 20;
/** Atualização automática, só com a tela de mensagens aberta e o app em primeiro plano. */
export const MESSAGE_POLL_MS = 10_000;

/** Caracteres como a API conta (code points: um emoji conta 1). */
export const messageLength = (text: string) => Array.from(text.trim()).length;

/** Erro para mostrar antes de enviar (null = pode enviar). */
export function messageError(text: string): string | null {
  const length = messageLength(text);
  if (length === 0) return 'Escreva uma mensagem antes de enviar.';
  if (length > MESSAGE_MAX_LENGTH) return `A mensagem pode ter até ${MESSAGE_MAX_LENGTH} caracteres.`;
  return null;
}

/**
 * Texto para mostrar quando o envio falha: na validação, o motivo do campo conteudo (a mensagem geral da API é
 * genérica); nos outros códigos (SESSAO_INVALIDA, ACESSO_NEGADO, RECURSO_NAO_ENCONTRADO, rede), a mensagem do erro.
 */
export function messageSendError(error: Pick<AppError, 'code' | 'message' | 'fieldErrors'>): string {
  if (error.code === 'VALIDACAO') return error.fieldErrors?.conteudo ?? error.fieldErrors?.idosoId ?? error.message;
  return error.message;
}

/** Texto do contador ao lado da caixa ("12/500"). */
export const messageCounter = (text: string) => `${messageLength(text)}/${MESSAGE_MAX_LENGTH}`;

/** Selo de não lidas: nada para 0, "99+" acima de 99. */
export const unreadBadge = (n: number): string | undefined => (n <= 0 ? undefined : n > 99 ? '99+' : String(n));

const numericId = (id: ID) => (/^\d+$/.test(id) ? Number(id) : Number.NaN);

/** Ordem da conversa na tela: da mais antiga para a mais nova; no mesmo minuto, pelo id (o mais novo depois). */
export function byConversationOrder(a: Message, b: Message): number {
  const time = a.sentAt.localeCompare(b.sentAt);
  if (time !== 0) return time;
  const na = numericId(a.id);
  const nb = numericId(b.id);
  return Number.isNaN(na) || Number.isNaN(nb) ? a.id.localeCompare(b.id) : na - nb;
}

/**
 * Junta a página mais recente (que a atualização automática troca) com as mais antigas já carregadas, sem repetir
 * mensagem (a versão mais recente vale, por exemplo com lidaEm preenchido), na ordem da tela.
 */
export function mergeThread(latest: Message[], older: Message[]): Message[] {
  const byId = new Map<ID, Message>();
  for (const m of older) byId.set(m.id, m);
  for (const m of latest) byId.set(m.id, m);
  return [...byId.values()].sort(byConversationOrder);
}

/** Há mensagens mais antigas para carregar. */
export const hasOlderMessages = (page: Pick<MessagePage, 'page' | 'totalPages'>) => page.page + 1 < page.totalPages;

/** Há mensagem do outro lado ainda não lida (a tela marca a conversa como lida). */
export const hasUnreadFrom = (messages: readonly Message[], author: Message['from']) => messages.some((m) => m.from === author && !m.read);

/**
 * Uma execução por vez: toques repetidos enquanto a primeira está em andamento recebem a mesma promessa (evita
 * mensagem duplicada no toque duplo).
 */
export function singleFlight<A extends unknown[], R>(fn: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  let current: Promise<R> | null = null;
  return (...args: A) => {
    if (current) return current;
    current = fn(...args).finally(() => {
      current = null;
    });
    return current;
  };
}
