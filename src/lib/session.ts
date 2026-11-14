import { forgetDoseOrigins } from '../adapters/http/HttpDoseService';
import { forgetLinkCodes } from '../adapters/http/HttpPatientService';
import { clearHttpCache, setTokenProvider, setUnauthorizedHandler, setViewerProvider } from '../adapters/http/httpClient';
import { IS_DEMO } from '../config/env';
import { useAppStore, type ViewAs } from '../store/appStore';
import { resolveStoredSessions, SESSION_EXPIRED_MESSAGE } from './bootRules';
import { patientDisconnectedFlash } from './leaveRequest';
import { invalidateQueries } from './queryBus';
import { patientPushRegistration, pushRegistration } from './pushSession';
import { DEFAULT_PIN_ASK_MODE } from './pinGrace';
import { forgetPatientActivity, patientStartsUnlocked } from './pinSession';
import { caregiverSessionStorage, patientDeviceStorage, notificationPrefsStorage, profileStorage, type DeviceProfile } from './secureStorage';

export { PATIENT_EXPIRED_MESSAGE, SESSION_EXPIRED_MESSAGE } from './bootRules';
export const PATIENT_DISCONNECTED_MESSAGE = 'Este aparelho precisa ser conectado de novo. Peça um novo código a quem cuida de você.';

const toViewAs = (p: DeviceProfile | null): ViewAs | null => (p === 'CUIDADOR' ? 'CAREGIVER' : p === 'PACIENTE' ? 'PATIENT' : null);
const toProfile = (v: ViewAs): DeviceProfile => (v === 'CAREGIVER' ? 'CUIDADOR' : 'PACIENTE');

async function safely<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/** Esquece os dados já carregados: as telas abertas recarregam e os filtros/alertas da interface voltam ao padrão. */
function clearDataCaches() {
  useAppStore.getState().resetUi();
  // Códigos de vínculo gerados nesta abertura (memória) não podem aparecer para outra conta
  forgetLinkCodes();
  forgetDoseOrigins();
  clearHttpCache();
  invalidateQueries();
}

/**
 * Restaura perfil e sessões do SecureStore. Token do cuidador ou do paciente expirado (ou ilegível)
 * é descartado e a tela mostra o aviso (login ou pareamento). Falha de leitura não trava: vira bootError,
 * e a tela de carregamento oferece "Tentar novamente" (que chama bootSession de novo).
 */
export async function bootSession() {
  useAppStore.setState({ bootError: null });
  let profile: DeviceProfile | null;
  let patient: Awaited<ReturnType<typeof patientDeviceStorage.loadSession>>;
  let caregiver: Awaited<ReturnType<typeof caregiverSessionStorage.load>>;
  try {
    profile = await profileStorage.load();
    patient = await patientDeviceStorage.loadSession();
    // No demo os dados vivem só em memória: uma sessão de cuidador salva apontaria para dados que já não existem
    caregiver = IS_DEMO ? null : await caregiverSessionStorage.load();
  } catch {
    useAppStore.setState({ bootError: 'Não foi possível ler os dados guardados neste celular.' });
    return;
  }
  // Token vencido: o do cuidador vai ao login; o do paciente (180 dias) apaga sessão e PIN e volta ao pareamento
  const resolved = resolveStoredSessions({ profile, caregiver, patient, isDemo: IS_DEMO });
  if (resolved.clearCaregiver) await safely(() => caregiverSessionStorage.clear(), undefined);
  if (resolved.clearPatient) await safely(() => patientDeviceStorage.clear(), undefined);
  const flash = resolved.flash;
  // Preferências de notificação do aparelho (sem elas, ficam as padrão)
  const prefs = await safely(() => notificationPrefsStorage.load(), null);
  if (prefs) useAppStore.getState().setNotificationPrefs(prefs);
  // PIN do paciente: entra direto se o último uso desbloqueado foi há até 10 minutos (ou se escolheu "Nunca")
  const grace = resolved.patient ? await safely(() => patientStartsUnlocked(), null) : null;
  useAppStore.setState({
    viewAs: toViewAs(profile),
    session: resolved.caregiver,
    patientSession: resolved.patient,
    patientSessionLoaded: true,
    profileLoaded: true,
    patientUnlocked: profile === 'PACIENTE' && !!grace?.unlocked,
    ...(grace ? { pinAskMode: grace.mode } : {}),
    ...(flash ? { flash } : {}),
  });
}

/** Escolha na primeira tela: grava o perfil no aparelho. */
export async function chooseProfile(viewAs: ViewAs) {
  await safely(() => profileStorage.save(toProfile(viewAs)), undefined);
  useAppStore.getState().setViewAs(viewAs);
}

/**
 * "Não é você? Trocar perfil": limpa SÓ o perfil (a sessão do paciente já pareada fica no aparelho). Os lembretes de
 * dose saem do aparelho junto (reminders.ts cancela tudo fora do perfil do paciente).
 */
