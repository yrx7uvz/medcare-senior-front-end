import type { DateKey } from '../types/domain';
import { dateBRToKey } from './date';

/** Maior período do PDF (o servidor recusa acima disso com 400). */
export const PDF_MAX_MONTHS = 12;

/** Soma meses a 'AAAA-MM-DD' como o servidor (LocalDate.plusMonths): 31/01 + 1 mês = 28 ou 29/02. */
export function addMonthsKey(key: DateKey, months: number): DateKey {
  const [y, m, d] = key.split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const keyToBR = (key: DateKey) => key.split('-').reverse().join('/');

/**
 * Período do PDF digitado em DD/MM/AAAA, conferido antes de chamar o servidor: formato, início depois do fim e no
 * máximo 12 meses (de 10/01/2025 a 10/01/2026 vale; até 11/01/2026, não).
 */
export function pdfPeriod(fromBR: string, toBR: string): { from: DateKey; to: DateKey; error: null } | { error: string } {
  const from = dateBRToKey(fromBR);
  const to = dateBRToKey(toBR);
  if (!from || !to) return { error: 'Use datas no formato DD/MM/AAAA.' };
  if (from > to) return { error: 'A data de início não pode ser depois da data de fim.' };
  const max = addMonthsKey(from, PDF_MAX_MONTHS);
  if (to > max) return { error: `O período pode ter no máximo 12 meses. Escolha uma data de fim até ${keyToBR(max)}.` };
  return { from, to, error: null };
}

/** Nome do arquivo sem dado pessoal: só o número do paciente e o período (como o servidor). */
export const pdfFileName = (patientApiId: string | number, from: DateKey, to: DateKey) => `historico-adesao-${patientApiId}-${from}-a-${to}.pdf`;

/** Mensagem para cada falha ao baixar o PDF (sessão expirada também leva ao login, pelo cliente HTTP). */
export function pdfDownloadFailure(error: { kind?: string; status?: number; code?: string; message?: string }): string {
  if (error.kind === 'NETWORK') return 'Sem conexão. Conecte o celular à internet para baixar o PDF.';
  if (error.code === 'PERIODO_SEM_REGISTROS' || error.status === 422) {
    return 'Não há doses registradas neste período. Escolha outro período.';
  }
  if (error.status === 401 || error.code === 'SESSAO_INVALIDA') return 'Sua sessão terminou. Entre de novo para baixar o PDF.';
  if (error.status === 404) return 'Paciente não encontrado. Escolha outro paciente.';
  if (error.status === 400 && error.message) return error.message;
  return 'Não foi possível gerar o PDF agora. Tente de novo em instantes.';
}
