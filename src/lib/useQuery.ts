import { useCallback, useEffect, useRef, useState } from 'react';
import { AppError, toAppError } from '../services/errors';
import { useQueryBus } from './queryBus';

interface QueryState<T> {
  data: T | undefined;
  error: AppError | undefined;
  loading: boolean;
}

interface Options {
  enabled?: boolean;
  /** Quando muda, recarrega sem mostrar skeleton (ex.: a cada minuto). */
  silentKey?: unknown;
}

/**
 * Hook mínimo de leitura. Troca de `key` mostra carregamento; escritas e
 * `silentKey` atualizam mantendo os dados atuais na tela.
 */
export function useQuery<T>(key: readonly unknown[], fetcher: () => Promise<T>, options: Options = {}) {
  const { enabled = true, silentKey } = options;
  const version = useQueryBus((s) => s.version);
  const fetcherRef = useRef(fetcher);
  // Padrão "latest ref": a função mais recente é lida só em callbacks/efeitos. Regra do React Compiler, que o projeto não usa.
  // eslint-disable-next-line react-hooks/refs
  fetcherRef.current = fetcher;
  const keyStr = JSON.stringify(key);
  const silentStr = JSON.stringify(silentKey ?? null);
  const [state, setState] = useState<QueryState<T>>({ data: undefined, error: undefined, loading: enabled });
  const requestId = useRef(0);

  const run = useCallback((silent: boolean) => {
    const id = ++requestId.current;
    if (!silent) setState({ data: undefined, error: undefined, loading: true });
    fetcherRef.current().then(
      (data) => {
        if (id === requestId.current) setState({ data, error: undefined, loading: false });
      },
      (err: unknown) => {
        if (id !== requestId.current) return;
        setState((prev) =>
          silent && prev.data !== undefined
            ? { ...prev, loading: false }
            : { data: undefined, error: toAppError(err), loading: false },
        );
      },
    );
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca dados ao montar/trocar a chave (sistema externo); regra do React Compiler
    if (enabled) run(false);
    else setState({ data: undefined, error: undefined, loading: false });
  }, [keyStr, enabled, run]);

  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- atualização silenciosa ao invalidar o cache; regra do React Compiler
    if (enabled) run(true);
  }, [version, silentStr, enabled, run]);

  return { ...state, reload: () => run(false), refresh: () => run(true) };
}

/** Escritas: estado de carregamento e erro para botões e formulários. */
export function useMutation<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AppError | undefined>();
  const fnRef = useRef(fn);
  // Mesmo padrão "latest ref" de useQuery.
  // eslint-disable-next-line react-hooks/refs
  fnRef.current = fn;
  const mutate = useCallback(async (...args: A): Promise<R | undefined> => {
    setLoading(true);
    setError(undefined);
    try {
      return await fnRef.current(...args);
    } catch (e) {
      setError(toAppError(e));
      return undefined;
    } finally {
      setLoading(false);
    }
  }, []);
  return { mutate, loading, error, clearError: () => setError(undefined) };
}
