import type { DateKey, DateTimeKey } from '../types/domain';

/**
 * Datas trafegam como strings locais ('AAAA-MM-DD' e 'AAAA-MM-DDTHH:mm'), como o
 * backend (fuso America/Sao_Paulo). Formatação manual evita depender de Intl.
 */
export const pad = (n: number) => String(n).padStart(2, '0');

export const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const WEEKDAYS_LONG = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
export const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function toDateKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toDateTimeKey(d: Date): DateTimeKey {
  return `${toDateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseDateTime(value: DateTimeKey | DateKey): Date {
  const [datePart, timePart = '00:00'] = value.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

export function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}

/** a − b em minutos. */
export function minutesBetween(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / 60_000;
}

export function withTime(day: Date, time: string): Date {
  const [hh, mm] = time.split(':').map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hh, mm, 0, 0);
}

export function formatTime(d: Date | DateTimeKey): string {
  const date = typeof d === 'string' ? parseDateTime(d) : d;
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDateBR(d: Date | DateKey): string {
  const date = typeof d === 'string' ? parseDateTime(d) : d;
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function formatLongDate(d: Date): string {
  return `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
}

export function formatDayHeader(day: DateKey, today: DateKey): string {
  const d = parseDateTime(day);
  const base = `${d.getDate()} de ${MONTHS_SHORT[d.getMonth()]}`;
  if (day === today) return `Hoje, ${base}`;
  if (day === toDateKey(addDays(parseDateTime(today), -1))) return `Ontem, ${base}`;
  return `${WEEKDAYS_SHORT[d.getDay()]}, ${base}`;
}

/** 'DD/MM/AAAA' → Date válida ou null. */
export function parseDateBR(value: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (d.getFullYear() !== Number(yyyy) || d.getMonth() !== Number(mm) - 1 || d.getDate() !== Number(dd)) return null;
  return d;
}

export const isValidDateBR = (value: string) => parseDateBR(value) !== null;

export function dateBRToKey(value: string): DateKey | null {
  const d = parseDateBR(value);
  return d ? toDateKey(d) : null;
}

export function keyToDateBR(key: DateKey): string {
  return formatDateBR(key);
}

export function ageOn(birth: DateKey, today: Date): number {
  const b = parseDateTime(birth);
  let age = today.getFullYear() - b.getFullYear();
  const beforeBirthday =
    today.getMonth() < b.getMonth() || (today.getMonth() === b.getMonth() && today.getDate() < b.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function greeting(d: Date): string {
  const h = d.getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}
