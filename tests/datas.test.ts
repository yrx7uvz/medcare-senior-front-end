import { afterEach, describe, expect, it } from '@jest/globals';
import { apiDateTimeToEpochMs, apiTimeToHHmm, apiWeekdayToIndex, indexToApiWeekday, saoPauloDateKey } from '../src/lib/apiTime';
import {
  addDays,
  ageOn,
  dateBRToKey,
  formatCountdown,
  formatDateBR,
  formatDayHeader,
  formatTime,
  initials,
  firstName,
  parseDateBR,
  parseDateTime,
  toDateKey,
  toDateTimeKey,
} from '../src/lib/date';
import { emptyHistoryNotice, historyRange, shiftDateKey } from '../src/lib/history';
import { appNowMs, appTodayKey, computeClockOffset, recordServerDate, resetServerClock, serverOffsetMs } from '../src/lib/serverClock';

describe('datas locais do app', () => {
  it('chaves AAAA-MM-DD e AAAA-MM-DDTHH:mm vão e voltam sem mudar', () => {
    const d = parseDateTime('2026-10-18T08:05');
    expect(toDateTimeKey(d)).toBe('2026-10-18T08:05');
    expect(toDateKey(parseDateTime('2026-02-28'))).toBe('2026-02-28');
    expect(formatTime('2026-10-18T08:05')).toBe('08:05');
    expect(formatDateBR('2026-10-08')).toBe('08/10/2026');
  });

  it('DD/MM/AAAA válida vira chave; data impossível é recusada', () => {
    expect(dateBRToKey('29/02/2024')).toBe('2024-02-29');
    expect(dateBRToKey('29/02/2026')).toBeNull();
    expect(parseDateBR('1/1/2026')).toBeNull();
  });

  it('cabeçalhos de dia, idade, contagem regressiva e nomes', () => {
    expect(formatDayHeader('2026-10-18', '2026-10-18')).toBe('Hoje, 18 de out');
    expect(formatDayHeader('2026-10-17', '2026-10-18')).toBe('Ontem, 17 de out');
    expect(formatDayHeader('2026-10-15', '2026-10-18')).toBe('Qui, 15 de out');
    expect(ageOn('1945-10-19', new Date(2026, 9, 18))).toBe(80);
    expect(ageOn('1945-10-18', new Date(2026, 9, 18))).toBe(81);
    expect(formatCountdown(3_725_000)).toBe('01:02:05');
    expect(formatCountdown(-5)).toBe('00:00');
    expect(firstName('  Maria  da Silva ')).toBe('Maria');
    expect(initials('maria da silva')).toBe('MS');
  });

  it('soma de dias atravessa mês e ano', () => {
    expect(toDateKey(addDays(new Date(2026, 11, 31), 1))).toBe('2027-01-01');
    expect(shiftDateKey('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('datas da API no fuso de São Paulo', () => {
  const fusoOriginal = process.env.TZ;
  afterEach(() => {
    if (fusoOriginal === undefined) delete process.env.TZ;
    else process.env.TZ = fusoOriginal;
  });

  it('LocalDateTime é interpretado em São Paulo (UTC-3), com segundos e fração, em qualquer fuso do aparelho', () => {
    for (const tz of ['America/Sao_Paulo', 'Asia/Tokyo', 'UTC']) {
      process.env.TZ = tz;
      expect(apiDateTimeToEpochMs('2026-10-18T08:00')).toBe(Date.UTC(2026, 9, 18, 11, 0));
      expect(apiDateTimeToEpochMs('2026-10-18T08:00:30.123456')).toBe(Date.UTC(2026, 9, 18, 11, 0, 30, 123));
      expect(saoPauloDateKey(Date.UTC(2026, 9, 18, 2, 59))).toBe('2026-10-17');
      expect(saoPauloDateKey(Date.UTC(2026, 9, 18, 3, 0))).toBe('2026-10-18');
    }
  });

  it('respeita o fuso explícito e recusa formato ou data impossível', () => {
    expect(apiDateTimeToEpochMs('2026-10-18T08:00:00Z')).toBe(Date.UTC(2026, 9, 18, 8, 0));
    expect(apiDateTimeToEpochMs('2026-02-31T08:00')).toBeNull();
    expect(apiDateTimeToEpochMs('18/10/2026 08:00')).toBeNull();
  });

  it('LocalTime vira HH:mm e DayOfWeek vira índice (0 = domingo)', () => {
    expect(apiTimeToHHmm('08:00:00')).toBe('08:00');
    expect(apiTimeToHHmm('23:59:00.5')).toBe('23:59');
    expect(apiTimeToHHmm('24:00')).toBeNull();
    expect(apiWeekdayToIndex('SUNDAY')).toBe(0);
    expect(apiWeekdayToIndex('FERIADO')).toBeNull();
    expect(indexToApiWeekday(6)).toBe('SATURDAY');
    expect(() => indexToApiWeekday(7)).toThrow(RangeError);
  });
});

describe('relógio do servidor', () => {
  afterEach(() => resetServerClock());

  it('mede a diferença pelo header Date e ignora ruído de até 2 s', () => {
    const header = new Date(Date.UTC(2026, 9, 18, 12, 2, 0)).toUTCString();
    const envio = Date.UTC(2026, 9, 18, 12, 0, 0);
    expect(computeClockOffset(header, envio, envio + 200)).toBe(120_400);
    expect(computeClockOffset('não é data', envio, envio)).toBeNull();
    recordServerDate(header, envio, envio + 200);
    expect(serverOffsetMs()).toBe(120_400);
    expect(appNowMs(new Date(1_000))).toBe(121_400);
    recordServerDate(new Date(envio + 1_000).toUTCString(), envio, envio);
    expect(serverOffsetMs()).toBe(0);
  });

  it('o dia de hoje é o de São Paulo com o relógio corrigido', () => {
    expect(appTodayKey(new Date(Date.UTC(2026, 9, 18, 2, 59)))).toBe('2026-10-17');
    recordServerDate(new Date(Date.UTC(2026, 9, 18, 3, 1)).toUTCString(), Date.UTC(2026, 9, 18, 2, 59), Date.UTC(2026, 9, 18, 2, 59));
    expect(appTodayKey(new Date(Date.UTC(2026, 9, 18, 2, 59)))).toBe('2026-10-18');
  });
});

describe('período do histórico (RN-011)', () => {
  it('7 e 30 dias contando hoje, personalizado e recusas', () => {
    expect(historyRange('7', '2026-10-18', '', '')).toEqual({ from: '2026-10-12', to: '2026-10-18', error: null });
    expect(historyRange('30', '2026-10-18', '', '').from).toBe('2026-09-19');
    expect(historyRange('custom', '2026-10-18', '01/10/2026', '01/10/2026').error).toBeNull();
    expect(historyRange('custom', '2026-10-18', '02/10/2026', '01/10/2026').error).toMatch(/início não pode ser depois/);
    expect(historyRange('custom', '2026-10-18', '', '01/10/2026').error).toMatch(/DD\/MM\/AAAA/);
  });

  it('aviso de período sem registros diz o período e sugere mudar os filtros', () => {
    expect(emptyHistoryNotice({ from: '2026-10-01', to: '2026-10-18' }, false)).toEqual({
      title: 'Nenhum registro no período',
      description: 'Não há doses registradas entre 01/10/2026 e 18/10/2026. Escolha outro período.',
    });
    expect(emptyHistoryNotice({ from: '2026-10-18', to: '2026-10-18' }, true).description).toMatch(/em 18\/10\/2026 com os filtros/);
  });
});
