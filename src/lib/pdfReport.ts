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
export const pdfFileName = (elderApiId: string | number, from: DateKey, to: DateKey) => `historico-adesao-${elderApiId}-${from}-a-${to}.pdf`;

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

/**
 * PDF de demonstração (modo demo, sem servidor): uma página dizendo que é exemplo, sem dado real. PDF 1.4 mínimo e
 * válido, montado em texto (só ASCII, para os deslocamentos da tabela xref baterem com os bytes).
 */
export function demoPdfBytes(title: string): Uint8Array {
  const safe = title.normalize('NFD').replace(/[^\x20-\x7E]/g, '').replace(/[()\\]/g, '');
  const content = `BT /F1 20 Tf 72 760 Td (DEMONSTRACAO - dados ficticios) Tj 0 -32 Td /F1 12 Tf (${safe}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i += 1) bytes[i] = pdf.charCodeAt(i);
  return bytes;
}
