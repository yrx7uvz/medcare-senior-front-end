import type { ReportService } from '../../services/types';
import type { AdherenceItem } from '../../types/views';
import { httpError } from '../../services/errors';
import { getNow } from '../../lib/clock';
import { toDateTimeKey } from '../../lib/date';
import { dailyTotals } from '../../lib/dailyReport';
import { isConfirmed } from '../../lib/doseRules';
import { pdfFileName, pdfPeriod } from '../../lib/pdfReport';
import { getDb } from '../../mocks/db';
import { toDoseView } from './doseViews';
import { demoPdfBytes } from './demoPdf';
import { simulate } from './simulate';

const slug = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/**
 * Adesão = doses confirmadas (no prazo ou com atraso) ÷ doses encerradas
 * (confirmadas + não tomadas). Doses ainda abertas não entram na conta.
 */
function adherence(elderId: string, from: string, to: string) {
  if (from > to) throw httpError(400, 'A data de início não pode ser posterior à data de fim.');
  const db = getDb();
  const elder = db.elders.find((e) => e.id === elderId);
  if (!elder) throw httpError(404, 'Paciente não encontrado.');
  const now = getNow();
  const nowKey = toDateTimeKey(now);
  const views = db.doses
    .filter((d) => d.elderId === elderId && d.scheduledAt.slice(0, 10) >= from && d.scheduledAt.slice(0, 10) <= to && d.scheduledAt <= nowKey)
    .map((d) => toDoseView(d, now));

  const byMed = new Map<string, AdherenceItem>();
  for (const v of views) {
    const item =
      byMed.get(v.medication.id) ??
      { medication: v.medication, total: 0, confirmed: 0, late: 0, missed: 0, open: 0, rate: null };
    item.total += 1;
    if (isConfirmed(v.status)) item.confirmed += 1;
    if (v.status === 'CONFIRMADA_COM_ATRASO') item.late += 1;
    if (v.status === 'NAO_TOMADA') item.missed += 1;
    if (v.status === 'PENDENTE' || v.status === 'ATRASADA') item.open += 1;
    byMed.set(v.medication.id, item);
  }
  const items = [...byMed.values()]
    .map((i) => ({ ...i, rate: i.confirmed + i.missed > 0 ? Math.round((i.confirmed / (i.confirmed + i.missed)) * 100) : null }))
    .sort((a, b) => a.medication.name.localeCompare(b.medication.name));
  const confirmed = items.reduce((s, i) => s + i.confirmed, 0);
  const closed = items.reduce((s, i) => s + i.confirmed + i.missed, 0);
  return {
    elder,
    from,
    to,
    items,
    overallRate: closed ? Math.round((confirmed / closed) * 100) : null,
    totalDoses: views.length,
  };
}

export const mockReportService: ReportService = {
  getDaily: (elderId, day) =>
    simulate(() => {
      const db = getDb();
      const elder = db.elders.find((e) => e.id === elderId);
      if (!elder) throw httpError(404, 'Paciente não encontrado.');
      const now = getNow();
      const doses = db.doses
        .filter((d) => d.elderId === elderId && d.scheduledAt.startsWith(day))
        .map((d) => toDoseView(d, now))
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
      return { elder: { id: elder.id, name: elder.name }, day, totals: dailyTotals(doses.map((d) => d.storedStatus)), doses };
    }),

  getAdherence: (elderId, from, to) => simulate(() => adherence(elderId, from, to)),

  /** Mesmas regras de período do servidor; o arquivo é um PDF de exemplo marcado como demonstração. */
  downloadPdf: (elderId, from, to) =>
    simulate(() => {
      const period = pdfPeriod(keyToBR(from), keyToBR(to));
      if (period.error) throw httpError(400, period.error, 'VALIDACAO');
      const report = adherence(elderId, from, to);
      if (report.totalDoses === 0) throw httpError(422, 'Não há doses registradas neste período.', 'PERIODO_SEM_REGISTROS');
      return {
        fileName: `demonstracao-${pdfFileName(slug(report.elder.name), from, to)}`,
        bytes: demoPdfBytes(`Historico de adesao de ${from} a ${to} (exemplo)`),
        demo: true,
      };
    }, 1400),
};

const keyToBR = (key: string) => key.split('-').reverse().join('/');
