import * as SecureStore from 'expo-secure-store';

/**
 * Único dado guardado no aparelho: a sessão do idoso (token de dispositivo) e o
 * PIN local de 4 dígitos (HU07). Usa o Keystore do Android via expo-secure-store;
 * se indisponível (ex.: web), cai para memória e nada é persistido.
 */
const KEYS = { elderSession: 'medcare.elder.session', elderPin: 'medcare.elder.pin' } as const;
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

export interface StoredElderSession {
  elderId: string;
  token: string;
}

export const elderDeviceStorage = {
  async saveSession(session: StoredElderSession) {
    await setItem(KEYS.elderSession, JSON.stringify(session));
  },
  async loadSession(): Promise<StoredElderSession | null> {
    const raw = await getItem(KEYS.elderSession);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredElderSession;
    } catch {
      return null;
    }
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
