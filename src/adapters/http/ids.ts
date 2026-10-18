import { AppError } from '../../services/errors';

/**
 * IDs no app são strings opacas (os mocks usam "e-jose", por exemplo); a API usa números.
 * A conversão acontece SÓ nos adapters HTTP, por estas duas funções.
 */

const invalidId = () => new AppError('HTTP', 400, 'Identificador inválido.', 'ID_INVALIDO');

/** "42" -> 42. Recusa vazio, NaN, negativo, fracionário e acima do maior inteiro seguro. */
export function toApiId(id: string): number {
  const text = id.trim();
  if (!/^\d+$/.test(text)) throw invalidId();
  const n = Number(text);
  if (!Number.isSafeInteger(n)) throw invalidId();
  return n;
}

/** 42 -> "42". */
export function fromApiId(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0) throw invalidId();
  return String(n);
}
