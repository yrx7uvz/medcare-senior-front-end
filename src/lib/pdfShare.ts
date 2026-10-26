import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { PdfFile } from '../types/views';

/**
 * Arquivo temporário do PDF: fica no cache PRIVADO do app (outros apps não têm acesso), e o menu de compartilhar do
 * Android dá ao app escolhido (salvar, WhatsApp, e-mail) só a leitura daquele arquivo. Depois do compartilhamento o
 * arquivo é apagado; se o app fechar no meio, a pasta é limpa na próxima vez que a tela abrir.
 */
const pdfDir = () => new Directory(Paths.cache, 'relatorios-pdf');

/** Apaga PDFs que tenham sobrado de um compartilhamento interrompido. Falha aqui nunca derruba a tela. */
export function clearPdfTemp(): void {
  try {
    const dir = pdfDir();
    if (dir.exists) dir.delete();
  } catch {
    // Melhor esforço
  }
}

/** Grava o PDF no cache privado, abre o menu de compartilhar e apaga o arquivo no fim (deu certo ou não). */
export async function sharePdf(pdf: PdfFile): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Este aparelho não tem como compartilhar arquivos.');
  const dir = pdfDir();
  if (!dir.exists) dir.create({ intermediates: true });
  const file = new File(dir, pdf.fileName);
  try {
    if (file.exists) file.delete();
    file.create();
    file.write(pdf.bytes);
    await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: 'Enviar relatório em PDF', UTI: 'com.adobe.pdf' });
  } finally {
    try {
      if (file.exists) file.delete();
    } catch {
      // A limpeza da pasta na próxima abertura cobre
    }
  }
}
