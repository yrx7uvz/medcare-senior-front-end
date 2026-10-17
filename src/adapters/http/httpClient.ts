import { AppError, httpError, networkError } from '../../services/errors';

/**
 * Cliente HTTP para a API Spring Boot (ainda não usado). Quando os adapters
 * HTTP forem criados, cada um implementa a interface de src/services/types.ts
 * usando este cliente. O JWT vem da sessão, nunca de constantes no código.
 */
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

type TokenProvider = () => string | null;
let getToken: TokenProvider = () => null;
export const setTokenProvider = (fn: TokenProvider) => {
  getToken = fn;
};

/** Chamado quando a API responde 401 a uma requisição que ENVIOU token (sessão inválida ou expirada). */
type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;
export const setUnauthorizedHandler = (fn: UnauthorizedHandler | null) => {
  onUnauthorized = fn;
};

export async function request<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw networkError();
  }
  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    // Só derruba a sessão se havia token: um 401 de login com senha errada não é sessão expirada
    if (res.status === 401 && token) onUnauthorized?.();
    // ErroResponse da API: { mensagem, codigo? }
    const payload = (data ?? {}) as { mensagem?: string; codigo?: string };
    const retry = Number(res.headers.get('Retry-After')) || undefined;
    throw httpError(res.status, payload.mensagem ?? 'Não foi possível concluir a operação.', payload.codigo, retry);
  }
  return data as T;
}

export type { AppError };
