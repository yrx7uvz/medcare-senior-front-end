import { describe, expect, it } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import {
  afterFailure,
  constantTimeEqual,
  createPinGuard,
  createPinRecord,
  FAILURES_PER_LOCK,
  formatLockRemaining,
  hashPin,
  lockDurationMs,
  matchesRecord,
  NO_ATTEMPTS,
  parseAttempts,
  parsePinRecord,
  PIN_ITERATIONS,
  PIN_KEYS,
  type PinStore,
} from '../src/lib/pinCore';

/** Armazenamento em memória que sobrevive a "fechar o app" (recriar o guard com o mesmo store). */
function memoryStore(initial: Record<string, string> = {}): PinStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get: async (k) => data.get(k) ?? null,
    set: async (k, v) => {
      data.set(k, v);
    },
    remove: async (k) => {
      data.delete(k);
    },
  };
}

const rnd = (n: number) => new Uint8Array(randomBytes(n));
// Custo baixo nos testes de fluxo (o custo real é testado à parte)
const guardWith = (store: PinStore, clock: { now: number }) =>
  createPinGuard({ store, randomBytes: rnd, monotonicNow: () => clock.now, iterations: 10 });

async function errar(guard: ReturnType<typeof createPinGuard>, vezes: number) {
  let ultimo;
  for (let i = 0; i < vezes; i += 1) ultimo = await guard.verify('9999');
  return ultimo;
}

describe('hash do PIN', () => {
  it('PBKDF2-SHA256 com o custo atual, sal de 16 bytes aleatório: o mesmo PIN gera hashes diferentes', () => {
    const a = createPinRecord('1234', rnd);
    const b = createPinRecord('1234', rnd);
    expect(a).toMatchObject({ v: 1, alg: 'pbkdf2-sha256', iterations: PIN_ITERATIONS });
    expect(a.salt).toMatch(/^[0-9a-f]{32}$/);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
    expect(JSON.stringify(a)).not.toContain('1234');
    expect(matchesRecord('1234', a)).toBe(true);
    expect(matchesRecord('1235', a)).toBe(false);
    expect(matchesRecord('12345', a)).toBe(false);
  });

  it('é determinístico para o mesmo sal e custo (vetor conhecido do PBKDF2-HMAC-SHA256)', () => {
    // RFC 7914, seção 11: P="passwd", S="salt", c=1, dkLen=64 (aqui os 32 primeiros bytes)
    const salt = new TextEncoder().encode('salt');
    const dk = Buffer.from(hashPin('passwd', salt, 1)).toString('hex');
    expect(dk).toBe('55ac046e56e3089fec1691c22544b605f94185216dde0465e68b9d57c20dacbc');
  });

  it('recusa PIN que não tem 4 números e gerador com tamanho errado', () => {
    expect(() => createPinRecord('12a4', rnd)).toThrow();
    expect(() => createPinRecord('1234', () => new Uint8Array(4))).toThrow();
  });

  it('comparação em tempo constante e registro adulterado ignorado', () => {
    expect(constantTimeEqual(Uint8Array.of(1, 2, 3), Uint8Array.of(1, 2, 3))).toBe(true);
    expect(constantTimeEqual(Uint8Array.of(1, 2, 3), Uint8Array.of(1, 2, 4))).toBe(false);
    expect(constantTimeEqual(Uint8Array.of(1, 2), Uint8Array.of(1, 2, 0))).toBe(false);
    const r = createPinRecord('1234', rnd, 10);
    expect(parsePinRecord(JSON.stringify(r))).toEqual(r);
    expect(parsePinRecord(JSON.stringify({ ...r, hash: 'zz' }))).toBeNull();
    expect(parsePinRecord(JSON.stringify({ ...r, iterations: 0 }))).toBeNull();
    expect(parsePinRecord('lixo')).toBeNull();
  });
});

