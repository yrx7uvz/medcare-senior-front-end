/*
 * Testes automatizados (Jest) de teclado (3 casos). Cobre: sobe exatamente o que o teclado cobre da área; desconta
 * o que fica abaixo da área (barra de abas sob o teclado); sem teclado ou com a área toda acima dele: nada.
 */
import { describe, expect, it } from '@jest/globals';
import { keyboardOverlap } from '../src/lib/keyboardOverlap';

describe('área de mensagens com o teclado aberto', () => {
  it('sobe exatamente o que o teclado cobre da área', () => {
    // Área de 100 a 2100 (altura 2000); teclado começa em 1300: cobre 800
    expect(keyboardOverlap(100, 2000, 1300)).toBe(800);
  });

  it('desconta o que fica abaixo da área (barra de abas sob o teclado)', () => {
    // Área termina em 2000 (a barra de abas vai de 2000 a 2400); teclado começa em 1500: cobre só 500 da área
    expect(keyboardOverlap(0, 2000, 1500)).toBe(500);
  });

  it('sem teclado ou com a área toda acima dele: nada', () => {
    expect(keyboardOverlap(0, 1000, 1500)).toBe(0);
    expect(keyboardOverlap(0, 1000, null)).toBe(0);
    expect(keyboardOverlap(0, 1000, Number.NaN)).toBe(0);
  });
});
