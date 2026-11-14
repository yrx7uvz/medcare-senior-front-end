/*
 * Banco em memória dos dados simulados do app (modo demonstração). Some ao fechar o app, por desenho; toda
 * alteração invalida as consultas em cache para as telas recarregarem.
 */
import { invalidateQueries } from '../lib/queryBus';
import { createSeedDb, type MockDb } from './seed';

/** "Banco" em memória do protótipo. Some ao fechar o app, por desenho. */
let db: MockDb = createSeedDb();

export const getDb = () => db;

export function mutateDb(fn: (d: MockDb) => void) {
  fn(db);
  invalidateQueries();
}

export function resetDb() {
  db = createSeedDb();
  invalidateQueries();
}

export type { MockDb };
