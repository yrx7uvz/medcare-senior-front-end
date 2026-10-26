import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

/**
 * PIN local do paciente (HU07), sem React nem módulos nativos (as dependências entram por parâmetro, para testar).
 *
 * Guardado só como hash: PBKDF2-HMAC-SHA256 com sal aleatório de 16 bytes, comparação em tempo constante. PBKDF2 em
 * JavaScript puro (@noble/hashes) roda no Hermes sem módulo nativo; o custo (iterações) fica gravado junto do hash e,
 * se aumentar numa versão nova, o PIN é refeito com o custo novo no próximo desbloqueio certo.
 *
 * Limite honesto: um PIN de 4 dígitos tem só 10.000 combinações, e nenhum custo de KDF que rode bem num celular de
 * entrada impede a força bruta de quem já copiou o hash. A proteção principal é o SecureStore (Keystore do Android)
 * e o limite de tentativas abaixo; o hash evita o PIN em texto no aparelho.
 *
 * Tentativas: a cada 5 erros seguidos, bloqueio crescente (30 s, 2 min, 10 min, e 10 min daí em diante); acerto zera.
 * O tempo de bloqueio só corre pelo relógio monotônico, com o app aberto: adiantar o relógio do aparelho não tem efeito
 * e fechar o app não acelera (o restante fica gravado e continua de onde parou).
 */

/** Custo atual. Medido em PC sem JIT (V8 --jitless): 10.000 iterações ≈ 540 ms; 2.000 ≈ 110 ms. Estimativa num
 *  celular de entrada com Hermes: 0,3 a 0,6 s por verificação (a validar no aparelho). */
export const PIN_ITERATIONS = 2_000;
export const PIN_SALT_BYTES = 16;
export const PIN_HASH_BYTES = 32;
export const PIN_LENGTH = 4;
export const FAILURES_PER_LOCK = 5;
export const LOCK_DURATIONS_MS = [30_000, 120_000, 600_000] as const;

export interface PinRecord {
  v: 1;
  alg: 'pbkdf2-sha256';
  iterations: number;
  salt: string;
  hash: string;
}

/** Erros seguidos, nível do último bloqueio e quanto falta dele (só desconta com o app aberto). */
export interface AttemptState {
  failures: number;
  lockLevel: number;
  remainingMs: number;
}

export interface PinStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface PinDeps {
  store: PinStore;
  /** Bytes aleatórios de um gerador criptográfico. */
  randomBytes(n: number): Uint8Array;
  /** Relógio monotônico em ms (não muda com o relógio do aparelho). */
  monotonicNow(): number;
  iterations?: number;
}

/** Chaves com o nome antigo do perfil ("elder"): já estão gravadas nos aparelhos e mudar apagaria o PIN. */
export const PIN_KEYS = {
  record: 'medcare.elder.pinHash',
  attempts: 'medcare.elder.pinAttempts',
  /** Versões antigas guardavam o PIN em texto aqui: é convertido e apagado no primeiro uso. */
  legacyPlain: 'medcare.elder.pin',
} as const;

export const isValidPin = (pin: string) => new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);

export function hashPin(pin: string, salt: Uint8Array, iterations: number): Uint8Array {
  return pbkdf2(sha256, pin, salt, { c: iterations, dkLen: PIN_HASH_BYTES });
}

/** Comparação em tempo constante (não para no primeiro byte diferente). */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export function createPinRecord(pin: string, randomBytes: (n: number) => Uint8Array, iterations = PIN_ITERATIONS): PinRecord {
  if (!isValidPin(pin)) throw new Error('O PIN deve ter 4 números');
  const salt = randomBytes(PIN_SALT_BYTES);
  if (salt.length !== PIN_SALT_BYTES) throw new Error('Gerador aleatório devolveu tamanho errado');
  return { v: 1, alg: 'pbkdf2-sha256', iterations, salt: bytesToHex(salt), hash: bytesToHex(hashPin(pin, salt, iterations)) };
}

export function parsePinRecord(raw: string | null): PinRecord | null {
  if (!raw) return null;
  try {
    const r = JSON.parse(raw) as Partial<PinRecord>;
    const hex = (s: unknown, bytes: number) => typeof s === 'string' && new RegExp(`^[0-9a-f]{${bytes * 2}}$`).test(s);
    return r.v === 1 && r.alg === 'pbkdf2-sha256' && Number.isInteger(r.iterations) && (r.iterations ?? 0) > 0 && hex(r.salt, PIN_SALT_BYTES) && hex(r.hash, PIN_HASH_BYTES)
      ? (r as PinRecord)
      : null;
  } catch {
    return null;
  }
}

export function matchesRecord(pin: string, record: PinRecord): boolean {
  if (!isValidPin(pin)) return false;
  return constantTimeEqual(hashPin(pin, hexToBytes(record.salt), record.iterations), hexToBytes(record.hash));
}

const textBytes = (s: string) => Uint8Array.from(Array.from(s, (c) => c.charCodeAt(0) & 0xff));

/** Duração do bloqueio de um nível (1 = primeiro bloqueio); do terceiro em diante, 10 min. */
export const lockDurationMs = (level: number) => LOCK_DURATIONS_MS[Math.min(level, LOCK_DURATIONS_MS.length) - 1];

export const NO_ATTEMPTS: AttemptState = { failures: 0, lockLevel: 0, remainingMs: 0 };

