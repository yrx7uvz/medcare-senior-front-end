import type { DisplayStatus } from '../types/domain';

/**
 * Todas as cores do app ficam neste arquivo. As telas usam os tokens do tema (useTheme().colors); as poucas cores fixas
 * de desenho (remédio, logo, avatar) também estão aqui, com nome.
 */

/** Paleta da marca (tema claro). */
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
  black: '#000000',
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

/** Seletor liga/desliga: trilha e polegar nos dois estados (o estado também aparece em texto ao lado). */
export interface SwitchColors {
  onTrack: string;
  onThumb: string;
  offTrack: string;
  offThumb: string;
  /** Borda da trilha desligada (≥ 3:1 contra a superfície). */
  offBorder: string;
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
  /** Sombra dos cartões. */
  shadow: string;
  switch: SwitchColors;
  status: Record<DisplayStatus, StatusColors>;
}

const lightStatus: Record<DisplayStatus, StatusColors> = {
  CONFIRMADA_NO_HORARIO: { fg: '#1B6E3E', bg: '#E8F8EF', accent: palette.green },
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
  shadow: palette.primary,
  switch: { onTrack: palette.primary, onThumb: palette.white, offTrack: '#6B7785', offThumb: palette.white, offBorder: '#4F5B68' },
  status: lightStatus,
};

/**
 * Escuro: neutros grafite (sem o azul-marinho pesado), texto quase branco, azul da marca clareado para ter 4,5:1 nas
 * superfícies e bordas de campo com 3:1.
 */
export const darkColors: ThemeColors = {
  background: '#121417',
  surface: '#1B1E22',
  surfaceAlt: '#23272C',
  header: '#1B1E22',
  onHeader: '#F1F3F5',
  onHeaderMuted: '#B9C1C9',
  border: '#343A41',
  inputBorder: '#7D8791',
  text: '#ECEFF2',
  textMuted: '#AEB6BF',
  primary: '#6CB4F2',
  primaryDark: '#A9D3F7',
  primarySoft: '#1C2C3B',
  onPrimary: '#0B1A27',
  successButton: '#43B97A',
  onSuccessButton: '#05200F',
  danger: '#FF8F87',
  dangerSoft: '#3A1E1E',
  warningSoft: '#3A2C17',
  warningText: '#FFCB80',
  infoSoft: '#1C2C3B',
  inputBackground: '#16191C',
  skeleton: '#2A2F35',
  overlay: 'rgba(0, 0, 0, 0.65)',
  pillTile: '#262B31',
  focus: '#A9D3F7',
  shadow: palette.black,
  switch: { onTrack: '#6CB4F2', onThumb: '#0B1A27', offTrack: '#5C6670', offThumb: '#ECEFF2', offBorder: '#8A949E' },
  status: {
    CONFIRMADA_NO_HORARIO: { fg: '#86E0A8', bg: '#16291E', accent: '#45C37E' },
    PENDENTE: { fg: '#FFBE7A', bg: '#33251A', accent: '#FF9F45' },
    ATRASADA: { fg: '#FFA39C', bg: '#351C1C', accent: '#FF6F66' },
    NAO_TOMADA: { fg: '#FFA39C', bg: '#351C1C', accent: '#FF6F66' },
    CONFIRMADA_COM_ATRASO: { fg: '#FFDB70', bg: '#30290F', accent: '#F2C230' },
  },
};

/** Interface do idoso, clara: mesma identidade, texto secundário mais escuro (fonte grande, leitura fácil). */
export const elderColors: ThemeColors = {
  ...lightColors,
  textMuted: '#3E4D5C',
};

/** Interface do idoso, escura: a paleta escura comum, com o texto secundário mais claro. */
export const elderDarkColors: ThemeColors = {
  ...darkColors,
  textMuted: '#C9D0D7',
};

/**
 * Alto contraste do idoso (função de acessibilidade): fundo preto, texto branco e o azul da marca bem claro, com
 * contraste de pelo menos 7:1 nos textos principais. Os status mantêm as cores de sentido (verde, laranja, vermelho e
 * âmbar), sempre com ícone e texto.
 */
