import { create } from 'zustand';

/**
 * Barramento de invalidação: qualquer escrita (mock ou HTTP) chama
 * invalidateQueries() e as telas abertas recarregam em segundo plano.
 */
export const useQueryBus = create<{ version: number }>()(() => ({ version: 0 }));

export function invalidateQueries() {
  useQueryBus.setState((s) => ({ version: s.version + 1 }));
}
