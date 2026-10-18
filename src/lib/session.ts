import { forgetLinkCodes } from '../adapters/http/HttpElderService';
import { setTokenProvider, setUnauthorizedHandler } from '../adapters/http/httpClient';
import { IS_DEMO } from '../config/env';
import { useAppStore, type ViewAs } from '../store/appStore';
import { isJwtExpired } from './jwt';
import { invalidateQueries } from './queryBus';
import { caregiverSessionStorage, elderDeviceStorage, profileStorage, type DeviceProfile } from './secureStorage';

export const SESSION_EXPIRED_MESSAGE = 'Sua sessão expirou. Entre novamente.';
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
  invalidateQueries();
}

/**
 * Restaura perfil e sessões do SecureStore. Token do cuidador expirado (ou ilegível)
 * é descartado e o login mostra o aviso. Falha de leitura não trava: vira bootError,
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
  let flash: string | null = null;
  if (caregiver && isJwtExpired(caregiver.token)) {
    caregiver = null;
    flash = SESSION_EXPIRED_MESSAGE;
    await safely(() => caregiverSessionStorage.clear(), undefined);
  }
  useAppStore.setState({
    viewAs: toViewAs(profile),
    session: caregiver,
    elderSession: elder,
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
  await safely(() => profileStorage.clear(), undefined);
  useAppStore.getState().setViewAs(null);
}

/** Sair (cuidador): limpa a sessão da memória e do SecureStore e os dados carregados. */
export async function logoutCaregiver(flash: string | null = null) {
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
    if (IS_DEMO || state.session === prev.session) return;
    const next = state.session;
    void safely(() => (next ? caregiverSessionStorage.save(next) : caregiverSessionStorage.clear()), undefined);
  });
}
