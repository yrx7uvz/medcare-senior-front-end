import { useDevStore } from '../../store/devStore';
import { httpError, networkError } from '../../services/errors';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Simula a ida à API: latência, falta de conexão e erro 500, conforme as
 * chaves do menu de desenvolvedor.
 */
export async function simulate<T>(fn: () => T, extraMs = 0): Promise<T> {
  const { offline, simulateError, slow } = useDevStore.getState();
  await sleep((slow ? 1800 : 280) + Math.random() * 160 + extraMs); // NOSONAR: só varia a espera simulada do demo
  if (offline) throw networkError();
  if (simulateError) throw httpError(500, 'Não foi possível carregar os dados.');
  return fn();
}
