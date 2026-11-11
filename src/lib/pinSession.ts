import { AppState, type AppStateStatus } from 'react-native';
import { useAppStore } from '../store/appStore';
import { shouldAskPin, shouldWriteActivity, type PinAskMode } from './pinGrace';
import { patientDeviceStorage } from './secureStorage';

/**
 * Tolerância do PIN do paciente ligada ao app: grava o último uso desbloqueado (ao desbloquear, ao ir para o segundo
 * plano e nos toques, no máximo uma vez por minuto) e, ao voltar ao primeiro plano, bloqueia de novo se passou da
 * tolerância (ou sempre, se o paciente escolheu "Sempre"). A regra em si é pura, em pinGrace.
 */

let lastWrittenMs: number | null = null;

const now = () => Date.now();

type Store = ReturnType<typeof useAppStore.getState>;
const inUse = (s: Store) => s.viewAs === 'PATIENT' && !!s.patientSession && s.patientUnlocked;
const patientInUse = () => inUse(useAppStore.getState());

/** Último uso desbloqueado. Sem `force`, respeita o intervalo mínimo entre gravações (toques). */
export function markPatientActivity(force = false) {
  if (!patientInUse()) return;
  const at = now();
  if (!force && !shouldWriteActivity(lastWrittenMs, at)) return;
  lastWrittenMs = at;
  void patientDeviceStorage.markUnlockedUse(at).catch(() => undefined);
}

/** Desconexão, saída ou PIN esquecido: o carimbo foi apagado junto com o PIN. */
export const forgetPatientActivity = () => {
  lastWrittenMs = null;
};

/** No boot: o aparelho do paciente entra direto se o último uso está dentro da tolerância. */
export async function patientStartsUnlocked(): Promise<{ unlocked: boolean; mode: PinAskMode }> {
  const { mode, lastUseMs } = await patientDeviceStorage.loadPinGrace();
  return { unlocked: !shouldAskPin(mode, lastUseMs, now()), mode };
}

/** Escolha em Ajustes do paciente ("Pedir o PIN ao abrir o app"). */
export async function setPinAskMode(mode: PinAskMode) {
  await patientDeviceStorage.savePinAskMode(mode);
  useAppStore.getState().setPinAskMode(mode);
}

/** Liga a tolerância ao ciclo de vida do app. Devolve a função que desliga. */
export function startPinGrace(): () => void {
  let previous: AppStateStatus = AppState.currentState;
  const sub = AppState.addEventListener('change', (state) => {
    const wasBackground = previous === 'background';
    previous = state;
    if (state === 'background') {
      markPatientActivity(true);
      return;
    }
    if (state !== 'active' || !wasBackground || !patientInUse()) return;
    void patientDeviceStorage
      .loadPinGrace()
      .then(({ mode, lastUseMs }) => {
        if (shouldAskPin(mode, lastUseMs, now())) useAppStore.getState().setPatientUnlocked(false);
      })
      // Sem ler o carimbo, pede o PIN (nunca abre sem querer)
      .catch(() => useAppStore.getState().setPatientUnlocked(false));
  });
  // Entrou no app do paciente (PIN certo, PIN criado ou boot dentro da tolerância): conta como uso
  const unsubscribe = useAppStore.subscribe((s, prev) => {
    if (inUse(s) && !inUse(prev)) markPatientActivity(true);
  });
  return () => {
    sub.remove();
    unsubscribe();
  };
}
