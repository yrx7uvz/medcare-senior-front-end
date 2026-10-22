import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { resolveThemeMode, type ThemeMode } from '../lib/themePrefs';
import { useAppStore } from '../store/appStore';
import { darkColors, elderColors, elderDarkColors, elderHighContrastColors, lightColors, type ThemeColors } from './colors';

export interface Theme {
  mode: ThemeMode;
  colors: ThemeColors;
  /** true nas telas do idoso (fontes ≥ 20sp, toques maiores). */
  elder: boolean;
  highContrast: boolean;
}

const ThemeContext = createContext<Theme>({ mode: 'light', colors: lightColors, elder: false, highContrast: false });

/** Tema em uso: o escolhido nas Configurações ou, sem escolha, o do sistema. */
export function useThemeMode(): ThemeMode {
  const choice = useAppStore((s) => s.themeChoice);
  const system = useColorScheme();
  return resolveThemeMode(choice, system);
}

/** Cores do idoso para um tema: alto contraste, ou a versão clara/escura da mesma família. */
export const elderColorsFor = (mode: ThemeMode, highContrast: boolean): ThemeColors =>
  highContrast ? elderHighContrastColors : mode === 'dark' ? elderDarkColors : elderColors;

/** Tema do cuidador: claro/escuro (escolhido ou do sistema). */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const mode = useThemeMode();
  const value = useMemo<Theme>(
    () => ({ mode, colors: mode === 'dark' ? darkColors : lightColors, elder: false, highContrast: false }),
    [mode],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Tema do idoso: claro, escuro ou alto contraste dedicado. */
export function ElderThemeProvider({ children }: { children: React.ReactNode }) {
  const highContrast = useAppStore((s) => s.elderHighContrast);
  const mode = useThemeMode();
  const value = useMemo<Theme>(
    () => ({
      mode: highContrast ? 'dark' : mode,
      colors: elderColorsFor(mode, highContrast),
      elder: true,
      highContrast,
    }),
    [highContrast, mode],
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
