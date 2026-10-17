import type { DoseView } from '../../types/views';

/**
 * Próxima dose do idoso: primeiro as atrasadas que ainda podem ser confirmadas,
 * depois as do horário; se nenhuma estiver liberada, a próxima do dia.
 */
export function pickNextDose(doses: DoseView[], afterId?: string): DoseView | undefined {
  const open = doses.filter((d) => d.storedStatus === 'PENDENTE' && d.status !== 'NAO_TOMADA' && d.id !== afterId);
  const byTime = (a: DoseView, b: DoseView) => a.scheduledAt.localeCompare(b.scheduledAt);
  const confirmable = open.filter((d) => d.confirmability === 'OK').sort((a, b) => {
    const la = a.status === 'ATRASADA' ? 0 : 1;
    const lb = b.status === 'ATRASADA' ? 0 : 1;
    return la - lb || byTime(a, b);
  });
  return confirmable[0] ?? open.filter((d) => d.confirmability === 'MUITO_CEDO').sort(byTime)[0];
}
