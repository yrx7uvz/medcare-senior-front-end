import type { ThemeColors } from '../theme/colors';

/**
 * Contraste WCAG 2.x entre duas cores sólidas '#RRGGBB': (L1 + 0,05) / (L2 + 0,05), com a luminância relativa do
 * sRGB. Limiares: 4,5:1 texto normal, 3:1 texto grande (≥ 18,66 px negrito ou ≥ 24 px) e componentes de interface
 * (bordas de campo, indicadores de status).
 */
export const MIN_TEXT = 4.5;
export const MIN_LARGE_OR_UI = 3;

function channel(hex: string, offset: number): number {
  const c = parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`Cor fora do formato #RRGGBB: ${hex}`);
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export type PairKind = 'text' | 'large' | 'ui';

export interface ContrastPair {
  name: string;
  fg: string;
  bg: string;
  kind: PairKind;
}

export const minimumFor = (kind: PairKind) => (kind === 'text' ? MIN_TEXT : MIN_LARGE_OR_UI);

/** Pares de cor que o app usa de fato: texto sobre fundo, botões, cabeçalho, erros, status, bordas e indicadores. */
export function themeContrastPairs(c: ThemeColors): ContrastPair[] {
  const pairs: ContrastPair[] = [];
  const add = (name: string, fg: string, bg: string, kind: PairKind) => pairs.push({ name, fg, bg, kind });

  for (const [bgName, bg] of [['background', c.background], ['surface', c.surface], ['surfaceAlt', c.surfaceAlt]] as const) {
    add(`text / ${bgName}`, c.text, bg, 'text');
    add(`textMuted / ${bgName}`, c.textMuted, bg, 'text');
    add(`primary (link, botão secundário) / ${bgName}`, c.primary, bg, 'text');
    add(`danger (erro) / ${bgName}`, c.danger, bg, 'text');
  }
  add('text / inputBackground', c.text, c.inputBackground, 'text');
  add('primaryDark (nome do idoso) / surface', c.primaryDark, c.surface, 'text');
  add('onHeader (título do cabeçalho) / header', c.onHeader, c.header, 'text');
  add('onHeaderMuted (subtítulo do cabeçalho) / header', c.onHeaderMuted, c.header, 'text');
  add('onPrimary (botão principal, chip escolhido) / primary', c.onPrimary, c.primary, 'text');
  add('onSuccessButton / successButton', c.onSuccessButton, c.successButton, 'text');
  add('danger / dangerSoft (caixa de erro)', c.danger, c.dangerSoft, 'text');
  add('warningText / warningSoft (aviso)', c.warningText, c.warningSoft, 'text');
  add('text / infoSoft', c.text, c.infoSoft, 'text');
  add('primaryDark / primarySoft', c.primaryDark, c.primarySoft, 'text');

  for (const [status, s] of Object.entries(c.status)) {
    add(`status ${status}: texto / fundo do selo`, s.fg, s.bg, 'text');
    add(`status ${status}: indicador / surface`, s.accent, c.surface, 'ui');
  }
  add('inputBorder (borda de campo) / inputBackground', c.inputBorder, c.inputBackground, 'ui');
  add('inputBorder (borda de campo) / surface', c.inputBorder, c.surface, 'ui');
  add('inputBorder (caixa de seleção, chip) / background', c.inputBorder, c.background, 'ui');
  add('focus / surface', c.focus, c.surface, 'ui');
  return pairs;
}

export interface ContrastResult extends ContrastPair {
  ratio: number;
  min: number;
  ok: boolean;
}

export function checkTheme(c: ThemeColors): ContrastResult[] {
  return themeContrastPairs(c).map((p) => {
    const ratio = contrastRatio(p.fg, p.bg);
    const min = minimumFor(p.kind);
    return { ...p, ratio, min, ok: ratio >= min };
  });
}
