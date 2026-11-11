import { describe, expect, it } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { createPinGuard, PIN_KEYS, type PinStore } from '../src/lib/pinCore';
import {
  ACTIVITY_WRITE_INTERVAL_MS,
  DEFAULT_PIN_ASK_MODE,
  deveBloquear,
  parseLastUse,
  parsePinAskMode,
  PIN_ASK_OPTIONS,
  PIN_GRACE_MS,
  shouldAskPin,
  shouldWriteActivity,
} from '../src/lib/pinGrace';

const MIN = 60_000;
const AGORA = Date.UTC(2026, 10, 11, 15, 0);
const atras = (min: number, seg = 0) => AGORA - min * MIN - seg * 1000;

describe('tolerância do PIN do paciente', () => {
  it('é de 10 minutos', () => {
    expect(PIN_GRACE_MS).toBe(10 * MIN);
  });

  it('fronteiras: 9:59 e 10:00 entram direto; 10:01 pede o PIN', () => {
    expect(deveBloquear(atras(9, 59), AGORA)).toBe(false);
    expect(deveBloquear(atras(10), AGORA)).toBe(false);
    expect(deveBloquear(atras(10, 1), AGORA)).toBe(true);
    expect(deveBloquear(atras(0), AGORA)).toBe(false);
  });

  it('primeiro acesso, valor ausente ou inválido: pede o PIN', () => {
    expect(deveBloquear(null, AGORA)).toBe(true);
    expect(deveBloquear(undefined, AGORA)).toBe(true);
    expect(deveBloquear(Number.NaN, AGORA)).toBe(true);
    expect(deveBloquear(Number.POSITIVE_INFINITY, AGORA)).toBe(true);
  });

  it('relógio que voltou (último uso no futuro): pede o PIN', () => {
    expect(deveBloquear(AGORA + 1, AGORA)).toBe(true);
    expect(deveBloquear(AGORA + 5 * MIN, AGORA)).toBe(true);
  });

  it('aceita outra tolerância', () => {
    expect(deveBloquear(atras(2), AGORA, MIN)).toBe(true);
    expect(deveBloquear(atras(1), AGORA, MIN)).toBe(false);
  });
});

describe('escolha "Pedir o PIN ao abrir o app"', () => {
  it('três opções, com "Depois de 10 minutos" como padrão', () => {
    expect(PIN_ASK_OPTIONS.map((o) => o.label)).toEqual(['Sempre', 'Depois de 10 minutos', 'Nunca neste celular']);
    expect(DEFAULT_PIN_ASK_MODE).toBe('AFTER_GRACE');
  });

  it('Sempre pede; Nunca não pede; o padrão segue a tolerância', () => {
    expect(shouldAskPin('ALWAYS', atras(0), AGORA)).toBe(true);
    expect(shouldAskPin('NEVER', null, AGORA)).toBe(false);
    expect(shouldAskPin('NEVER', atras(600), AGORA)).toBe(false);
    expect(shouldAskPin('AFTER_GRACE', atras(5), AGORA)).toBe(false);
    expect(shouldAskPin('AFTER_GRACE', atras(11), AGORA)).toBe(true);
  });

  it('valor gravado ilegível volta ao padrão, nunca ao "Nunca"', () => {
    expect(parsePinAskMode(null)).toBe('AFTER_GRACE');
    expect(parsePinAskMode('nunca')).toBe('AFTER_GRACE');
    expect(parsePinAskMode('NEVER')).toBe('NEVER');
    expect(parsePinAskMode('ALWAYS')).toBe('ALWAYS');
  });

  it('último uso gravado: só números', () => {
    expect(parseLastUse(String(AGORA))).toBe(AGORA);
    expect(parseLastUse(null)).toBeNull();
    expect(parseLastUse('')).toBeNull();
    expect(parseLastUse('-5')).toBeNull();
    expect(parseLastUse('12abc')).toBeNull();
  });
});

describe('gravação do último uso pelos toques', () => {
  it('no máximo uma vez por minuto (e de novo se o relógio voltou)', () => {
    expect(ACTIVITY_WRITE_INTERVAL_MS).toBe(MIN);
    expect(shouldWriteActivity(null, AGORA)).toBe(true);
    expect(shouldWriteActivity(AGORA - 30_000, AGORA)).toBe(false);
    expect(shouldWriteActivity(AGORA - MIN, AGORA)).toBe(true);
    expect(shouldWriteActivity(AGORA + 1, AGORA)).toBe(true);
  });
});

describe('carimbo junto do PIN', () => {
  function memoryStore(): PinStore & { data: Map<string, string> } {
    const data = new Map<string, string>();
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

  it('desconectar (ou esquecer o PIN) apaga também o último uso e a escolha', async () => {
    const store = memoryStore();
    const guard = createPinGuard({ store, randomBytes: (n) => new Uint8Array(randomBytes(n)), monotonicNow: () => 0, iterations: 10 });
    await guard.save('1234');
    await store.set(PIN_KEYS.lastUse, String(AGORA));
    await store.set(PIN_KEYS.askMode, 'NEVER');

    await guard.clear();

    expect([...store.data.keys()]).toEqual([]);
  });

  it('as chaves ficam no mesmo prefixo do PIN', () => {
    expect(PIN_KEYS.lastUse.startsWith('medcare.elder.pin')).toBe(true);
    expect(PIN_KEYS.askMode.startsWith('medcare.elder.pin')).toBe(true);
  });
});
