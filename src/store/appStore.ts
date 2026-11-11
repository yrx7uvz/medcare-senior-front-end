import { create } from 'zustand';
import type { LeaveOpenTarget } from '../lib/leaveRequest';
import { DEFAULT_PIN_ASK_MODE, type PinAskMode } from '../lib/pinGrace';
import type { DoseOpenTarget } from '../lib/pushPayload';
import type { ThemeMode, ThemePrefs } from '../lib/themePrefs';
import type { CaregiverSession, PatientFilter } from '../types/views';

export type ViewAs = 'CAREGIVER' | 'PATIENT';
export type ToastTone = 'success' | 'info' | 'danger';

interface NotificationPrefs {
  missedDose: boolean;
  messages: boolean;
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

  selectedPatientId: PatientFilter;
  setSelectedPatient: (id: PatientFilter) => void;

  /** Tema escolhido nas Configurações; null = seguir o tema do sistema. Guardado no aparelho. */
  themeChoice: ThemeMode | null;
  /** Escolha do seletor de tema; null = Automático (tema do celular). */
  setThemeChoice: (choice: ThemeMode | null) => void;
  /** As preferências de aparência já foram lidas do aparelho (até lá, só a tela de carregamento da marca). */
  themeLoaded: boolean;
  setThemePrefs: (prefs: ThemePrefs) => void;

  notificationPrefs: NotificationPrefs;
  setNotificationPref: (key: keyof NotificationPrefs, value: boolean) => void;
  /** Preferências lidas do aparelho no boot. */
  setNotificationPrefs: (prefs: NotificationPrefs) => void;

  /** Dose a abrir vinda de um toque em notificação (espera o login, se a sessão tiver expirado). */
  pendingDoseOpen: DoseOpenTarget | null;
  setPendingDoseOpen: (target: DoseOpenTarget | null) => void;
  /** Pedido de saída a abrir, vindo de um toque no aviso (espera o login, como a dose). */
  pendingLeaveOpen: LeaveOpenTarget | null;
  setPendingLeaveOpen: (target: LeaveOpenTarget | null) => void;

  patientHighContrast: boolean;
  togglePatientHighContrast: () => void;

  /** Sessão do paciente carregada do SecureStore (o token fica em memória para as chamadas à API). */
  patientSession: { patientId: string; token: string } | null;
  patientSessionLoaded: boolean;
  setPatientSession: (s: { patientId: string; token: string } | null) => void;
  /** App do paciente desbloqueado: PIN digitado ou último uso dentro da tolerância (pinGrace). */
  patientUnlocked: boolean;
  setPatientUnlocked: (v: boolean) => void;
  /** Quando pedir o PIN neste aparelho (Ajustes do paciente). */
  pinAskMode: PinAskMode;
  setPinAskMode: (mode: PinAskMode) => void;
  /** O paciente pediu para sair e espera o cuidador: a desconexão que vier da API é a saída autorizada. */
  patientLeaveRequested: boolean;
  setPatientLeaveRequested: (v: boolean) => void;

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
  setViewAs: (viewAs) => set(viewAs === 'PATIENT' ? { viewAs, patientUnlocked: false } : { viewAs }),
  profileLoaded: false,
  bootError: null,

  session: null,
  setSession: (session) => set({ session }),

  selectedPatientId: 'ALL',
  setSelectedPatient: (selectedPatientId) => set({ selectedPatientId }),

  themeChoice: null,
  setThemeChoice: (themeChoice) => set({ themeChoice }),
  themeLoaded: false,
  setThemePrefs: (prefs) => set({ themeChoice: prefs.mode, patientHighContrast: prefs.patientHighContrast, themeLoaded: true }),

  notificationPrefs: { missedDose: true, messages: true },
  setNotificationPref: (key, value) => set((s) => ({ notificationPrefs: { ...s.notificationPrefs, [key]: value } })),
  setNotificationPrefs: (notificationPrefs) => set({ notificationPrefs }),

  pendingDoseOpen: null,
  setPendingDoseOpen: (pendingDoseOpen) => set({ pendingDoseOpen }),
  pendingLeaveOpen: null,
  setPendingLeaveOpen: (pendingLeaveOpen) => set({ pendingLeaveOpen }),

  patientHighContrast: false,
  togglePatientHighContrast: () => set((s) => ({ patientHighContrast: !s.patientHighContrast })),

  patientSession: null,
  patientSessionLoaded: false,
  setPatientSession: (patientSession) => set({ patientSession, patientSessionLoaded: true }),
  patientUnlocked: false,
  setPatientUnlocked: (patientUnlocked) => set({ patientUnlocked }),
  pinAskMode: DEFAULT_PIN_ASK_MODE,
  setPinAskMode: (pinAskMode) => set({ pinAskMode }),
  patientLeaveRequested: false,
  setPatientLeaveRequested: (patientLeaveRequested) => set({ patientLeaveRequested }),

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
      selectedPatientId: 'ALL',
      dismissedAlertIds: [],
      seenAlertIds: [],
    }),
}));
