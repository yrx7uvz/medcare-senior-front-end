import { create } from 'zustand';

/**
 * Relógio do protótipo. Começa em 05/06/2026 às 14:02 (data base dos mocks) e
 * anda em tempo real a partir daí. O menu de desenvolvedor pode reposicioná-lo
 * para simular, por exemplo, uma dose não confirmada.
 */
export const DEMO_START = new Date(2026, 5, 5, 14, 2, 0, 0);
export const DEMO_TODAY_KEY = '2026-06-05';

interface ClockState {
  baseMs: number;
  setAtRealMs: number;
  setTime: (date: Date) => void;
}

export const useClockStore = create<ClockState>()((set) => ({
  baseMs: DEMO_START.getTime(),
  setAtRealMs: Date.now(),
  setTime: (date) => set({ baseMs: date.getTime(), setAtRealMs: Date.now() }),
}));

export function getNow(): Date {
  const { baseMs, setAtRealMs } = useClockStore.getState();
  return new Date(baseMs + (Date.now() - setAtRealMs));
}
