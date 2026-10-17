import { useEffect, useState } from 'react';
import { getNow, useClockStore } from './clock';

/** Hora atual do protótipo, re-renderizando a cada `intervalMs`. */
export function useNow(intervalMs = 15_000): Date {
  const [now, setNow] = useState(getNow);
  const baseMs = useClockStore((s) => s.baseMs);
  useEffect(() => {
    setNow(getNow());
    const id = setInterval(() => setNow(getNow()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, baseMs]);
  return now;
}

/** Chave que muda a cada minuto, usada para atualizar status em segundo plano. */
export const minuteStamp = (d: Date) => Math.floor(d.getTime() / 60_000);
