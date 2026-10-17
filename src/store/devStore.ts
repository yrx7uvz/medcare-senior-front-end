import { create } from 'zustand';

/** Chaves do menu de desenvolvedor (apenas protótipo). */
interface DevState {
  simulateError: boolean;
  offline: boolean;
  slow: boolean;
  set: (patch: Partial<Omit<DevState, 'set'>>) => void;
}

export const useDevStore = create<DevState>()((set) => ({
  simulateError: false,
  offline: false,
  slow: false,
  set: (patch) => set(patch),
}));
