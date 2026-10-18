import type { DateKey } from '../types/domain';
import { pad } from './date';

/**
 * Datas e horas da API. O backend grava e devolve horários LOCAIS de America/Sao_Paulo, sem fuso
 * (LocalDateTime: '2026-10-18T14:30:00' ou com fração '...:00.123456'). Para comparar com o relógio
 * do aparelho, o instante é calculado SEMPRE em São Paulo, nunca no fuso configurado no celular.
 *
 * São Paulo usa UTC-03:00 o ano inteiro desde o fim do horário de verão (Decreto 9.772/2019). O
 * deslocamento fixo evita depender do suporte a fusos do Intl no Hermes; se o horário de verão
 * voltar, é aqui que se ajusta.
 */
export const SAO_PAULO_OFFSET_MINUTES = -180;

const LOCAL_DATE_TIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?$/;
const HAS_ZONE_RE = /(Z|[+-]\d{2}:?\d{2})$/i;

/**
 * Instante (epoch ms) de um LocalDateTime da API interpretado em São Paulo. Se a API um dia mandar
 * o fuso junto (Z ou ±hh:mm), ele é respeitado. Texto fora do formato devolve null.
 */
export function apiDateTimeToEpochMs(value: string): number | null {
  const text = value.trim();
  if (HAS_ZONE_RE.test(text)) {
    const ms = Date.parse(text);
    return Number.isFinite(ms) ? ms : null;
  }
  const m = LOCAL_DATE_TIME_RE.exec(text);
  if (!m) return null;
  const [, y, mo, d, h, mi, s = '0', frac = ''] = m;
  const millis = Number(frac.padEnd(3, '0').slice(0, 3));
  const utc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s), millis);
  const check = new Date(utc);
  // Recusa datas impossíveis (ex.: 31/02), que o Date.UTC "corrigiria" em silêncio
  if (check.getUTCMonth() !== Number(mo) - 1 || check.getUTCDate() !== Number(d) || Number(h) > 23 || Number(mi) > 59) {
    return null;
  }
  return utc - SAO_PAULO_OFFSET_MINUTES * 60_000;
}

/** Data de hoje (AAAA-MM-DD) em São Paulo para um instante, independente do fuso do aparelho. */
export function saoPauloDateKey(epochMs: number): DateKey {
  const local = new Date(epochMs + SAO_PAULO_OFFSET_MINUTES * 60_000);
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`;
}

/** LocalTime da API ('08:00:00', '08:00' ou '08:00:00.5') para 'HH:mm'. Fora do formato devolve null. */
export function apiTimeToHHmm(value: string): string | null {
  const m = /^(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value.trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return `${m[1]}:${m[2]}`;
}

/** DayOfWeek do Java ('MONDAY'...'SUNDAY') <-> dia do app (0 = domingo ... 6 = sábado). */
export const API_WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;
export type ApiWeekday = (typeof API_WEEKDAYS)[number];

export function apiWeekdayToIndex(value: string): number | null {
  const i = API_WEEKDAYS.indexOf(value as ApiWeekday);
  return i >= 0 ? i : null;
}

export function indexToApiWeekday(index: number): ApiWeekday {
  const day = API_WEEKDAYS[index];
  if (!day) throw new RangeError(`Dia da semana inválido: ${index}`);
  return day;
}
