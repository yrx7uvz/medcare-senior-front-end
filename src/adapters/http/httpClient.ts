import { getApiBaseUrl } from '../../config/env';
import { invalidateQueries } from '../../lib/queryBus';
import { recordServerDate } from '../../lib/serverClock';
import { AppError, networkError, timeoutError } from '../../services/errors';
import { parseApiError, parseJsonBody } from './apiError';

/**
 * Cliente HTTP para a API Spring Boot. Cada adapter HTTP implementa a interface
 * de src/services/types.ts usando este cliente. O JWT vem da sessão, nunca de
 * constantes no código.
 */
const TIMEOUT_MS = 15_000;
/**
 * Leituras iguais (mesmo caminho e mesmo token) dentro deste prazo reaproveitam a resposta: várias telas abertas
 * pedem a mesma coisa ao mesmo tempo (painel, alertas, seletor de paciente). Curto o bastante para a atualização de
 * cada minuto sempre ir ao servidor.
 */
const GET_CACHE_MS = 3_000;

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

type TokenProvider = () => string | null;
let getToken: TokenProvider = () => null;
export const setTokenProvider = (fn: TokenProvider) => {
  getToken = fn;
};

/** Quem está usando o aparelho: algumas leituras têm rota diferente para o cuidador e para o paciente. */
export type Viewer = 'CAREGIVER' | 'PATIENT' | null;
let getViewerFn: () => Viewer = () => null;
export const setViewerProvider = (fn: () => Viewer) => {
  getViewerFn = fn;
};
export const getViewer = (): Viewer => getViewerFn();

/** Chamado quando a API responde 401 a uma requisição que ENVIOU token (sessão inválida ou expirada). */
type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;
export const setUnauthorizedHandler = (fn: UnauthorizedHandler | null) => {
  onUnauthorized = fn;
};

const inFlight = new Map<string, Promise<unknown>>();
const recent = new Map<string, { at: number; data: unknown }>();

/** Esquece leituras guardadas (depois de escrita, troca de sessão ou logout). */
export function clearHttpCache() {
  inFlight.clear();
  recent.clear();
}

async function send<T>(method: Method, path: string, body: unknown, token: string | null): Promise<T> {
  // Sem endereço válido: AppError de configuração (rejeita a promessa; não derruba o app)
  const baseUrl = getApiBaseUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const sentAt = Date.now();
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
  recordServerDate(res.headers.get('Date'), sentAt, Date.now());
  // Corpo vazio (204, por exemplo) ou que não é JSON é tolerado
  const data = parseJsonBody(text);
  if (!res.ok) {
    // Só derruba a sessão se havia token: um 401 de login com senha errada não é sessão expirada
    if (res.status === 401 && token) onUnauthorized?.();
    throw parseApiError(res.status, data, res.headers.get('Retry-After'));
  }
  return data as T;
}

/**
 * GET de um arquivo (ex.: o PDF): devolve os bytes. Erros da API (JSON) chegam como AppError, como em request; 401
 * com token derruba a sessão. Prazo maior que o das leituras comuns (o PDF de 12 meses leva alguns segundos).
 */
export async function requestBinary(path: string, accept: string, timeoutMs = 60_000): Promise<Uint8Array> {
  const token = getToken();
  const baseUrl = getApiBaseUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method: 'GET',
      headers: { Accept: `${accept}, application/json`, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      signal: controller.signal,
    });
    if (res.ok) return new Uint8Array(await res.arrayBuffer());
    const data = parseJsonBody(await res.text());
    if (res.status === 401 && token) onUnauthorized?.();
    throw parseApiError(res.status, data, res.headers.get('Retry-After'));
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw controller.signal.aborted ? timeoutError() : networkError();
  } finally {
    clearTimeout(timer);
  }
}

export async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  if (method !== 'GET') {
    try {
      return await send<T>(method, path, body, token);
    } finally {
      // Escrita (com sucesso ou não, o estado no servidor pode ter mudado): leituras guardadas não valem mais e as
      // telas abertas recarregam em segundo plano
      clearHttpCache();
      invalidateQueries();
    }
  }

  const key = `${token ?? ''} ${path}`;
  const cached = recent.get(key);
  if (cached && Date.now() - cached.at < GET_CACHE_MS) return cached.data as T;
  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = send<T>('GET', path, undefined, token).then(
    (data) => {
      // Só guarda se ninguém limpou o cache enquanto a leitura estava em voo (ex.: uma escrita no meio)
      if (inFlight.get(key) === promise) {
        inFlight.delete(key);
        recent.set(key, { at: Date.now(), data });
      }
      return data;
    },
    (e: unknown) => {
      if (inFlight.get(key) === promise) inFlight.delete(key);
      throw e;
    },
  );
  inFlight.set(key, promise);
  return promise;
}

export type { AppError };
