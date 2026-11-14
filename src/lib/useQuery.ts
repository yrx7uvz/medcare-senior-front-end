import { useCallback, useEffect, useRef, useState } from 'react';
import { AppError, toAppError } from '../services/errors';
import { useQueryBus } from './queryBus';

interface QueryState<T> {
  data: T | undefined;
  error: AppError | undefined;
  loading: boolean;
  /** Falha de uma atualização silenciosa quando já havia dados: os dados antigos continuam na tela. */
  refreshError?: AppError;
}

interface Options<T> {
  enabled?: boolean;
  /** Quando muda, recarrega sem mostrar skeleton (ex.: a cada minuto). */
  silentKey?: unknown;
  /**
   * Dado já carregado em outra tela (ex.: a dose que estava na lista): a tela abre com ele, sem skeleton, e a primeira
   * busca é silenciosa. Vale só na montagem; troca de chave volta ao carregamento normal.
   */
  initialData?: T;
}

/** Estado na montagem: com dado inicial, já pronto (sem carregamento); sem, carregando se habilitada. */
export function initialQueryState<T>(enabled: boolean, initialData: T | undefined): QueryState<T> {
  return initialData !== undefined && enabled
    ? { data: initialData, error: undefined, loading: false }
    : { data: undefined, error: undefined, loading: enabled };
}

/**
 * Hook mínimo de leitura. Troca de `key` mostra carregamento; escritas e
 * `silentKey` atualizam mantendo os dados atuais na tela. Se a atualização
 * silenciosa falhar e já houver dados, eles ficam e `refreshError` é exposto.
 */
export function useQuery<T>(key: readonly unknown[], fetcher: () => Promise<T>, options: Options<T> = {}) {
  const { enabled = true, silentKey, initialData } = options;
  const version = useQueryBus((s) => s.version);
  const fetcherRef = useRef(fetcher);
  // Padrão "latest ref": a função mais recente é lida só em callbacks/efeitos. Regra do React Compiler, que o projeto não usa.
  // eslint-disable-next-line react-hooks/refs
  fetcherRef.current = fetcher;
  const keyStr = JSON.stringify(key);
  const silentStr = JSON.stringify(silentKey ?? null);
  const [state, setState] = useState<QueryState<T>>(() => initialQueryState(enabled, initialData));
  const requestId = useRef(0);
  // A primeira busca só é silenciosa se a tela abriu com dado inicial
  const seeded = useRef(initialData !== undefined && enabled);

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
            ? { ...prev, loading: false, refreshError: toAppError(err) }
            : { data: undefined, error: toAppError(err), loading: false },
        );
      },
    );
  }, []);

  useEffect(() => {
    // Busca dados ao montar/trocar a chave (sistema externo)
    if (enabled) {
      run(seeded.current);
      seeded.current = false;
    } else setState({ data: undefined, error: undefined, loading: false });
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

export type MutationResult<R> = { ok: true; data: R } | { ok: false; error: AppError };

/**
 * Escritas: estado de carregamento e erro para botões e formulários.
 * `mutate` devolve undefined em caso de erro (ambíguo para operações que devolvem void);
 * `run` devolve explicitamente se deu certo.
 */
export function useMutation<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AppError | undefined>();
  const fnRef = useRef(fn);
  // Mesmo padrão "latest ref" de useQuery.
  // eslint-disable-next-line react-hooks/refs
  fnRef.current = fn;
  const run = useCallback(async (...args: A): Promise<MutationResult<R>> => {
    setLoading(true);
    setError(undefined);
    try {
      return { ok: true, data: await fnRef.current(...args) };
    } catch (e) {
      const appError = toAppError(e);
      setError(appError);
      return { ok: false, error: appError };
    } finally {
      setLoading(false);
    }
  }, []);
  const mutate = useCallback(async (...args: A): Promise<R | undefined> => {
    const result = await run(...args);
    return result.ok ? result.data : undefined;
  }, [run]);
  return { mutate, run, loading, error, clearError: () => setError(undefined) };
}
