import type { MessageService } from '../../services/types';
import type { Message } from '../../types/domain';
import type { ConversationView } from '../../types/views';
import { httpError } from '../../services/errors';
import { getNow } from '../../lib/clock';
import { toDateTimeKey } from '../../lib/date';
import { uid } from '../../lib/ids';
import { byConversationOrder, MESSAGE_PAGE_SIZE, messageError } from '../../lib/messages';
import { getDb, mutateDb } from '../../mocks/db';
import { simulate } from './simulate';

/** Mesmo contrato de /api/mensagens: conversa paginada da mais recente, validação de 1 a 500 caracteres. */
export const mockMessageService: MessageService = {
  listConversations: () =>
    simulate(() => {
      const db = getDb();
      return db.patients
        .map<ConversationView>((patient) => {
          const thread = db.messages.filter((m) => m.patientId === patient.id).sort((a, b) => a.sentAt.localeCompare(b.sentAt));
          const last = thread[thread.length - 1];
          return {
            patient,
            lastMessage: last ? { text: last.text, sentAt: last.sentAt, from: last.from } : undefined,
            unread: thread.filter((m) => m.from === 'PACIENTE' && !m.read).length,
          };
        })
        .sort((a, b) => (b.lastMessage?.sentAt ?? '').localeCompare(a.lastMessage?.sentAt ?? ''));
    }),

  listThread: (patientId, page = 0) =>
    simulate(() => {
      const all = getDb()
        .messages.filter((m) => m.patientId === patientId)
        .sort((a, b) => byConversationOrder(b, a));
      return {
        items: all.slice(page * MESSAGE_PAGE_SIZE, (page + 1) * MESSAGE_PAGE_SIZE),
        page,
        totalPages: Math.ceil(all.length / MESSAGE_PAGE_SIZE),
        totalElements: all.length,
      };
    }),

  send: (patientId, from, text) =>
    simulate(() => {
      const problem = messageError(text);
      if (problem) throw httpError(400, problem, 'VALIDACAO');
      const message: Message = { id: uid('msg'), patientId, from, text: text.trim(), sentAt: toDateTimeKey(getNow()), read: false };
      mutateDb((db) => {
        db.messages.push(message);
      });
      return message;
    }, -120),

  markRead: (patientId, reader) =>
    simulate(() => {
      const author = reader === 'CUIDADOR' ? 'PACIENTE' : 'CUIDADOR';
      const pending = getDb().messages.filter((m) => m.patientId === patientId && m.from === author && !m.read);
      if (!pending.length) return 0;
      mutateDb(() => {
        pending.forEach((m) => {
          m.read = true;
        });
      });
      return pending.length;
    }, -200),

  unreadCount: (patientId, reader) =>
    simulate(() => {
      const author = reader === 'CUIDADOR' ? 'PACIENTE' : 'CUIDADOR';
      return getDb().messages.filter((m) => (patientId === 'ALL' || m.patientId === patientId) && m.from === author && !m.read).length;
    }, -200),
};
