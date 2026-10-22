import type { DoseStatus } from '../types/domain';
import type { DailyReportTotals } from '../types/views';

/**
 * Totais do relatório diário pelo status GRAVADO de cada dose (o mesmo cálculo do backend, GET /api/relatorios/diario):
 * aderência = (CONFIRMADA_NO_HORARIO + CONFIRMADA_COM_ATRASO) / (total - pendentes) * 100, com 1 casa; null sem dose encerrada.
 */
export function dailyTotals(statuses: readonly DoseStatus[]): DailyReportTotals {
  const count = (s: DoseStatus) => statuses.filter((x) => x === s).length;
  const onTime = count('CONFIRMADA_NO_HORARIO');
  const late = count('CONFIRMADA_COM_ATRASO');
  const missed = count('NAO_TOMADA');
  const pending = count('PENDENTE');
  const closed = statuses.length - pending;
  return {
    total: statuses.length,
    onTime,
    late,
    missed,
    pending,
    adherencePercent: closed === 0 ? null : Math.round(((onTime + late) / closed) * 1000) / 10,
  };
}
