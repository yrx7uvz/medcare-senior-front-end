import { getApiBaseUrl } from '../../config/env';
import { AppError, networkError, timeoutError } from '../../services/errors';
import { parseApiError, parseJsonBody } from './apiError';

/**
 * Cliente HTTP para a API Spring Boot. Cada adapter HTTP implementa a interface
 * de src/services/types.ts usando este cliente. O JWT vem da sessão, nunca de
 * constantes no código.
 */
const TIMEOUT_MS = 15_000;

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
  // Sem endereço válido: AppError de configuração (rejeita a promessa; não derruba o app)
  const baseUrl = getApiBaseUrl();
  const token = getToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  let text: string;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    text = await res.text();
  } catch {
    throw controller.signal.aborted ? timeoutError() : networkError();
  } finally {
    clearTimeout(timer);
  }
  // Corpo vazio (204, por exemplo) ou que não é JSON é tolerado
  const data = parseJsonBody(text);
  if (!res.ok) {
    // Só derruba a sessão se havia token: um 401 de login com senha errada não é sessão expirada
    if (res.status === 401 && token) onUnauthorized?.();
    throw parseApiError(res.status, data, res.headers.get('Retry-After'));
  }
  return data as T;
}

export type { AppError };