export async function switchProfile() {
  // Aparelho deixa de ser do cuidador (ou do paciente): para de receber os avisos dele (melhor esforço, antes de sair
  // do perfil, enquanto o token da sessão ainda vai nas chamadas)
  const s = useAppStore.getState();
  if (s.viewAs === 'CAREGIVER' && s.session) await pushRegistration.unregister();
  if (s.viewAs === 'PATIENT' && s.patientSession) await patientPushRegistration.unregister();
  await safely(() => profileStorage.clear(), undefined);
  useAppStore.getState().setViewAs(null);
}

/** Sair (cuidador): limpa a sessão da memória e do SecureStore e os dados carregados. */
export async function logoutCaregiver(flash: string | null = null) {
  // Tira o token do aparelho da conta ANTES de apagar a sessão (a remoção precisa do JWT). Melhor esforço com tempo
  // limite: sem rede, a saída acontece e a pendência é resolvida no próximo login
  if (useAppStore.getState().session && !flash) await pushRegistration.unregister();
  useAppStore.setState({ session: null, flash });
  await safely(() => caregiverSessionStorage.clear(), undefined);
  clearDataCaches();
}

/**
 * Aparelho do paciente desconectado pela API: apaga sessão e PIN e volta ao pareamento. Se ele tinha pedido para sair,
 * é a autorização do cuidador chegando, e a mensagem diz isso. O servidor já apagou o token de push do aparelho junto
 * com a desconexão (ou com o paciente): aqui só se para de ouvir a troca de token. Os lembretes agendados saem pelo
 * reminders.ts, que vê a sessão sumir.
 */
async function disconnectPatient() {
  const flash = patientDisconnectedFlash(useAppStore.getState().patientLeaveRequested, PATIENT_DISCONNECTED_MESSAGE);
  void patientPushRegistration.forget();
  useAppStore.setState({ patientSession: null, patientUnlocked: false, patientLeaveRequested: false, pinAskMode: DEFAULT_PIN_ASK_MODE, flash });
  // Junto com o PIN, vão o último uso desbloqueado e a escolha de quando pedir o PIN
  await safely(() => patientDeviceStorage.clear(), undefined);
  forgetPatientActivity();
  clearDataCaches();
}

/** Saída autorizada pelo cuidador, vista pela tela de espera do paciente: mesma limpeza, com a mensagem da autorização. */
export async function leavePatientAccount() {
  useAppStore.getState().setPatientLeaveRequested(true);
  await disconnectPatient();
}

let unsubscribeHandlers: (() => void) | null = null;

/**
 * Liga a sessão ao cliente HTTP (uma vez, no boot): token conforme o perfil do aparelho,
 * persistência da sessão do cuidador e tratamento de 401 com token. Idempotente: a tarefa de segundo plano do lembrete
 * (reminderTask.ts) também liga, quando o app nem foi aberto, e uma segunda chamada não duplica nada.
 */
export function registerSessionHandlers() {
  if (unsubscribeHandlers) return unsubscribeHandlers;
  const unsubscribe = bindSessionHandlers();
  unsubscribeHandlers = () => {
    unsubscribe();
    unsubscribeHandlers = null;
  };
  return unsubscribeHandlers;
}

/** O boot já leu o perfil e as sessões (a tarefa de segundo plano só roda o boot se o app ainda não rodou). */
export const sessionBooted = () => useAppStore.getState().profileLoaded;

function bindSessionHandlers() {
  setViewerProvider(() => useAppStore.getState().viewAs);
  setTokenProvider(() => {
    const s = useAppStore.getState();
    if (s.viewAs === 'CAREGIVER') return s.session?.token ?? null;
    if (s.viewAs === 'PATIENT') return s.patientSession?.token ?? null;
    return null;
  });

  setUnauthorizedHandler(() => {
    const s = useAppStore.getState();
    if (s.viewAs === 'CAREGIVER' && s.session) void logoutCaregiver(SESSION_EXPIRED_MESSAGE);
    else if (s.viewAs === 'PATIENT' && s.patientSession) void disconnectPatient();
  });

  // Toda troca de sessão do cuidador (login, cadastro, saída, exclusão de conta) é refletida no SecureStore
  return useAppStore.subscribe((state, prev) => {
    if (state.notificationPrefs !== prev.notificationPrefs) {
      void safely(() => notificationPrefsStorage.save(state.notificationPrefs), undefined);
    }
    // Paciente pareado (pareamento, app aberto já pareado ou volta ao perfil do paciente): liga o token do aparelho ao
    // paciente, para o servidor reforçar o lembrete de dose. No demo não há servidor
    const patientNow = state.viewAs === 'PATIENT' ? state.patientSession?.token : undefined;
    const patientBefore = prev.viewAs === 'PATIENT' ? prev.patientSession?.token : undefined;
    if (!IS_DEMO && patientNow && patientNow !== patientBefore) void patientPushRegistration.register();
    if (IS_DEMO || state.session === prev.session) return;
    const next = state.session;
    void safely(() => (next ? caregiverSessionStorage.save(next) : caregiverSessionStorage.clear()), undefined);
    // Entrou (login, cadastro ou app aberto já logado): liga o token do aparelho à conta
    if (next && next.token !== prev.session?.token && state.viewAs === 'CAREGIVER') void pushRegistration.register();
  });
}
