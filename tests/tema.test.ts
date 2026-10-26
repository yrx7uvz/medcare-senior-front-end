import { describe, expect, it } from '@jest/globals';
import { checkTheme, contrastRatio } from '../src/lib/contrast';
import { DEFAULT_THEME_PREFS, parseThemePrefs, resolveThemeMode, serializeThemePrefs } from '../src/lib/themePrefs';
import { darkColors, patientColors, patientDarkColors, patientHighContrastColors, lightColors, type ThemeColors } from '../src/theme/colors';

describe('preferências de aparência guardadas', () => {
  it('ida e volta do que fica no aparelho', () => {
    const prefs = { mode: 'dark' as const, patientHighContrast: true };
    expect(parseThemePrefs(serializeThemePrefs(prefs))).toEqual(prefs);
    expect(parseThemePrefs(serializeThemePrefs({ mode: null, patientHighContrast: false }))).toEqual(DEFAULT_THEME_PREFS);
  });

  it('sem nada guardado, ilegível ou com valores estranhos: o padrão (tema do sistema, sem alto contraste)', () => {
    expect(parseThemePrefs(null)).toEqual(DEFAULT_THEME_PREFS);
    expect(parseThemePrefs('{quebrado')).toEqual(DEFAULT_THEME_PREFS);
    expect(parseThemePrefs('"texto"')).toEqual(DEFAULT_THEME_PREFS);
    expect(parseThemePrefs(JSON.stringify({ mode: 'roxo', patientHighContrast: 'sim' }))).toEqual(DEFAULT_THEME_PREFS);
  });

  it('lê o alto contraste gravado com o nome antigo (elderHighContrast) por versões anteriores', () => {
    expect(parseThemePrefs(JSON.stringify({ mode: 'light', elderHighContrast: true }))).toEqual({ mode: 'light', patientHighContrast: true });
  });

  it('a escolha vale sobre o sistema; sem escolha, segue o sistema', () => {
    expect(resolveThemeMode('dark', 'light')).toBe('dark');
    expect(resolveThemeMode('light', 'dark')).toBe('light');
    expect(resolveThemeMode(null, 'dark')).toBe('dark');
    expect(resolveThemeMode(null, 'light')).toBe('light');
    expect(resolveThemeMode(null, null)).toBe('light');
  });
});

describe('paleta e seletores', () => {
  it.each([
    ['claro', lightColors, false],
    ['escuro', darkColors, false],
    ['paciente claro', patientColors, false],
    ['paciente escuro', patientDarkColors, false],
    ['paciente alto contraste', patientHighContrastColors, true],
  ] as [string, ThemeColors, boolean][])('tema %s: todos os pares no mínimo', (_nome, cores, alto) => {
    expect(checkTheme(cores, alto).filter((r) => !r.ok)).toEqual([]);
  });

  it('escuro com fundo neutro (não azul-marinho) e primária com 4,5:1 nas superfícies', () => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(darkColors.background.slice(i, i + 2), 16));
    // Neutro: canais próximos entre si (o azul-marinho antigo tinha azul bem acima do vermelho)
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(8);
    for (const bg of [darkColors.background, darkColors.surface, darkColors.surfaceAlt]) {
      expect(contrastRatio(darkColors.primary, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('alto contraste sem o amarelo antigo na cor primária e com 7:1 nos textos principais', () => {
    expect(patientHighContrastColors.primary).not.toBe('#FFE14D');
    expect(contrastRatio(patientHighContrastColors.text, patientHighContrastColors.background)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(patientHighContrastColors.primary, patientHighContrastColors.background)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(patientHighContrastColors.onPrimary, patientHighContrastColors.primary)).toBeGreaterThanOrEqual(7);
  });
});
