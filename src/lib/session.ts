import { forgetDoseOrigins } from '../adapters/http/HttpDoseService';
import { forgetLinkCodes } from '../adapters/http/HttpElderService';
import { clearHttpCache, setTokenProvider, setUnauthorizedHandler, setViewerProvider } from '../adapters/http/httpClient';
import { IS_DEMO } from '../config/env';
import { useAppStore, type ViewAs } from '../store/appStore';
import { resolveStoredSessions, SESSION_EXPIRED_MESSAGE } from './bootRules';
import { invalidateQueries } from './queryBus';
import { pushRegistration } from './pushSession';
import { caregiverSessionStorage, elderDeviceStorage, notificationPrefsStorage, profileStorage, type DeviceProfile } from './secureStorage';

export { ELDER_EXPIRED_MESSAGE, SESSION_EXPIRED_MESSAGE } from './bootRules';
export const ELDER_DISCONNECTED_MESSAGE = 'Este aparelho precisa ser conectado de novo. Peça um novo código a quem cuida de você.';

const toViewAs = (p: DeviceProfile | null): ViewAs | null => (p === 'CUIDADOR' ? 'CAREGIVER' : p === 'IDOSO' ? 'ELDER' : null);
const toProfile = (v: ViewAs): DeviceProfile => (v === 'CAREGIVER' ? 'CUIDADOR' : 'IDOSO');

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
 * Restaura perfil e sessões do SecureStore. Token do cuidador ou do idoso expirado (ou ilegível)
 * é descartado e a tela mostra o aviso (login ou pareamento). Falha de leitura não trava: vira bootError,
 * e a tela de carregamento oferece "Tentar novamente" (que chama bootSession de novo).
 */
export async function bootSession() {
  useAppStore.setState({ bootError: null });
  let profile: DeviceProfile | null;
  let elder: Awaited<ReturnType<typeof elderDeviceStorage.loadSession>>;
  let caregiver: Awaited<ReturnType<typeof caregiverSessionStorage.load>>;
  try {
    profile = await profileStorage.load();
    elder = await elderDeviceStorage.loadSession();
    // No demo os dados vivem só em memória: uma sessão de cuidador salva apontaria para dados que já não existem
    caregiver = IS_DEMO ? null : await caregiverSessionStorage.load();
  } catch {
    useAppStore.setState({ bootError: 'Não foi possível ler os dados guardados neste celular.' });
    return;
  }
  // Token vencido: o do cuidador vai ao login; o do idoso (180 dias) apaga sessão e PIN e volta ao pareamento
  const resolved = resolveStoredSessions({ profile, caregiver, elder, isDemo: IS_DEMO });
  if (resolved.clearCaregiver) await safely(() => caregiverSessionStorage.clear(), undefined);
  if (resolved.clearElder) await safely(() => elderDeviceStorage.clear(), undefined);
  const flash = resolved.flash;
  // Preferências de notificação do aparelho (sem elas, ficam as padrão)
  const prefs = await safely(() => notificationPrefsStorage.load(), null);
  if (prefs) useAppStore.getState().setNotificationPrefs(prefs);
  useAppStore.setState({
    viewAs: toViewAs(profile),
    session: resolved.caregiver,
    elderSession: resolved.elder,
    elderSessionLoaded: true,
    profileLoaded: true,
    ...(flash ? { flash } : {}),
  });
}

/** Escolha na primeira tela: grava o perfil no aparelho. */
export async function chooseProfile(viewAs: ViewAs) {
  await safely(() => profileStorage.save(toProfile(viewAs)), undefined);
  useAppStore.getState().setViewAs(viewAs);
}

/** "Não é você? Trocar perfil": limpa SÓ o perfil (a sessão do idoso já pareada fica no aparelho). */
export async function switchProfile() {
  // Aparelho deixa de ser do cuidador: para de receber os avisos dele (melhor esforço, antes de sair do perfil)
  const s = useAppStore.getState();
  if (s.viewAs === 'CAREGIVER' && s.session) await pushRegistration.unregister();
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

/** Aparelho do idoso desconectado pela API: apaga sessão e PIN e volta ao pareamento. */
async function disconnectElder() {
  useAppStore.setState({ elderSession: null, elderUnlocked: false, flash: ELDER_DISCONNECTED_MESSAGE });
  await safely(() => elderDeviceStorage.clear(), undefined);
  clearDataCaches();
}

/**
 * Liga a sessão ao cliente HTTP (uma vez, no boot): token conforme o perfil do aparelho,
 * persistência da sessão do cuidador e tratamento de 401 com token.
 */
export function registerSessionHandlers() {
  setViewerProvider(() => useAppStore.getState().viewAs);
  setTokenProvider(() => {
    const s = useAppStore.getState();
    if (s.viewAs === 'CAREGIVER') return s.session?.token ?? null;
    if (s.viewAs === 'ELDER') return s.elderSession?.token ?? null;
    return null;
  });

  setUnauthorizedHandler(() => {
    const s = useAppStore.getState();
    if (s.viewAs === 'CAREGIVER' && s.session) void logoutCaregiver(SESSION_EXPIRED_MESSAGE);
    else if (s.viewAs === 'ELDER' && s.elderSession) void disconnectElder();
  });

  // Toda troca de sessão do cuidador (login, cadastro, saída, exclusão de conta) é refletida no SecureStore
  return useAppStore.subscribe((state, prev) => {
    if (state.notificationPrefs !== prev.notificationPrefs) {
      void safely(() => notificationPrefsStorage.save(state.notificationPrefs), undefined);
    }
    if (IS_DEMO || state.session === prev.session) return;
    const next = state.session;
    void safely(() => (next ? caregiverSessionStorage.save(next) : caregiverSessionStorage.clear()), undefined);
    // Entrou (login, cadastro ou app aberto já logado): liga o token do aparelho à conta (FE-27)
    if (next && next.token !== prev.session?.token && state.viewAs === 'CAREGIVER') void pushRegistration.register();
  });
}