describe('limite de tentativas', () => {
  it('a cada 5 erros seguidos, bloqueio de 30 s, 2 min, 10 min e 10 min daí em diante', () => {
    let s = NO_ATTEMPTS;
    for (let i = 0; i < 4; i += 1) s = afterFailure(s);
    expect(s).toEqual({ failures: 4, lockLevel: 0, remainingMs: 0 });
    s = afterFailure(s);
    expect(s).toEqual({ failures: 5, lockLevel: 1, remainingMs: 30_000 });
    expect([1, 2, 3, 4, 9].map(lockDurationMs)).toEqual([30_000, 120_000, 600_000, 600_000, 600_000]);
  });

  it('erra, bloqueia, não aceita nem o PIN certo durante o bloqueio e libera depois do tempo', async () => {
    const store = memoryStore();
    const clock = { now: 1_000 };
    const guard = guardWith(store, clock);
    await guard.save('1234');

    expect(await guard.verify('0000')).toEqual({ result: 'WRONG', attemptsBeforeLock: 4 });
    expect(await errar(guard, 3)).toEqual({ result: 'WRONG', attemptsBeforeLock: 1 });
    expect(await guard.verify('0000')).toEqual({ result: 'LOCKED', remainingMs: 30_000 });
    expect(await guard.verify('1234')).toEqual({ result: 'LOCKED', remainingMs: 30_000 });

    clock.now += 29_999;
    expect(await guard.lockRemainingMs()).toBe(1);
    clock.now += 1;
    expect(await guard.lockRemainingMs()).toBe(0);
    // Mais 5 erros: segundo nível
    expect(await errar(guard, 5)).toEqual({ result: 'LOCKED', remainingMs: 120_000 });
  });

  it('acerto zera as tentativas', async () => {
    const store = memoryStore();
    const guard = guardWith(store, { now: 0 });
    await guard.save('1234');
    await errar(guard, 4);
    expect(await guard.verify('1234')).toEqual({ result: 'OK' });
    expect(await guard.verify('0000')).toEqual({ result: 'WRONG', attemptsBeforeLock: 4 });
  });

  it('o bloqueio sobrevive a fechar o app e continua de onde parou (só desconta com o app aberto)', async () => {
    const store = memoryStore();
    const clock = { now: 50_000 };
    const guard = guardWith(store, clock);
    await guard.save('1234');
    await errar(guard, FAILURES_PER_LOCK);
    clock.now += 10_000;
    await guard.persist();

    // "Reabre o app": novo guard, relógio monotônico recomeça do zero
    const reaberto = guardWith(store, { now: 0 });
    expect(await reaberto.lockRemainingMs()).toBe(20_000);
    expect(await reaberto.verify('1234')).toEqual({ result: 'LOCKED', remainingMs: 20_000 });
  });

  it('adiantar o relógio do aparelho não destrava; estado adulterado volta ao bloqueio mais longo', async () => {
    const store = memoryStore();
    const clock = { now: 0 };
    const guard = guardWith(store, clock);
    await guard.save('1234');
    await errar(guard, FAILURES_PER_LOCK);
    const realDateNow = Date.now;
    Date.now = () => realDateNow() + 24 * 3_600_000;
    try {
      expect(await guard.lockRemainingMs()).toBe(30_000);
    } finally {
      Date.now = realDateNow;
    }

    expect(parseAttempts('{"failures":0,"lockLevel":0,"remainingMs":-5}')).toMatchObject({ remainingMs: 600_000 });
    expect(parseAttempts('{"failures":0,"lockLevel":0,"remainingMs":99999999}')).toMatchObject({ remainingMs: 600_000 });
    expect(parseAttempts('lixo')).toMatchObject({ remainingMs: 600_000 });
    expect(parseAttempts(null)).toEqual(NO_ATTEMPTS);
  });

  it('tempo restante legível para a tela', () => {
    expect(formatLockRemaining(30_000)).toBe('30 s');
    expect(formatLockRemaining(29_001)).toBe('30 s');
    expect(formatLockRemaining(119_000)).toBe('1 min 59 s');
  });
});

describe('gravação e migração do PIN antigo', () => {
  it('nunca guarda o PIN em texto', async () => {
    const store = memoryStore();
    await guardWith(store, { now: 0 }).save('4321');
    expect([...store.data.values()].some((v) => v.includes('4321'))).toBe(false);
    expect(store.data.has(PIN_KEYS.record)).toBe(true);
  });

  it('PIN antigo em texto vira hash no primeiro uso certo e o texto é apagado; errado não migra', async () => {
    const store = memoryStore({ [PIN_KEYS.legacyPlain]: '2580' });
    const guard = guardWith(store, { now: 0 });

    expect(await guard.verify('1111')).toEqual({ result: 'WRONG', attemptsBeforeLock: 4 });
    expect(store.data.get(PIN_KEYS.legacyPlain)).toBe('2580');

    expect(await guard.verify('2580')).toEqual({ result: 'OK' });
    expect(store.data.has(PIN_KEYS.legacyPlain)).toBe(false);
    expect(parsePinRecord(store.data.get(PIN_KEYS.record) ?? null)).not.toBeNull();
    expect(await guard.verify('2580')).toEqual({ result: 'OK' });
  });

  it('custo antigo é refeito com o custo atual no desbloqueio certo', async () => {
    const store = memoryStore({ [PIN_KEYS.record]: JSON.stringify(createPinRecord('1234', rnd, 5)) });
    await guardWith(store, { now: 0 }).verify('1234');
    expect(parsePinRecord(store.data.get(PIN_KEYS.record) ?? null)?.iterations).toBe(10);
  });

  it('sem PIN guardado responde NO_PIN; limpar apaga hash, texto antigo e tentativas', async () => {
    const store = memoryStore();
    const guard = guardWith(store, { now: 0 });
    expect(await guard.verify('1234')).toEqual({ result: 'NO_PIN' });
    await guard.save('1234');
    await errar(guard, 2);
    store.data.set(PIN_KEYS.legacyPlain, '1234');
    await guard.clear();
    expect(store.data.size).toBe(0);
  });
});
