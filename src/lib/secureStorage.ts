import * as SecureStore from 'expo-secure-store';

/**
 * Dados guardados no aparelho: o perfil escolhido (cuidador ou idoso), a sessão
 * do cuidador, a sessão do idoso (token de dispositivo) e o PIN local de 4 dígitos
 * (HU07). Usa o Keystore do Android via expo-secure-store; se indisponível (ex.:
 * web), cai para memória e nada é persistido.
 */
const KEYS = {
  elderSession: 'medcare.elder.session',
  elderPin: 'medcare.elder.pin',
  profile: 'medcare.device.profile',
  caregiverSession: 'medcare.caregiver.session',
  notificationPrefs: 'medcare.notification.prefs',
  pushPendingRemoval: 'medcare.push.pendingRemoval',
  pushPromptAnswered: 'medcare.push.promptAnswered',
} as const;
const memory = new Map<string, string>();

async function available() {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

async function setItem(key: string, value: string) {
  if (await available()) await SecureStore.setItemAsync(key, value);
  else memory.set(key, value);
}
async function getItem(key: string) {
  if (await available()) return SecureStore.getItemAsync(key);
  return memory.get(key) ?? null;
}
async function removeItem(key: string) {
  if (await available()) await SecureStore.deleteItemAsync(key);
  else memory.delete(key);
}

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export type DeviceProfile = 'CUIDADOR' | 'IDOSO';

/** Perfil escolhido na primeira tela ("Sou cuidador" / "Sou idoso"). */
export const profileStorage = {
  async save(profile: DeviceProfile) {
    await setItem(KEYS.profile, profile);
  },
  async load(): Promise<DeviceProfile | null> {
    const raw = await getItem(KEYS.profile);
    return raw === 'CUIDADOR' || raw === 'IDOSO' ? raw : null;
  },
  async clear() {
    await removeItem(KEYS.profile);
  },
};

export interface StoredCaregiverSession {
  caregiverId: string;
  name: string;
  email: string;
  token: string;
}

/** Sessão do cuidador (JWT da API), restaurada ao abrir o app. */
export const caregiverSessionStorage = {
  async save(session: StoredCaregiverSession) {
    await setItem(KEYS.caregiverSession, JSON.stringify(session));
  },
  async load(): Promise<StoredCaregiverSession | null> {
    const s = parseJson<StoredCaregiverSession>(await getItem(KEYS.caregiverSession));
    return s && typeof s.token === 'string' && typeof s.caregiverId === 'string' ? s : null;
  },
  async clear() {
    await removeItem(KEYS.caregiverSession);
  },
};

export interface StoredElderSession {
  elderId: string;
  token: string;
}

export const elderDeviceStorage = {
  async saveSession(session: StoredElderSession) {
    await setItem(KEYS.elderSession, JSON.stringify(session));
  },
  async loadSession(): Promise<StoredElderSession | null> {
    const s = parseJson<StoredElderSession>(await getItem(KEYS.elderSession));
    return s && typeof s.elderId === 'string' && typeof s.token === 'string' ? s : null;
  },
  async savePin(pin: string) {
    await setItem(KEYS.elderPin, pin);
  },
  async verifyPin(pin: string) {
    return (await getItem(KEYS.elderPin)) === pin;
  },
  async clear() {
    await removeItem(KEYS.elderSession);
    await removeItem(KEYS.elderPin);
  },
};

export interface StoredNotificationPrefs {
  missedDose: boolean;
  messages: boolean;
}

/**
 * Lê as preferências guardadas. Versões antigas guardavam também "estoque baixo", que não existe mais: a chave extra
 * é ignorada (e some no próximo salvamento). Valor ilegível volta como null (padrão).
 */
export function parseNotificationPrefs(raw: string | null): StoredNotificationPrefs | null {
  const p = parseJson<Partial<Record<keyof StoredNotificationPrefs, unknown>>>(raw);
  return p && typeof p.missedDose === 'boolean' && typeof p.messages === 'boolean' ? { missedDose: p.missedDose, messages: p.messages } : null;
}

/** Preferências de notificação do aparelho (não são dado de saúde). */
export const notificationPrefsStorage = {
  async save(prefs: StoredNotificationPrefs) {
    await setItem(KEYS.notificationPrefs, JSON.stringify(prefs));
  },
  async load(): Promise<StoredNotificationPrefs | null> {
    return parseNotificationPrefs(await getItem(KEYS.notificationPrefs));
  },
};

/** Marcas do push: remoção do token pendente (saída sem rede) e explicação de permissão já respondida. */
export const pushStorage = {
  async getPendingRemoval() {
    return (await getItem(KEYS.pushPendingRemoval)) === '1';
  },
  async setPendingRemoval(pending: boolean) {
    if (pending) await setItem(KEYS.pushPendingRemoval, '1');
    else await removeItem(KEYS.pushPendingRemoval);
  },
  async getPromptAnswered() {
    return (await getItem(KEYS.pushPromptAnswered)) === '1';
  },
  async setPromptAnswered() {
    await setItem(KEYS.pushPromptAnswered, '1');
  },
};
