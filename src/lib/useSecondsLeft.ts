import { useEffect, useState } from 'react';

/** Espera do servidor entre dois envios do código do e-mail (CodigosPorEmailService.ESPERA_PARA_REENVIAR). */
export const RESEND_WAIT_MS = 60_000;

/** Segundos que faltam até `untilMs` (relógio do aparelho), atualizados a cada segundo; 0 depois disso ou sem prazo. */
export function useSecondsLeft(untilMs: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (untilMs === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [untilMs]);
  return untilMs === null ? 0 : Math.max(0, Math.ceil((untilMs - now) / 1000));
}

/** "Reenviar código" ou "Reenviar código em 0:42". */
export function resendLabel(secondsLeft: number): string {
  if (secondsLeft <= 0) return 'Reenviar código';
  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  return `Reenviar código em ${m}:${String(s).padStart(2, '0')}`;
}
