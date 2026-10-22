/**
 * Código de pareamento colado da área de transferência: aceita SOMENTE 6 dígitos, ignorando espaços e hífens (ex.:
 * "482 913", "482-913"). Qualquer outra coisa volta null. O conteúdo da área de transferência nunca é guardado nem
 * registrado em log: só o resultado (6 dígitos ou nada) segue para a tela.
 */
export function parsePastedCode(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const compact = raw.replace(/[\s-]/g, '');
  return /^\d{6}$/.test(compact) ? compact : null;
}

export const PASTE_INVALID_MESSAGE = 'Não há um código de 6 números copiado. Confira e tente de novo.';
