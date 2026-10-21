import type { DisplayStatus } from '../types/domain';

/** Paleta herdada do protótipo HTML. */
export const palette = {
  primary: '#1A6FB5',
  primaryDark: '#0D4F8A',
  primarySoft: '#E8F2FB',
  green: '#219653',
  orange: '#E06F00',
  red: '#E53935',
  amber: '#A98000',
  background: '#F0F4F8',
  border: '#D1DCE8',
  text: '#1C2B3A',
  textMuted: '#5A6B7B',
  white: '#FFFFFF',
} as const;

/**
 * fg = texto/ícone com contraste AA sobre bg; accent = cor "de marca" do status
 * (barras, bolinhas). Status nunca depende só da cor: sempre há ícone + texto.
 */
export interface StatusColors {
  fg: string;
  bg: string;
  accent: string;
}

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceAlt: string;
  header: string;
  onHeader: string;
  onHeaderMuted: string;
  border: string;
  /** Borda de campo, caixa de seleção e chip (componente de interface: 3:1 contra o fundo). */
  inputBorder: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryDark: string;
  primarySoft: string;
  onPrimary: string;
  successButton: string;
  onSuccessButton: string;
  danger: string;
  dangerSoft: string;
  warningSoft: string;
  warningText: string;
  infoSoft: string;
  inputBackground: string;
  skeleton: string;
  overlay: string;
  pillTile: string;
  focus: string;
  status: Record<DisplayStatus, StatusColors>;
}

const lightStatus: Record<DisplayStatus, StatusColors> = {
  TOMADA: { fg: '#1B6E3E', bg: '#E8F8EF', accent: palette.green },
  PENDENTE: { fg: '#A04A00', bg: '#FFF3E0', accent: palette.orange },
  ATRASADA: { fg: '#B71C1C', bg: '#FDECEA', accent: palette.red },
  NAO_TOMADA: { fg: '#B71C1C', bg: '#FDECEA', accent: palette.red },
  CONFIRMADA_COM_ATRASO: { fg: '#7A5600', bg: '#FFF6D6', accent: palette.amber },
};

export const lightColors: ThemeColors = {
  background: palette.background,
  surface: palette.white,
  surfaceAlt: '#F6F9FC',
  header: palette.primary,
  onHeader: palette.white,
  onHeaderMuted: palette.primarySoft,
  border: palette.border,
  inputBorder: '#74889C',
  text: palette.text,
  textMuted: palette.textMuted,
  primary: palette.primary,
  primaryDark: palette.primaryDark,
  primarySoft: palette.primarySoft,
  onPrimary: palette.white,
  successButton: '#1E7B45',
  onSuccessButton: palette.white,
  danger: '#C62828',
  dangerSoft: '#FDECEA',
  warningSoft: '#FFF3E0',
  warningText: '#8A4300',
  infoSoft: palette.primarySoft,
  inputBackground: palette.white,
  skeleton: '#DCE5EE',
  overlay: 'rgba(13, 31, 51, 0.55)',
  pillTile: palette.primarySoft,
  focus: palette.primaryDark,
  status: lightStatus,
};

export const darkColors: ThemeColors = {
  background: '#0E1620',
  surface: '#16212D',
  surfaceAlt: '#1C2938',
  header: '#0F3A63',
  onHeader: '#F2F7FC',
  onHeaderMuted: '#A9C6E3',
  border: '#2B3B4D',
  inputBorder: '#5D7186',
  text: '#E7EEF5',
  textMuted: '#9DB0C3',
  primary: '#5AA5E6',
  primaryDark: '#A9D0F3',
  primarySoft: '#12324F',
  onPrimary: '#06223B',
  successButton: '#2E9E5B',
  onSuccessButton: '#04210F',
  danger: '#FF8A80',
  dangerSoft: '#3A1A1A',
  warningSoft: '#3A2A12',
  warningText: '#FFC77A',
  infoSoft: '#12324F',
  inputBackground: '#101A25',
  skeleton: '#243445',
  overlay: 'rgba(0, 0, 0, 0.65)',
  pillTile: '#22364B',
  focus: '#A9D0F3',
  status: {
    TOMADA: { fg: '#7EE2A5', bg: '#11331F', accent: '#3CC57A' },
    PENDENTE: { fg: '#FFB870', bg: '#3A2410', accent: '#FF9A3D' },
    ATRASADA: { fg: '#FF9C94', bg: '#3A1717', accent: '#FF6B61' },
    NAO_TOMADA: { fg: '#FF9C94', bg: '#3A1717', accent: '#FF6B61' },
    CONFIRMADA_COM_ATRASO: { fg: '#FFD966', bg: '#352B0B', accent: '#F2C230' },
  },
};

/** Interface do idoso: mesma identidade, botão verde escuro (contraste 5,6:1 com branco). */
export const elderColors: ThemeColors = {
  ...lightColors,
  textMuted: '#3E4D5C',
};

/** Alto contraste dedicado do idoso (texto ≥ 15:1 sobre o fundo). */
export const elderHighContrastColors: ThemeColors = {
  background: '#000000',
  surface: '#000000',
  surfaceAlt: '#121212',
  header: '#000000',
  onHeader: '#FFFFFF',
  onHeaderMuted: '#FFFFFF',
  border: '#FFFFFF',
  inputBorder: '#FFFFFF',
  text: '#FFFFFF',
  textMuted: '#F0F0F0',
  primary: '#FFE14D',
  primaryDark: '#FFE14D',
  primarySoft: '#1A1A1A',
  onPrimary: '#000000',
  successButton: '#FFE14D',
  onSuccessButton: '#000000',
  danger: '#FF8A80',
  dangerSoft: '#2A0000',
  warningSoft: '#2A1A00',
  warningText: '#FFD180',
  infoSoft: '#1A1A1A',
  inputBackground: '#000000',
  skeleton: '#333333',
  overlay: 'rgba(0, 0, 0, 0.85)',
  pillTile: '#1C1C1C',
  focus: '#FFE14D',
  status: {
    TOMADA: { fg: '#7CFF9E', bg: '#000000', accent: '#7CFF9E' },
    PENDENTE: { fg: '#FFC266', bg: '#000000', accent: '#FFC266' },
    ATRASADA: { fg: '#FF8A80', bg: '#000000', accent: '#FF8A80' },
    NAO_TOMADA: { fg: '#FF8A80', bg: '#000000', accent: '#FF8A80' },
    CONFIRMADA_COM_ATRASO: { fg: '#FFE14D', bg: '#000000', accent: '#FFE14D' },
  },
};
