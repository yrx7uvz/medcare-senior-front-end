/** NETWORK = sem conexão ou tempo esgotado; HTTP = a API respondeu com erro; CONFIG = app sem endereço da API válido. */
export type AppErrorKind = 'NETWORK' | 'HTTP' | 'CONFIG';

/**
 * Erro padronizado da camada de serviços. Espelha o ErroResponse da API:
 * status HTTP + mensagem em português + código estável + erros por campo.
 */
export class AppError extends Error {
  kind: AppErrorKind;
  status: number;
  code?: string;
  retryAfterSec?: number;
  /** Erros de validação por campo, com os nomes da API (ex.: { email: 'O e-mail informado é inválido' }). */
  fieldErrors?: Record<string, string>;

  constructor(kind: AppErrorKind, status: number, message: string, code?: string, retryAfterSec?: number, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = 'AppError';
    this.kind = kind;
    this.status = status;
    this.code = code;
    this.retryAfterSec = retryAfterSec;
    this.fieldErrors = fieldErrors;
  }
}

export const networkError = () => new AppError('NETWORK', 0, 'Sem conexão com a internet.');
export const timeoutError = () => new AppError('NETWORK', 0, 'A conexão demorou demais. Verifique a internet e tente de novo.');
export const configError = (message: string) => new AppError('CONFIG', 0, message, 'CONFIGURACAO');
export const httpError = (status: number, message: string, code?: string, retryAfterSec?: number, fieldErrors?: Record<string, string>) =>
  new AppError('HTTP', status, message, code, retryAfterSec, fieldErrors);

export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  return new AppError('HTTP', 500, 'Não foi possível carregar os dados.');
}
