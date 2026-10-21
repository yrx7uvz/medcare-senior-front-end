import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

/** App em primeiro plano. */
export function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

/** Esta tela está visível: focada na navegação e com o app em primeiro plano. */
export function useScreenActive(): boolean {
  const focused = useIsFocused();
  const appActive = useAppActive();
  return focused && appActive;
}

/**
 * Chama `fn` a cada `intervalMs` só enquanto `enabled` (ex.: a tela de mensagens visível). Pausa no segundo plano e
 * para ao sair da tela; ao voltar, chama de novo na hora.
 */
export function usePolling(fn: () => void, intervalMs: number, enabled: boolean) {
  const fnRef = useRef(fn);
  // Padrão "latest ref": a função mais recente é lida só no timer. Regra do React Compiler, que o projeto não usa.
  // eslint-disable-next-line react-hooks/refs
  fnRef.current = fn;
  const started = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    // Ao (re)ativar, atualiza já; na primeira ativação os dados acabaram de chegar
    if (started.current) fnRef.current();
    started.current = true;
    const id = setInterval(() => fnRef.current(), intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs]);
}

/** Chama `fn` quando o app volta ao primeiro plano (sem atualização periódica). */
export function useRefreshOnAppActive(fn: () => void) {
  const fnRef = useRef(fn);
  // eslint-disable-next-line react-hooks/refs
  fnRef.current = fn;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') fnRef.current();
    });
    return () => sub.remove();
  }, []);
}

/** Chama `fn` quando a tela ganha foco de novo e quando o app volta ao primeiro plano (sem atualização periódica). */
export function useRefreshOnFocus(fn: () => void) {
  const fnRef = useRef(fn);
  // eslint-disable-next-line react-hooks/refs
  fnRef.current = fn;
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) firstFocus.current = false;
      else fnRef.current();
    }, []),
  );
  useRefreshOnAppActive(fn);
}
