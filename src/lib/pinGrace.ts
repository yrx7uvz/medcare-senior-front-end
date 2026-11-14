/**
 * Quando pedir o PIN do paciente, sem React nem SecureStore (testável). Como nos apps de banco e de saúde: o PIN é
 * pedido só se o app ficou sem uso desbloqueado por mais que a tolerância. O paciente escolhe em Ajustes: sempre,
 * depois de 10 minutos (padrão) ou nunca neste celular.
 */

/** Tolerância padrão: 10 minutos desde o último uso desbloqueado. */
export const PIN_GRACE_MS = 10 * 60_000;

/** Intervalo mínimo entre duas gravações do "último uso" por toque (não grava a cada toque). */
export const ACTIVITY_WRITE_INTERVAL_MS = 60_000;

export type PinAskMode = 'ALWAYS' | 'AFTER_GRACE' | 'NEVER';
export const DEFAULT_PIN_ASK_MODE: PinAskMode = 'AFTER_GRACE';

export const PIN_ASK_OPTIONS: readonly { value: PinAskMode; label: string }[] = [
  { value: 'ALWAYS', label: 'Sempre' },
  { value: 'AFTER_GRACE', label: 'Depois de 10 minutos' },
  { value: 'NEVER', label: 'Nunca neste celular' },
];

export const PIN_NEVER_WARNING = 'Qualquer pessoa com este celular poderá ver os remédios.';

/**
 * true = pedir o PIN. Pede no primeiro acesso (sem último uso), com valor ilegível, com relógio inconsistente (último
 * uso no futuro: o relógio voltou) e quando passou MAIS que a tolerância. Exatamente na tolerância ainda entra.
 */
export function deveBloquear(ultimoUsoMs: number | null | undefined, agoraMs: number, toleranciaMs: number = PIN_GRACE_MS): boolean {
  if (ultimoUsoMs === null || ultimoUsoMs === undefined || !Number.isFinite(ultimoUsoMs) || !Number.isFinite(agoraMs)) return true;
  if (ultimoUsoMs > agoraMs) return true;
  return agoraMs - ultimoUsoMs > toleranciaMs;
}

/** A escolha do paciente decide antes da tolerância: "Sempre" pede, "Nunca" não pede. */
export function shouldAskPin(mode: PinAskMode, ultimoUsoMs: number | null | undefined, agoraMs: number): boolean {
  if (mode === 'ALWAYS') return true;
  if (mode === 'NEVER') return false;
  return deveBloquear(ultimoUsoMs, agoraMs, PIN_GRACE_MS);
}

/** Último uso gravado (texto com o epoch em ms); qualquer outra coisa vira null (e o PIN é pedido). */
export function parseLastUse(raw: string | null): number | null {
  if (raw === null || !/^\d{1,15}$/.test(raw)) return null;
  return Number(raw);
}

/** Escolha gravada; ilegível volta ao padrão (10 minutos), nunca ao "Nunca". */
export function parsePinAskMode(raw: string | null): PinAskMode {
  return raw === 'ALWAYS' || raw === 'AFTER_GRACE' || raw === 'NEVER' ? raw : DEFAULT_PIN_ASK_MODE;
}

/** Grava o último uso por toque só se a última gravação já tem mais de um minuto (ou se o relógio voltou). */
export function shouldWriteActivity(lastWrittenMs: number | null, agoraMs: number, intervalMs: number = ACTIVITY_WRITE_INTERVAL_MS): boolean {
  if (lastWrittenMs === null || lastWrittenMs > agoraMs) return true;
  return agoraMs - lastWrittenMs >= intervalMs;
}
