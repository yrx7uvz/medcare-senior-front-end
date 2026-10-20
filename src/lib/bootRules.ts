import { isJwtExpired } from './jwt';

export const SESSION_EXPIRED_MESSAGE = 'Sua sessão expirou. Entre novamente.';
export const ELDER_EXPIRED_MESSAGE = 'A conexão deste aparelho venceu. Peça um novo código a quem cuida de você.';

interface StoredSessions<C extends { token: string }, E extends { token: string }> {
  /** Perfil gravado no aparelho. */
  profile: 'CUIDADOR' | 'IDOSO' | null;
  caregiver: C | null;
  elder: E | null;
  isDemo: boolean;
  nowMs?: number;
}

/**
 * Decide, no boot, quais sessões guardadas ainda valem (sem SecureStore: testável). Token vencido ou ilegível é
 * descartado: o do cuidador leva ao login com aviso; o do idoso (180 dias) apaga a conexão e volta ao pareamento,
 * com aviso só se o aparelho estiver no perfil do idoso. No demo o token do idoso é fictício e não é conferido.
 */
export function resolveStoredSessions<C extends { token: string }, E extends { token: string }>(input: StoredSessions<C, E>) {
  const nowMs = input.nowMs ?? Date.now();
  let flash: string | null = null;
  const caregiverExpired = !!input.caregiver && isJwtExpired(input.caregiver.token, nowMs);
  if (caregiverExpired) flash = SESSION_EXPIRED_MESSAGE;
  const elderExpired = !input.isDemo && !!input.elder && isJwtExpired(input.elder.token, nowMs);
  if (elderExpired && input.profile === 'IDOSO') flash = ELDER_EXPIRED_MESSAGE;
  return {
    caregiver: caregiverExpired ? null : input.caregiver,
    elder: elderExpired ? null : input.elder,
    clearCaregiver: caregiverExpired,
    clearElder: elderExpired,
    flash,
  };
}
