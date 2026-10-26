export type ThemeMode = 'light' | 'dark';

/**
 * Escolhas de aparência guardadas no aparelho. `mode` null = seguir o tema do sistema (o padrão, sem escolha salva).
 */
export interface ThemePrefs {
  mode: ThemeMode | null;
  patientHighContrast: boolean;
}

export const DEFAULT_THEME_PREFS: ThemePrefs = { mode: null, patientHighContrast: false };

/** Texto guardado até as preferências; ilegível ou de outro formato volta ao padrão (nunca trava o app). */
export function parseThemePrefs(raw: string | null): ThemePrefs {
  if (!raw) return DEFAULT_THEME_PREFS;
  try {
    // elderHighContrast = nome antigo da preferência, gravado por versões anteriores
    const p = JSON.parse(raw) as Partial<Record<keyof ThemePrefs | 'elderHighContrast', unknown>>;
    return {
      mode: p.mode === 'light' || p.mode === 'dark' ? p.mode : null,
      patientHighContrast: (p.patientHighContrast ?? p.elderHighContrast) === true,
    };
  } catch {
    return DEFAULT_THEME_PREFS;
  }
}

export const serializeThemePrefs = (p: ThemePrefs) => JSON.stringify({ mode: p.mode, patientHighContrast: p.patientHighContrast });

/** Tema em uso: o escolhido ou, sem escolha, o do sistema (sem informação do sistema, o claro). */
export function resolveThemeMode(choice: ThemeMode | null, system: string | null | undefined): ThemeMode {
  if (choice) return choice;
  return system === 'dark' ? 'dark' : 'light';
}