/** Erro registrado: a cada 5 erros seguidos, um bloqueio do próximo nível. */
export function afterFailure(state: AttemptState): AttemptState {
  const failures = state.failures + 1;
  if (failures % FAILURES_PER_LOCK !== 0) return { ...state, failures };
  const lockLevel = state.lockLevel + 1;
  return { failures, lockLevel, remainingMs: lockDurationMs(lockLevel) };
}

export function parseAttempts(raw: string | null): AttemptState {
  if (!raw) return NO_ATTEMPTS;
  try {
    const s = JSON.parse(raw) as Partial<AttemptState>;
    const ok = (n: unknown, max: number) => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= max;
    // Valor adulterado ou ilegível não destrava: volta ao bloqueio mais longo
    if (!ok(s.failures, 1_000_000) || !ok(s.lockLevel, 1_000_000) || !ok(s.remainingMs, LOCK_DURATIONS_MS[LOCK_DURATIONS_MS.length - 1])) {
      return { failures: FAILURES_PER_LOCK, lockLevel: LOCK_DURATIONS_MS.length, remainingMs: lockDurationMs(LOCK_DURATIONS_MS.length) };
    }
    return { failures: s.failures!, lockLevel: s.lockLevel!, remainingMs: s.remainingMs! };
  } catch {
    return { failures: FAILURES_PER_LOCK, lockLevel: LOCK_DURATIONS_MS.length, remainingMs: lockDurationMs(LOCK_DURATIONS_MS.length) };
  }
}

export type PinCheck =
  | { result: 'OK' }
  | { result: 'WRONG'; attemptsBeforeLock: number }
  | { result: 'LOCKED'; remainingMs: number }
  | { result: 'NO_PIN' };

export interface PinGuard {
  /** Quanto falta do bloqueio atual, em ms (0 = liberado). */
  lockRemainingMs(): Promise<number>;
  verify(pin: string): Promise<PinCheck>;
  save(pin: string): Promise<void>;
  /** Grava quanto falta do bloqueio (ao sair da tela ou ir para o segundo plano). */
  persist(): Promise<void>;
  clear(): Promise<void>;
}

/**
 * PIN com limite de tentativas. O estado das tentativas é lido do armazenamento uma vez e, daí em diante, o restante
 * do bloqueio desconta pelo relógio monotônico; é gravado a cada mudança e em persist().
 */
export function createPinGuard(deps: PinDeps): PinGuard {
  const iterations = deps.iterations ?? PIN_ITERATIONS;
  let loaded: { state: AttemptState; at: number } | null = null;

  async function current(): Promise<AttemptState> {
    if (!loaded) loaded = { state: parseAttempts(await deps.store.get(PIN_KEYS.attempts)), at: deps.monotonicNow() };
    const elapsed = Math.max(0, deps.monotonicNow() - loaded.at);
    return { ...loaded.state, remainingMs: Math.max(0, loaded.state.remainingMs - elapsed) };
  }

  async function write(state: AttemptState) {
    loaded = { state, at: deps.monotonicNow() };
    await deps.store.set(PIN_KEYS.attempts, JSON.stringify(state));
  }

  async function saveRecord(pin: string) {
    await deps.store.set(PIN_KEYS.record, JSON.stringify(createPinRecord(pin, deps.randomBytes, iterations)));
  }

  return {
    async lockRemainingMs() {
      return (await current()).remainingMs;
    },

    async verify(pin) {
      const state = await current();
      if (state.remainingMs > 0) return { result: 'LOCKED', remainingMs: state.remainingMs };

      const record = parsePinRecord(await deps.store.get(PIN_KEYS.record));
      let ok: boolean;
      if (record) {
        ok = matchesRecord(pin, record);
        // Custo aumentou numa versão nova: refaz o hash com o custo atual
        if (ok && record.iterations < iterations) await saveRecord(pin);
      } else {
        const legacy = await deps.store.get(PIN_KEYS.legacyPlain);
        if (legacy === null) return { result: 'NO_PIN' };
        ok = isValidPin(pin) && constantTimeEqual(textBytes(pin), textBytes(legacy));
        if (ok) {
          // Migração: grava o hash ANTES de apagar o texto (se falhar no meio, o PIN continua valendo)
          await saveRecord(pin);
          await deps.store.remove(PIN_KEYS.legacyPlain);
        }
      }

      if (ok) {
        await write(NO_ATTEMPTS);
        return { result: 'OK' };
      }
      const next = afterFailure(state);
      await write(next);
      return next.remainingMs > 0
        ? { result: 'LOCKED', remainingMs: next.remainingMs }
        : { result: 'WRONG', attemptsBeforeLock: FAILURES_PER_LOCK - (next.failures % FAILURES_PER_LOCK) };
    },

    async save(pin) {
      await saveRecord(pin);
      await deps.store.remove(PIN_KEYS.legacyPlain);
      await write(NO_ATTEMPTS);
    },

    async persist() {
      if (loaded) await write(await current());
    },

    async clear() {
      loaded = null;
      await deps.store.remove(PIN_KEYS.record);
      await deps.store.remove(PIN_KEYS.legacyPlain);
      await deps.store.remove(PIN_KEYS.attempts);
    },
  };
}

/** "mm:ss" (ou "s s") do tempo que falta, para a tela de bloqueio. */
export function formatLockRemaining(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m} min ${String(s).padStart(2, '0')} s` : `${s} s`;
}
