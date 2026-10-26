import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { resolveThemeMode, type ThemeMode } from '../lib/themePrefs';
import { useAppStore } from '../store/appStore';
import { darkColors, patientColors, patientDarkColors, patientHighContrastColors, lightColors, type ThemeColors } from './colors';

export interface Theme {
  mode: ThemeMode;
  colors: ThemeColors;
  /** true nas telas do paciente (fontes ≥ 20sp, toques maiores). */
  patient: boolean;
  highContrast: boolean;
}

const ThemeContext = createContext<Theme>({ mode: 'light', colors: lightColors, patient: false, highContrast: false });

/** Tema em uso: o escolhido nas Configurações ou, sem escolha, o do sistema. */
export function useThemeMode(): ThemeMode {
  const choice = useAppStore((s) => s.themeChoice);
  const system = useColorScheme();
  return resolveThemeMode(choice, system);
}

/** Cores do paciente para um tema: alto contraste, ou a versão clara/escura da mesma família. */
export const patientColorsFor = (mode: ThemeMode, highContrast: boolean): ThemeColors =>
  highContrast ? patientHighContrastColors : mode === 'dark' ? patientDarkColors : patientColors;

/** Tema do cuidador: claro/escuro (escolhido ou do sistema). */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const mode = useThemeMode();
  const value = useMemo<Theme>(
    () => ({ mode, colors: mode === 'dark' ? darkColors : lightColors, patient: false, highContrast: false }),
    [mode],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Tema do paciente: claro, escuro ou alto contraste dedicado. */
export function PatientThemeProvider({ children }: { children: React.ReactNode }) {
  const highContrast = useAppStore((s) => s.patientHighContrast);
  const mode = useThemeMode();
  const value = useMemo<Theme>(
    () => ({
      mode: highContrast ? 'dark' : mode,
      colors: patientColorsFor(mode, highContrast),
      patient: true,
      highContrast,
    }),
    [highContrast, mode],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function withPatientTheme<P extends object>(Component: React.ComponentType<P>) {
  function Wrapped(props: P) {
    return (
      <PatientThemeProvider>
        <Component {...props} />
      </PatientThemeProvider>
    );
  }
  Wrapped.displayName = `withPatientTheme(${Component.displayName ?? Component.name ?? 'Screen'})`;
  return Wrapped;
}

export const useTheme = () => useContext(ThemeContext);
