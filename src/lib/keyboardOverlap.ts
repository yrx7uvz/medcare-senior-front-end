/**
 * Quanto o teclado cobre de uma área da tela: a parte da área (do topo `viewTop`, com altura `viewHeight`, em
 * coordenadas da janela) que fica abaixo do topo do teclado (`keyboardTop`). Sem teclado, ou com a área toda acima
 * dele, zero.
 */
export function keyboardOverlap(viewTop: number, viewHeight: number, keyboardTop: number | null): number {
  if (keyboardTop === null || !Number.isFinite(keyboardTop)) return 0;
  return Math.max(0, Math.round(viewTop + viewHeight - keyboardTop));
}
