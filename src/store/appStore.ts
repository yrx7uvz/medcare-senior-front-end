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
  /** Perfil deste aparelho; null = ainda não escolhido (tela de escolha) ou ainda carregando. */
  viewAs: ViewAs | null;
  setViewAs: (v: ViewAs | null) => void;
  /** O boot terminou de ler perfil e sessões do SecureStore. */
  profileLoaded: boolean;
  /** Falha ao ler o SecureStore no boot (a tela de carregamento oferece "Tentar novamente"). */
  bootError: string | null;

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

  /** Sessão do idoso carregada do SecureStore (o token fica em memória para as chamadas à API). */
  elderSession: { elderId: string; token: string } | null;
  elderSessionLoaded: boolean;
  setElderSession: (s: { elderId: string; token: string } | null) => void;
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
  viewAs: null,
  setViewAs: (viewAs) => set(viewAs === 'ELDER' ? { viewAs, elderUnlocked: false } : { viewAs }),
  profileLoaded: false,
  bootError: null,

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