export const elderHighContrastColors: ThemeColors = {
  background: palette.black,
  surface: palette.black,
  surfaceAlt: '#111418',
  header: palette.black,
  onHeader: palette.white,
  onHeaderMuted: palette.white,
  border: palette.white,
  inputBorder: palette.white,
  text: palette.white,
  textMuted: '#F0F2F4',
  primary: '#9FD3FF',
  primaryDark: '#C7E5FF',
  primarySoft: '#0F1A24',
  onPrimary: palette.black,
  successButton: '#9FD3FF',
  onSuccessButton: palette.black,
  danger: '#FF9D96',
  dangerSoft: '#240707',
  warningSoft: '#241703',
  warningText: '#FFD38A',
  infoSoft: '#0F1A24',
  inputBackground: palette.black,
  skeleton: '#2E3338',
  overlay: 'rgba(0, 0, 0, 0.85)',
  pillTile: '#161B20',
  focus: palette.white,
  shadow: palette.black,
  switch: { onTrack: '#9FD3FF', onThumb: palette.black, offTrack: '#3A4048', offThumb: palette.white, offBorder: palette.white },
  status: {
    CONFIRMADA_NO_HORARIO: { fg: '#7CFF9E', bg: palette.black, accent: '#7CFF9E' },
    PENDENTE: { fg: '#FFC266', bg: palette.black, accent: '#FFC266' },
    ATRASADA: { fg: '#FF9D96', bg: palette.black, accent: '#FF9D96' },
    NAO_TOMADA: { fg: '#FF9D96', bg: palette.black, accent: '#FF9D96' },
    CONFIRMADA_COM_ATRASO: { fg: '#FFE14D', bg: palette.black, accent: '#FFE14D' },
  },
};

/** Cores de remédio que o cuidador pode escolher (dado do cadastro, gravado como '#RRGGBB'). */
export const pillColors = {
  branco: '#FFFFFF',
  creme: '#F3EBDD',
  amarelo: '#F4D35E',
  laranja: '#F29E4C',
  rosa: '#F4A6B8',
  vermelho: '#D64545',
  azulClaro: '#9CC9F0',
  azul: '#3D7DCA',
  verde: '#6CC08B',
  roxo: '#6D4BA8',
  marrom: '#8B5E3C',
  ambar: '#B5651D',
  cinza: '#B8C2CC',
  preto: '#2E2E2E',
} as const;

/** Cores do círculo com as iniciais do paciente (texto branco por cima). */
export const avatarColors = ['#1A6FB5', '#7B4FB0', '#00897B', '#C2185B', '#5D6D7E', '#AD6800'] as const;
export const onAvatar = palette.white;

/** Traços fixos do desenho do remédio (brilho, contorno, rótulo do frasco, gota, seringa). */
export const illustration = {
  highlight: palette.white,
  outline: '#8C9BAB',
  label: palette.white,
  labelLine: '#8C9BAB',
  dropFill: '#5FA8E8',
  dropStroke: '#2F6FA8',
  metal: '#B8C2CC',
  barrel: '#F4F8FC',
  barrelStroke: '#6B7C8D',
  /** Marca de seleção sobre uma cor de remédio escura ou clara. */
  checkOnDark: palette.white,
  checkOnLight: palette.text,
} as const;

/** Logo sobre o cabeçalho azul (versão clara). */
export const logoColors = { light: palette.white, lightAccent: '#90CAF9', onPrimary: palette.white } as const;

/** Faixa e botão do modo demonstração (só no protótipo). */
export const demoColors = { bannerBg: '#5C3B00', bannerFg: palette.white, fabBg: '#263445', fabFg: palette.white } as const;

/** Tela de carregamento antes do tema: a cor da marca, igual nos dois temas (nada de piscar o claro). */
export const bootColors = { background: palette.primary, spinner: palette.white } as const;
