/**
 * Lista de horários de um tratamento no formulário: sempre em ordem, sem repetidos no mesmo dia. Pura, para o
 * formulário e os testes.
 */
export interface TimeEntry {
  time: string;
}

export const DUPLICATE_TIME_MESSAGE = 'Este horário já está na lista.';
export const EMPTY_TIMES_MESSAGE = 'Informe ao menos um horário.';

const byTime = (a: TimeEntry, b: TimeEntry) => a.time.localeCompare(b.time);

/** Acrescenta o horário em ordem; repetido não entra e devolve o motivo. */
export function addTime(times: readonly TimeEntry[], time: string): { times: TimeEntry[]; error: string | null } {
  if (times.some((t) => t.time === time)) return { times: [...times], error: DUPLICATE_TIME_MESSAGE };
  return { times: [...times, { time }].sort(byTime), error: null };
}

/** Tira o horário (inclusive o último: a validação pede ao menos um ao salvar). */
export function removeTime(times: readonly TimeEntry[], time: string): TimeEntry[] {
  return times.filter((t) => t.time !== time);
}
