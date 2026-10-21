import type { DateKey, ID } from '../types/domain';
import type { DoseView, HistoryPage, HistoryStatusFilter } from '../types/views';
import { addDays, dateBRToKey, parseDateTime, toDateKey } from './date';

/** Filtros de status do histórico: o status gravado da dose, como a API filtra. */
export const HISTORY_STATUS_FILTERS: readonly { value: HistoryStatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'TOMADA', label: 'No horário' },
  { value: 'CONFIRMADA_COM_ATRASO', label: 'Com atraso' },
  { value: 'NAO_TOMADA', label: 'Não tomadas' },
  { value: 'PENDENTE', label: 'Pendentes' },
];

/** Itens por página pedidos à API (máximo 100). */
export const HISTORY_PAGE_SIZE = 20;

export type HistoryPeriod = '7' | '30' | 'custom';

export interface HistoryRange {
  from: DateKey;
  to: DateKey;
  /** Mensagem para a tela quando o período personalizado é inválido (não consulta a API). */
  error: string | null;
}

/** Dia `days` antes/depois de uma data 'AAAA-MM-DD', sem passar pelo fuso do aparelho. */
export const shiftDateKey = (key: DateKey, days: number): DateKey => toDateKey(addDays(parseDateTime(key), days));

/**
 * Período do histórico a partir do "hoje" do app (fuso de São Paulo): últimos 7 ou 30 dias, contando hoje, ou o
 * personalizado em DD/MM/AAAA. Início depois do fim é recusado aqui, antes de chamar a API (RN-011).
 */
export function historyRange(period: HistoryPeriod, todayKey: DateKey, customFrom: string, customTo: string): HistoryRange {
  if (period !== 'custom') return { from: shiftDateKey(todayKey, -(Number(period) - 1)), to: todayKey, error: null };
  const from = dateBRToKey(customFrom);
  const to = dateBRToKey(customTo);
  if (!from || !to) return { from: todayKey, to: todayKey, error: 'Use datas no formato DD/MM/AAAA.' };
  if (from > to) return { from, to, error: 'A data de início não pode ser depois da data de fim.' };
  return { from, to, error: null };
}

/** Caminho de GET /api/historico com só os filtros informados (idoso "Todos" e status "Todos" não vão). */
export function historyPath(
  base: string,
  params: { elderApiId?: number; medicationApiId?: number; from: DateKey; to: DateKey; status: HistoryStatusFilter; page: number; size: number },
): string {
  const query: [string, string][] = [];
  if (params.elderApiId !== undefined) query.push(['idosoId', String(params.elderApiId)]);
  if (params.medicationApiId !== undefined) query.push(['medicamentoId', String(params.medicationApiId)]);
  query.push(['de', params.from], ['ate', params.to]);
  if (params.status !== 'ALL') query.push(['status', params.status]);
  query.push(['page', String(params.page)], ['size', String(params.size)]);
  return `${base}?${query.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
}

/** Há página seguinte para "carregar mais". */
export const hasMoreHistory = (page: Pick<HistoryPage, 'page' | 'totalPages'>) => page.page + 1 < page.totalPages;

/**
 * Junta a primeira página (que pode ter sido atualizada) com as seguintes já carregadas, sem repetir dose: a versão
 * da primeira página vale. A ordem continua do mais recente para o mais antigo.
 */
export function mergeHistory(first: DoseView[], more: DoseView[]): DoseView[] {
  const seen = new Set<ID>(first.map((d) => d.id));
  return [...first, ...more.filter((d) => !seen.has(d.id))];
}

/** Título e texto do aviso de período sem registros (RN-011). */
export function emptyHistoryNotice(range: Pick<HistoryRange, 'from' | 'to'>, filtered: boolean): { title: string; description: string } {
  const [fy, fm, fd] = range.from.split('-');
  const [ty, tm, td] = range.to.split('-');
  const period = range.from === range.to ? `em ${fd}/${fm}/${fy}` : `entre ${fd}/${fm}/${fy} e ${td}/${tm}/${ty}`;
  return {
    title: 'Nenhum registro no período',
    description: filtered
      ? `Não há doses ${period} com os filtros escolhidos. Mude o status, o remédio ou o período.`
      : `Não há doses registradas ${period}. Escolha outro período.`,
  };
}
