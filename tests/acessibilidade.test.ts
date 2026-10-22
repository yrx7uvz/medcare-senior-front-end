import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkTheme, contrastRatio, MIN_LARGE_OR_UI, MIN_TEXT, relativeLuminance } from '../src/lib/contrast';
import { darkColors, elderColors, elderHighContrastColors, lightColors } from '../src/theme/colors';
import { hitSlopFor, touch } from '../src/theme/spacing';
import { CAREGIVER_MIN_BODY, CAREGIVER_MIN_LABEL, textVariants } from '../src/theme/typography';

const fonte = (arquivo: string) => readFileSync(join(__dirname, '..', 'src', arquivo), 'utf8');

describe('contraste WCAG', () => {
  it('fórmula da luminância relativa e da razão', () => {
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5);
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
    // Cinza de referência do WCAG: #767676 sobre branco ≈ 4,54:1
    expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2);
    expect(() => relativeLuminance('azul')).toThrow();
    expect([MIN_TEXT, MIN_LARGE_OR_UI]).toEqual([4.5, 3]);
  });

  it.each([
    ['claro', lightColors],
    ['escuro', darkColors],
    ['idoso', elderColors],
    ['idoso alto contraste', elderHighContrastColors],
  ])('tema %s: todos os pares de texto ≥ 4,5:1 e bordas/indicadores ≥ 3:1', (_nome, cores) => {
    const reprovados = checkTheme(cores).filter((r) => !r.ok).map((r) => `${r.name}: ${r.ratio.toFixed(2)}`);
    expect(reprovados).toEqual([]);
  });

  it('subtítulo do cabeçalho, bordas de campo e indicadores de status corrigidos no tema claro', () => {
    expect(contrastRatio(lightColors.onHeaderMuted, lightColors.header)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(lightColors.inputBorder, lightColors.background)).toBeGreaterThanOrEqual(3);
    for (const s of Object.values(lightColors.status)) expect(contrastRatio(s.accent, lightColors.surface)).toBeGreaterThanOrEqual(3);
  });
});

describe('tamanho de fonte', () => {
  it('cuidador: corpo ≥ 16 sp e rótulos ≥ 14 sp; idoso ≥ 20 sp', () => {
    expect(CAREGIVER_MIN_BODY).toBe(16);
    expect(CAREGIVER_MIN_LABEL).toBe(14);
    for (const [nome, estilo] of Object.entries(textVariants)) {
      if (nome.startsWith('elder')) expect(estilo.fontSize).toBeGreaterThanOrEqual(20);
      else expect(estilo.fontSize).toBeGreaterThanOrEqual(CAREGIVER_MIN_LABEL);
    }
    expect(textVariants.body.fontSize).toBeGreaterThanOrEqual(CAREGIVER_MIN_BODY);
    expect(textVariants.bodyStrong.fontSize).toBeGreaterThanOrEqual(CAREGIVER_MIN_BODY);
    // Rótulo das abas em 14 sp; em tela muito estreita diminui no máximo 15% para caber inteiro (sem "Mensage…")
    const abas = fonte('app/navigation/CaregiverTabs.tsx');
    expect(abas).toMatch(/style=\{\{ fontFamily: fonts\.bodySemi, fontSize: CAREGIVER_MIN_LABEL \}\}/);
    expect(abas).toMatch(/adjustsFontSizeToFit[\s\S]*minimumFontScale=\{0\.85\}/);
    expect(abas).not.toMatch(/'Config\.'/);
  });

  it('o texto respeita a fonte do sistema (sem desligar o ajuste)', () => {
    expect(fonte('components/ui/AppText.tsx')).toMatch(/maxFontSizeMultiplier=\{maxFontSizeMultiplier \?\? 1\.8\}/);
    expect(fonte('components/ui/AppText.tsx')).not.toMatch(/allowFontScaling=\{false\}/);
  });
});

describe('alvos de toque ≥ 48 dp nos componentes compartilhados', () => {
  it('hitSlop completa qualquer alvo menor até 48 dp', () => {
    expect(touch.min).toBe(48);
    expect(hitSlopFor(40)).toBe(4);
    expect(hitSlopFor(44)).toBe(2);
    expect(hitSlopFor(48)).toBe(0);
    expect(hitSlopFor(64)).toBe(0);
    for (const s of [24, 30, 40, 44, 47]) expect(s + 2 * hitSlopFor(s)).toBeGreaterThanOrEqual(48);
  });

  it('cada componente-base usa a área mínima', () => {
    expect(fonte('components/ui/IconButton.tsx')).toMatch(/hitSlop=\{hitSlopFor\(size\)\}/);
    expect(fonte('components/ui/Button.tsx')).toMatch(/hitSlop=\{hitSlopFor\(height\)\}/);
    expect(fonte('components/ui/Chip.tsx')).toMatch(/minHeight: touch\.min/);
    expect(fonte('components/ui/TextField.tsx')).toMatch(/minHeight: large \? 64 : 48/);
    expect(fonte('components/ui/TextField.tsx')).toMatch(/hitSlop=\{8\}[\s\S]*eye: \{[^}]*minWidth: 40, minHeight: 40/);
    expect(fonte('components/ui/Checkbox.tsx')).toMatch(/row: \{[^}]*minHeight: 48/);
    expect(fonte('components/ui/PinPad.tsx')).toMatch(/key: \{ width: 84, height: 72/);
    expect(fonte('features/medications/ColorPicker.tsx')).toMatch(/hitSlop=\{hitSlopFor\(SWATCH\)\}/);
    expect(fonte('features/medications/WeekdayChips.tsx')).toMatch(/hitSlop=\{\{ left: hitSlopFor\(DAY_MIN_WIDTH\), right: hitSlopFor\(DAY_MIN_WIDTH\) \}\}/);
    // A linha inteira da preferência é o interruptor (componente comum AppSwitch, com 56 dp de altura)
    expect(fonte('components/ui/AppSwitch.tsx')).toMatch(/accessibilityRole="switch"[\s\S]*onPress=\{\(\) => onValueChange\(!value\)\}/);
    expect(fonte('components/ui/AppSwitch.tsx')).toMatch(/minHeight: 56/);
    expect(fonte('features/settings/SettingsScreen.tsx')).toMatch(/<AppSwitch /);
    // Nenhum Switch do sistema (verde e azul do Android): todos usam o AppSwitch com as cores do tema
    for (const arquivo of ['features/settings/SettingsScreen.tsx', 'components/ui/ThemeToggle.tsx', 'components/layout/ProfileSwitcher.tsx']) {
      expect(fonte(arquivo)).not.toMatch(/<Switch\b/);
    }
  });

  it('campos, chips e caixas usam a borda com contraste (inputBorder)', () => {
    for (const arquivo of ['components/ui/TextField.tsx', 'components/ui/Chip.tsx', 'components/ui/ChatThread.tsx', 'components/ui/PinPad.tsx', 'features/medications/WeekdayChips.tsx']) {
      expect(fonte(arquivo)).toMatch(/colors\.inputBorder/);
    }
  });
});
