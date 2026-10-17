import React, { createContext, useContext, useMemo } from 'react';
import { useAppStore } from '../store/appStore';
import { darkColors, elderColors, elderHighContrastColors, lightColors, type ThemeColors } from './colors';

export interface Theme {
  mode: 'light' | 'dark';
  colors: ThemeColors;
  /** true nas telas do idoso (fontes ≥ 20sp, toques maiores). */
  elder: boolean;
  highContrast: boolean;
}

const ThemeContext = createContext<Theme>({ mode: 'light', colors: lightColors, elder: false, highContrast: false });

/** Tema do cuidador: claro/escuro, alternável nas Configurações. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const mode = useAppStore((s) => s.themeMode);
  const value = useMemo<Theme>(
    () => ({ mode, colors: mode === 'dark' ? darkColors : lightColors, elder: false, highContrast: false }),
    [mode],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Tema do idoso: claro ou alto contraste dedicado. */
export function ElderThemeProvider({ children }: { children: React.ReactNode }) {
  const highContrast = useAppStore((s) => s.elderHighContrast);
  const value = useMemo<Theme>(
    () => ({
      mode: highContrast ? 'dark' : 'light',
      colors: highContrast ? elderHighContrastColors : elderColors,
      elder: true,
      highContrast,
    }),
    [highContrast],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function withElderTheme<P extends object>(Component: React.ComponentType<P>) {
  function Wrapped(props: P) {
    return (
      <ElderThemeProvider>
        <Component {...props} />
      </ElderThemeProvider>
    );
  }
  Wrapped.displayName = `withElderTheme(${Component.displayName ?? Component.name ?? 'Screen'})`;
  return Wrapped;
}

export const useTheme = () => useContext(ThemeContext);
