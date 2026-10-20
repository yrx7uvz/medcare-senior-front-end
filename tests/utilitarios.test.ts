import { describe, expect, it, jest } from '@jest/globals';
import { addMinutes, formatLongDate, greeting, keyToDateBR, minutesBetween, startOfDay, toDateTimeKey, withTime } from '../src/lib/date';
import { liveAt } from '../src/lib/doseLive';
import { applyFieldErrors } from '../src/lib/formErrors';
import { decodeJwtPayload, getJwtExp, isJwtExpired } from '../src/lib/jwt';
import { colorName, defaultDoseQuantity, describeAppearance, routeLabel, sizeComparison } from '../src/lib/medicationMeta';
import { doseInstantMs } from '../src/lib/serverClock';
import { AppError } from '../src/services/errors';
import type { DoseView } from '../src/types/views';

const base64Url = (s: string) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const jwt = (payload: unknown) => `${base64Url('{"alg":"HS256"}')}.${base64Url(JSON.stringify(payload))}.assinatura`;

describe('JWT lido no aparelho (só a validade)', () => {
  it('lê o payload com acentos e o exp', () => {
    const token = jwt({ sub: '12', nome: 'José Ávila', exp: 2_000_000_000 });
    expect(decodeJwtPayload(token)).toEqual({ sub: '12', nome: 'José Ávila', exp: 2_000_000_000 });
    expect(getJwtExp(token)).toBe(2_000_000_000);
    expect(isJwtExpired(token, 1_999_999_999_000)).toBe(false);
    expect(isJwtExpired(token, 2_000_000_000_000)).toBe(true);
  });

  it('malformado, sem exp ou com payload que não é objeto conta como inválido', () => {
    for (const ruim of ['', 'a.b', 'a.!!!.c', `x.${base64Url('não json')}.y`, jwt([1, 2]), jwt(null)]) {
      expect(isJwtExpired(ruim, 0)).toBe(true);
    }
    expect(getJwtExp(jwt({ exp: 'amanhã' }))).toBeNull();
    // Byte UTF-8 inválido (0xFF) no payload
    expect(decodeJwtPayload(`x.${Buffer.from([0xff]).toString('base64url')}.y`)).toBeNull();
  });
});

describe('datas auxiliares', () => {
  it('início do dia, horário num dia, soma de minutos e diferença', () => {
    const d = new Date(2026, 9, 18, 14, 37, 12);
    expect(toDateTimeKey(startOfDay(d))).toBe('2026-10-18T00:00');
    expect(toDateTimeKey(withTime(d, '08:05'))).toBe('2026-10-18T08:05');
    expect(toDateTimeKey(addMinutes(withTime(d, '23:50'), 15))).toBe('2026-10-19T00:05');
    expect(minutesBetween(withTime(d, '09:00'), withTime(d, '08:30'))).toBe(30);
  });

  it('data por extenso, saudação e chave em DD/MM/AAAA', () => {
    expect(formatLongDate(new Date(2026, 9, 18))).toBe('Domingo, 18 de outubro de 2026');
    expect(greeting(new Date(2026, 9, 18, 9))).toBe('Bom dia');
    expect(greeting(new Date(2026, 9, 18, 13))).toBe('Boa tarde');
    expect(greeting(new Date(2026, 9, 18, 19))).toBe('Boa noite');
    expect(keyToDateBR('2026-01-05')).toBe('05/01/2026');
  });
});

describe('textos do remédio', () => {
  it('quantidade e via padrão por tipo', () => {
    expect(['COMPRIMIDO', 'CAPSULA', 'GOTAS', 'INJECAO', 'XAROPE', 'ADESIVO'].map((t) => defaultDoseQuantity(t as never))).toEqual([
      '1 comprimido', '1 cápsula', '10 gotas', '1 aplicação', '10 mL', '1 adesivo',
    ]);
    expect([routeLabel('ADESIVO'), routeLabel('INJECAO'), routeLabel('XAROPE')]).toEqual(['Uso na pele', 'Injetável', 'Via oral']);
  });

  it('comparação de tamanho e descrição para o leitor de tela', () => {
    expect([undefined, 5, 8, 12, 18, 25].map((mm) => sizeComparison(mm))).toEqual([
      null,
      'do tamanho de uma lentilha',
      'do tamanho de um grão de feijão',
      'do tamanho de um amendoim',
      'quase do tamanho de uma moeda de 10 centavos',
      'maior que uma moeda de 10 centavos',
    ]);
    expect(colorName('#ffffff')).toBe('branco');
    expect(colorName('#123456')).toBe('colorido');
    expect(colorName(undefined)).toBe('');
    expect(describeAppearance({ type: 'COMPRIMIDO', shape: 'OVAL', primaryColor: '#FFFFFF', lengthMm: 10, widthMm: 6, imprint: 'AB' })).toBe(
      'Comprimido, oval, branco, cerca de 10 por 6 milímetros, marcação AB',
    );
    expect(describeAppearance({ type: 'GOTAS', lengthMm: 10 })).toBe('Gotas');
  });
});

describe('outras regras puras', () => {
  it('instante da janela da dose no modo real é o LocalDateTime de São Paulo', () => {
    expect(doseInstantMs('2026-10-18T08:00')).toBe(Date.UTC(2026, 9, 18, 11, 0));
    expect(doseInstantMs('lixo')).toBeNull();
  });

  it('liveAt usa o agora da tela e a janela do servidor', () => {
    const dose = {
      storedStatus: 'PENDENTE', status: 'PENDENTE', confirmability: 'OK',
      window: { opensAt: '2026-10-18T07:00', alertAt: '2026-10-18T08:30', closesAt: '2026-10-18T11:00' },
    } as DoseView;
    expect(liveAt(dose, new Date(Date.UTC(2026, 9, 18, 11, 31))).status).toBe('ATRASADA');
  });

  it('erros por campo vão para o formulário e a contagem diz se algum campo recebeu', () => {
    const setError = jest.fn();
    const erro = new AppError('HTTP', 400, 'x', 'VALIDACAO', undefined, { email: 'já cadastrado', outro: 'y' });
    expect(applyFieldErrors(setError as never, erro, ['email', 'name'])).toBe(1);
    expect(setError).toHaveBeenCalledWith('email', { message: 'já cadastrado' });
    expect(applyFieldErrors(setError as never, undefined, ['email'])).toBe(0);
  });
});
