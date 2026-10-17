export type AppErrorKind = 'NETWORK' | 'HTTP';

/**
 * Erro padronizado da camada de serviços. Espelha o ErroResponse da API:
 * status HTTP + mensagem em português + código opcional.
 */
export class AppError extends Error {
  kind: AppErrorKind;
  status: number;
  code?: string;
  retryAfterSec?: number;

  constructor(kind: AppErrorKind, status: number, message: string, code?: string, retryAfterSec?: number) {
    super(message);
    this.name = 'AppError';
    this.kind = kind;
    this.status = status;
    this.code = code;
    this.retryAfterSec = retryAfterSec;
  }
}

export const networkError = () => new AppError('NETWORK', 0, 'Sem conexão com a internet.');
export const httpError = (status: number, message: string, code?: string, retryAfterSec?: number) =>
  new AppError('HTTP', status, message, code, retryAfterSec);

export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  return new AppError('HTTP', 500, 'Não foi possível carregar os dados.');
}
