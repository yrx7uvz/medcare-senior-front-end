import { addDays, parseDateTime, toDateKey } from './date';
import type { PushPermission } from './pushCore';
import type { DateKey } from '../types/domain';

/**
 * O que pode impedir o lembrete de tocar na hora, no aparelho do paciente, e o aviso em linguagem simples. Puro:
 * permissão de notificações, alarme exato e bateria chegam de fora (expo-notifications e o módulo nativo local).
 */

export type ReminderIssue = 'NOTIFICACOES_DESLIGADAS' | 'ALARME_INEXATO' | 'TELA_CHEIA_BLOQUEADA';

export const REMINDER_OFF_MESSAGE = 'O lembrete do remédio está desligado. Toque aqui para ativar.';
export const REMINDER_LATE_MESSAGE = 'O lembrete pode atrasar. Toque aqui para ativar.';
export const REMINDER_OFF_ACTION = 'Ativar o lembrete';
export const REMINDER_LATE_ACTION = 'Ativar alarmes';
export const REMINDER_FULL_SCREEN_MESSAGE = 'O alarme do remédio pode não aparecer com o celular bloqueado. Toque aqui para permitir.';
export const REMINDER_FULL_SCREEN_ACTION = 'Permitir o alarme';

export const BATTERY_TITLE = 'Economia de bateria';
export const BATTERY_TIP =
  'Alguns celulares param o app para economizar bateria, e o lembrete pode atrasar. Toque abaixo, abra "Bateria" e escolha "Sem restrições".';
export const BATTERY_OK = 'Pronto: a economia de bateria não atrasa o lembrete.';
export const BATTERY_ACTION = 'Abrir ajuste de bateria';

export interface ReminderHealthState {
  /** Lembrete local existe neste aparelho (Android). */
  supported: boolean;
  /** Permissão de notificações; null enquanto é lida. */
  permission: PushPermission | null;
  /** O Android deixa agendar alarme exato; null = não dá para saber (Expo Go, aparelho sem o módulo nativo). */
  exactAlarm: boolean | null;
  /** Android 14+: o alarme da dose pode abrir por cima da tela bloqueada; null = não se sabe ou não se aplica. */
  fullScreen?: boolean | null;
}

/**
 * Problemas na ordem em que devem ser resolvidos: sem notificações nada toca, então esse vem primeiro. "Não sei"
 * (null) não vira aviso: o paciente não deve ser incomodado por um problema que talvez não exista.
 */
export function reminderIssues(state: ReminderHealthState): ReminderIssue[] {
  if (!state.supported) return [];
  const issues: ReminderIssue[] = [];
  if (state.permission === 'denied' || state.permission === 'undetermined') issues.push('NOTIFICACOES_DESLIGADAS');
  if (state.exactAlarm === false) issues.push('ALARME_INEXATO');
  if (state.fullScreen === false) issues.push('TELA_CHEIA_BLOQUEADA');
  return issues;
}

/** O aviso grande que aparece (um por vez: o mais importante). */
export function reminderWarning(state: ReminderHealthState): { issue: ReminderIssue; message: string; action: string } | null {
  const [issue] = reminderIssues(state);
  if (!issue) return null;
  if (issue === 'NOTIFICACOES_DESLIGADAS') return { issue, message: REMINDER_OFF_MESSAGE, action: REMINDER_OFF_ACTION };
  if (issue === 'ALARME_INEXATO') return { issue, message: REMINDER_LATE_MESSAGE, action: REMINDER_LATE_ACTION };
  return { issue, message: REMINDER_FULL_SCREEN_MESSAGE, action: REMINDER_FULL_SCREEN_ACTION };
}

/** Hoje e os dias seguintes que cobrem a janela de 72 h a partir de qualquer hora de hoje (4 dias). */
export function reminderDays(todayKey: DateKey, count = 4): DateKey[] {
  const today = parseDateTime(todayKey);
  return Array.from({ length: count }, (_, i) => toDateKey(addDays(today, i)));
}
