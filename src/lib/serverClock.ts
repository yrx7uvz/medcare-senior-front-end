import { IS_DEMO } from '../config/env';
import type { DateKey } from '../types/domain';
import { apiDateTimeToEpochMs, saoPauloDateKey } from './apiTime';
import { parseDateTime, toDateKey } from './date';

/**
 * Relógio do servidor visto do aparelho. O celular pode estar adiantado ou atrasado: as janelas de dose vêm do
 * servidor e são comparadas com "agora" corrigido pela diferença medida no header Date das respostas da API.
 */
let offsetMs = 0;

/**
 * Diferença servidor - aparelho a partir do header Date (RFC 1123, precisão de 1 s, truncada) e dos instantes de
 * envio e de chegada da resposta. Header ausente ou ilegível devolve null (mantém a diferença anterior).
 */
export function computeClockOffset(dateHeader: string | null | undefined, sentAtMs: number, receivedAtMs: number): number | null {
  if (!dateHeader) return null;
  const serverMs = Date.parse(dateHeader);
  if (!Number.isFinite(serverMs)) return null;
  // O servidor carimbou em algum ponto do segundo [serverMs, serverMs + 1000): usa o meio dele e o meio da viagem
  return serverMs + 500 - (sentAtMs + receivedAtMs) / 2;
}

/** Registra a diferença medida numa resposta da API (chamado pelo cliente HTTP). */
export function recordServerDate(dateHeader: string | null | undefined, sentAtMs: number, receivedAtMs: number) {
  const offset = computeClockOffset(dateHeader, sentAtMs, receivedAtMs);
  // Diferença de até 2 s é ruído de medição (precisão do header e da rede)
  if (offset !== null) offsetMs = Math.abs(offset) < 2_000 ? 0 : Math.round(offset);
}

export const serverOffsetMs = () => offsetMs;
export const resetServerClock = () => {
  offsetMs = 0;
};

/** "Agora" para comparar com instantes do servidor. No demo, o relógio simulado já é a referência. */
export function appNowMs(now: Date): number {
  return IS_DEMO ? now.getTime() : now.getTime() + offsetMs;
}

/** Dia de hoje para as consultas: no modo real, o dia em São Paulo (fuso do servidor), não o do aparelho. */
export function appTodayKey(now: Date): DateKey {
  return IS_DEMO ? toDateKey(now) : saoPauloDateKey(appNowMs(now));
}

/**
 * Instante de uma data e hora de dose (janela, horário). No modo real, LocalDateTime de São Paulo vindo da API; no
 * demo, hora local do relógio simulado.
 */
export function doseInstantMs(key: string): number | null {
  if (IS_DEMO) {
    const ms = parseDateTime(key).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  return apiDateTimeToEpochMs(key);
}
