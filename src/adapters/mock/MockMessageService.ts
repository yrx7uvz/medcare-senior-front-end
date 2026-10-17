import type { MessageService } from '../../services/types';
import type { Message } from '../../types/domain';
import type { ConversationView } from '../../types/views';
import { httpError } from '../../services/errors';
import { getNow } from '../../lib/clock';
import { toDateTimeKey } from '../../lib/date';
import { uid } from '../../lib/ids';
import { getDb, mutateDb } from '../../mocks/db';
import { simulate } from './simulate';

const MAX_LENGTH = 500;

export const mockMessageService: MessageService = {
  listConversations: () =>
    simulate(() => {
      const db = getDb();
      return db.elders
        .map<ConversationView>((elder) => {
          const thread = db.messages.filter((m) => m.elderId === elder.id).sort((a, b) => a.sentAt.localeCompare(b.sentAt));
          const last = thread[thread.length - 1];
          return {
            elder,
            lastMessage: last ? { text: last.text, sentAt: last.sentAt, from: last.from } : undefined,
            unread: thread.filter((m) => m.from === 'IDOSO' && !m.read).length,
          };
        })
        .sort((a, b) => (b.lastMessage?.sentAt ?? '').localeCompare(a.lastMessage?.sentAt ?? ''));
    }),

  listThread: (elderId) =>
    simulate(() =>
      getDb()
        .messages.filter((m) => m.elderId === elderId)
        .sort((a, b) => a.sentAt.localeCompare(b.sentAt)),
    ),

  send: (elderId, from, text) =>
    simulate(() => {
      const clean = text.trim();
      if (!clean) throw httpError(400, 'Escreva uma mensagem antes de enviar.');
      if (clean.length > MAX_LENGTH) throw httpError(400, `A mensagem pode ter até ${MAX_LENGTH} caracteres.`);
      const message: Message = { id: uid('msg'), elderId, from, text: clean, sentAt: toDateTimeKey(getNow()), read: false };
      mutateDb((db) => {
        db.messages.push(message);
      });
      return message;
    }, -120),

  markRead: (elderId, reader) =>
    simulate(() => {
      const author = reader === 'CUIDADOR' ? 'IDOSO' : 'CUIDADOR';
      const pending = getDb().messages.filter((m) => m.elderId === elderId && m.from === author && !m.read);
      if (!pending.length) return;
      mutateDb(() => {
        pending.forEach((m) => {
          m.read = true;
        });
      });
    }, -200),

  unreadCount: (elderId, reader) =>
    simulate(() => {
      const author = reader === 'CUIDADOR' ? 'IDOSO' : 'CUIDADOR';
      return getDb().messages.filter((m) => (elderId === 'ALL' || m.elderId === elderId) && m.from === author && !m.read).length;
    }, -200),
};
