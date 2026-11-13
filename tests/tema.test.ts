import { describe, expect, it } from '@jest/globals';
import { checkTheme, contrastRatio } from '../src/lib/contrast';
import { DEFAULT_THEME_PREFS, nextPatientTheme, parseThemePrefs, resolveThemeMode, serializeThemePrefs, THEME_CHOICES } from '../src/lib/themePrefs';
import { useAppStore } from '../src/store/appStore';
import { patientColorsFor } from '../src/theme/ThemeProvider';
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

describe('alternador claro/escuro do topo das telas do paciente', () => {
  it('alterna entre claro e escuro; no alto contraste (fundo preto), vai para o claro', () => {
    expect(nextPatientTheme('light', false)).toBe('dark');
    expect(nextPatientTheme('dark', false)).toBe('light');
    expect(nextPatientTheme('dark', true)).toBe('light');
    expect(nextPatientTheme('light', true)).toBe('light');
  });

  it('grava o tema escolhido e desliga o alto contraste', () => {
    useAppStore.setState({ themeChoice: null, patientHighContrast: true });
    useAppStore.getState().switchPatientTheme('light');
    expect(useAppStore.getState()).toMatchObject({ themeChoice: 'light', patientHighContrast: false });
    useAppStore.getState().switchPatientTheme('dark');
    expect(useAppStore.getState()).toMatchObject({ themeChoice: 'dark', patientHighContrast: false });
    expect(patientColorsFor('dark', false)).toBe(patientDarkColors);
    expect(patientColorsFor('light', false)).toBe(patientColors);
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

describe('tema escuro do paciente igual ao do cuidador', () => {
  /** Todos os tokens (inclusive status e chave liga/desliga), em "caminho": valor. */
  const achatar = (o: object, prefixo = ''): Record<string, string> =>
    Object.entries(o).reduce<Record<string, string>>((acc, [k, v]) => {
      if (v && typeof v === 'object') Object.assign(acc, achatar(v as object, `${prefixo}${k}.`));
      else acc[`${prefixo}${k}`] = String(v);
      return acc;
    }, {});

  it('só o texto secundário (documentado) difere entre paciente escuro e cuidador escuro', () => {
    const cuidador = achatar(darkColors);
    const paciente = achatar(patientDarkColors);
    expect(Object.keys(paciente).sort()).toEqual(Object.keys(cuidador).sort());
    const diferentes = Object.keys(cuidador).filter((k) => cuidador[k] !== paciente[k]);
    expect(diferentes).toEqual(['textMuted']);
  });

  it('no claro, também só o texto secundário difere', () => {
    const cuidador = achatar(lightColors);
    const paciente = achatar(patientColors);
    expect(Object.keys(cuidador).filter((k) => cuidador[k] !== paciente[k])).toEqual(['textMuted']);
  });
});

describe('seletor de tema (Automático / Claro / Escuro) no paciente e no cuidador', () => {
  it('mesmas opções e nomes nas duas visões', () => {
    expect(THEME_CHOICES.map((o) => o.label)).toEqual(['Automático', 'Claro', 'Escuro']);
  });

  it('escolher Escuro muda as cores do paciente mesmo com o celular no claro; Automático volta a seguir o celular', () => {
    const coresDoPaciente = () => patientColorsFor(resolveThemeMode(useAppStore.getState().themeChoice, 'light'), false);
    useAppStore.getState().setThemeChoice(null);
    expect(coresDoPaciente()).toBe(patientColors);
    useAppStore.getState().setThemeChoice('dark');
    expect(coresDoPaciente()).toBe(patientDarkColors);
    useAppStore.getState().setThemeChoice('light');
    expect(coresDoPaciente()).toBe(patientColors);
    useAppStore.getState().setThemeChoice(null);
    expect(patientColorsFor(resolveThemeMode(useAppStore.getState().themeChoice, 'dark'), false)).toBe(patientDarkColors);
  });

  it('o alto contraste continua independente do tema', () => {
    useAppStore.getState().setThemeChoice('light');
    expect(patientColorsFor(resolveThemeMode(useAppStore.getState().themeChoice, 'light'), true)).toBe(patientHighContrastColors);
    useAppStore.getState().setThemeChoice(null);
  });
});
