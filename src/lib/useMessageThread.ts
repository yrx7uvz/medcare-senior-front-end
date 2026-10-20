import { useEffect, useMemo, useRef, useState } from 'react';
import { services, toAppError, type AppError } from '../services';
import type { ID, Message, MessageAuthor } from '../types/domain';
import { hasOlderMessages, hasUnreadFrom, MESSAGE_POLL_MS, mergeThread, messageSendError, singleFlight } from './messages';
import { useQuery } from './useQuery';
import { usePolling, useScreenActive } from './useScreenActivity';

/** Páginas mais antigas já carregadas, válidas só para a conversa em `elderId`. */
interface OlderPages {
  elderId: ID;
  items: Message[];
  lastPage: number;
  totalPages: number;
}

/**
 * Conversa de um idoso com o cuidador (UC-010), para os dois papéis: página mais recente com atualização automática
 * só com a tela visível, mensagens mais antigas ao pedir, marca como lidas as recebidas enquanto a tela está aberta
 * e envia sem duplicar no toque duplo.
 */
export function useMessageThread(elderId: ID, viewer: MessageAuthor) {
  const active = useScreenActive();
  const latest = useQuery(['thread', elderId], () => services.messages.listThread(elderId, 0), { enabled: !!elderId });
  usePolling(latest.refresh, MESSAGE_POLL_MS, active && latest.data !== undefined);

  const [older, setOlder] = useState<OlderPages | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState<AppError | null>(null);
  const current = older && older.elderId === elderId ? older : null;
  const messages = useMemo(() => mergeThread(latest.data?.items ?? [], current?.items ?? []), [latest.data, current]);
  const pageInfo = current ? { page: current.lastPage, totalPages: current.totalPages } : latest.data;
  const hasOlder = !!pageInfo && hasOlderMessages(pageInfo);

  async function loadOlder() {
    if (!pageInfo || loadingOlder) return;
    setLoadingOlder(true);
    setOlderError(null);
    try {
      const next = await services.messages.listThread(elderId, pageInfo.page + 1);
      setOlder((prev) => ({
        elderId,
        items: [...(prev && prev.elderId === elderId ? prev.items : []), ...next.items],
        lastPage: next.page,
        totalPages: next.totalPages,
      }));
    } catch (e) {
      setOlderError(toAppError(e));
    } finally {
      setLoadingOlder(false);
    }
  }

  // Lê o que chegou do outro lado enquanto a conversa está na tela (uma marcação por vez)
  const other: MessageAuthor = viewer === 'CUIDADOR' ? 'IDOSO' : 'CUIDADOR';
  const marking = useRef(false);
  useEffect(() => {
    if (!active || marking.current || !hasUnreadFrom(latest.data?.items ?? [], other)) return;
    marking.current = true;
    services.messages
      .markRead(elderId, viewer)
      .catch(() => undefined)
      .finally(() => {
        marking.current = false;
      });
  }, [active, latest.data, elderId, viewer, other]);

  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const sendOnce = useMemo(
    () =>
      singleFlight(async (text: string): Promise<boolean> => {
        setSending(true);
        setSendError(null);
        try {
          await services.messages.send(elderId, viewer, text);
          return true;
        } catch (e) {
          setSendError(messageSendError(toAppError(e)));
          return false;
        } finally {
          setSending(false);
        }
      }),
    [elderId, viewer],
  );

  return {
    messages,
    loading: latest.loading,
    error: latest.error,
    reload: latest.reload,
    hasOlder,
    loadingOlder,
    olderError,
    loadOlder,
    send: sendOnce,
    sending,
    sendError,
  };
}
