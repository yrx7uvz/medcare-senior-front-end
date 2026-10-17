import { create } from 'zustand';
import type { CaregiverSession, ElderFilter } from '../types/views';

export type ViewAs = 'CAREGIVER' | 'ELDER';
export type ToastTone = 'success' | 'info' | 'danger';

interface NotificationPrefs {
  missedDose: boolean;
  messages: boolean;
  lowStock: boolean;
}

/**
 * Estado global leve da interface. Dados de saúde NÃO ficam aqui nem em
 * AsyncStorage: vêm dos serviços a cada tela (hoje mockados, depois da API).
 */
interface AppState {
  viewAs: ViewAs;
  setViewAs: (v: ViewAs) => void;

  session: CaregiverSession | null;
  setSession: (s: CaregiverSession | null) => void;

  selectedElderId: ElderFilter;
  setSelectedElder: (id: ElderFilter) => void;

  themeMode: 'light' | 'dark';
  toggleTheme: () => void;

  notificationPrefs: NotificationPrefs;
  setNotificationPref: (key: keyof NotificationPrefs, value: boolean) => void;

  elderHighContrast: boolean;
  toggleElderHighContrast: () => void;

  /** Sessão do idoso carregada do SecureStore. */
  elderSession: { elderId: string } | null;
  elderSessionLoaded: boolean;
  setElderSession: (s: { elderId: string } | null) => void;
  /** PIN digitado nesta abertura. */
  elderUnlocked: boolean;
  setElderUnlocked: (v: boolean) => void;

  dismissedAlertIds: string[];
  dismissAlert: (id: string) => void;
  seenAlertIds: string[];
  markAlertsSeen: (ids: string[]) => void;

  toast: { id: number; message: string; tone: ToastTone } | null;
  showToast: (message: string, tone?: ToastTone) => void;
  hideToast: () => void;

  /** Mensagem exibida uma vez no login (ex.: após excluir a conta). */
  flash: string | null;
  setFlash: (m: string | null) => void;

  resetUi: () => void;
}

export const useAppStore = create<AppState>()((set) => ({
  viewAs: 'CAREGIVER',
  setViewAs: (viewAs) => set(viewAs === 'ELDER' ? { viewAs, elderUnlocked: false } : { viewAs }),

  session: null,
  setSession: (session) => set({ session }),

  selectedElderId: 'ALL',
  setSelectedElder: (selectedElderId) => set({ selectedElderId }),

  themeMode: 'light',
  toggleTheme: () => set((s) => ({ themeMode: s.themeMode === 'light' ? 'dark' : 'light' })),

  notificationPrefs: { missedDose: true, messages: true, lowStock: true },
  setNotificationPref: (key, value) => set((s) => ({ notificationPrefs: { ...s.notificationPrefs, [key]: value } })),

  elderHighContrast: false,
  toggleElderHighContrast: () => set((s) => ({ elderHighContrast: !s.elderHighContrast })),

  elderSession: null,
  elderSessionLoaded: false,
  setElderSession: (elderSession) => set({ elderSession, elderSessionLoaded: true }),
  elderUnlocked: false,
  setElderUnlocked: (elderUnlocked) => set({ elderUnlocked }),

  dismissedAlertIds: [],
  dismissAlert: (id) => set((s) => ({ dismissedAlertIds: [...s.dismissedAlertIds, id] })),
  seenAlertIds: [],
  markAlertsSeen: (ids) => set((s) => ({ seenAlertIds: Array.from(new Set([...s.seenAlertIds, ...ids])) })),

  toast: null,
  showToast: (message, tone = 'success') => set({ toast: { id: Date.now(), message, tone } }),
  hideToast: () => set({ toast: null }),

  flash: null,
  setFlash: (flash) => set({ flash }),

  resetUi: () =>
    set({
      selectedElderId: 'ALL',
      dismissedAlertIds: [],
      seenAlertIds: [],
    }),
}));
