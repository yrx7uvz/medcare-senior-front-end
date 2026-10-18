import { messageForApiError } from '../../services/errorMessages';
import { AppError, httpError } from '../../services/errors';

const DEFAULT_MESSAGE = 'Não foi possível concluir a operação.';

/** Lê o corpo como JSON; corpo vazio ou que não é JSON vira null (nunca lança). */
export function parseJsonBody(text: string): unknown {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Converte uma resposta de erro da API no AppError do app. Corpo esperado (ErroResponse):
 * { status, erro, codigo, mensagem, campos: [{ campo, mensagem }] }. Corpo ausente ou
 * diferente disso não quebra: vira um erro genérico com o status HTTP.
 */
export function parseApiError(status: number, body: unknown, retryAfterHeader?: string | null): AppError {
  const payload = body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const message = typeof payload.mensagem === 'string' && payload.mensagem.trim() ? payload.mensagem : DEFAULT_MESSAGE;
  const code = typeof payload.codigo === 'string' ? payload.codigo : undefined;
  let fieldErrors: Record<string, string> | undefined;
  if (Array.isArray(payload.campos)) {
    for (const item of payload.campos) {
      if (item && typeof item === 'object' && typeof item.campo === 'string' && typeof item.mensagem === 'string') {
        fieldErrors ??= {};
        // Mais de um erro no mesmo campo: fica o primeiro
        fieldErrors[item.campo] ??= item.mensagem;
      }
    }
  }
  const retry = Number(retryAfterHeader);
  const retryAfterSec = Number.isFinite(retry) && retry > 0 ? retry : undefined;
  return httpError(status, messageForApiError(code, message, retryAfterSec), code, retryAfterSec, fieldErrors);
}
