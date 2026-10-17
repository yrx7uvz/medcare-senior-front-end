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
