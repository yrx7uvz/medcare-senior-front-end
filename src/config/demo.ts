import { IS_DEMO } from './env';

type DemoModule = typeof import('../adapters/mock/demo');

let cached: DemoModule | null = null;

/**
 * Ponto ÚNICO de acesso aos mocks fora de src/adapters/mock. Fora do modo
 * demonstração devolve null e o módulo de mocks nem é executado (require preguiçoso).
 */
export function getDemo(): DemoModule | null {
  if (!IS_DEMO) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- require preguiçoso de propósito: só carrega os mocks no modo demo
  cached ??= require('../adapters/mock/demo') as DemoModule;
  return cached;
}
