import type { TextStyle } from 'react-native';

export const fonts = {
  title: 'Nunito_800ExtraBold',
  titleBold: 'Nunito_700Bold',
  body: 'NunitoSans_400Regular',
  bodySemi: 'NunitoSans_600SemiBold',
  bodyBold: 'NunitoSans_700Bold',
} as const;

/**
 * Escala tipográfica. Variantes "elder*" têm no mínimo 20sp (RNF01) e todas
 * respeitam o tamanho de fonte do sistema (allowFontScaling padrão).
 */
export const textVariants = {
  display: { fontFamily: fonts.title, fontSize: 26, lineHeight: 32 },
  title: { fontFamily: fonts.title, fontSize: 20, lineHeight: 26 },
  heading: { fontFamily: fonts.titleBold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 21 },
  label: { fontFamily: fonts.bodySemi, fontSize: 13.5, lineHeight: 18 },
  caption: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17 },
  number: { fontFamily: fonts.title, fontSize: 28, lineHeight: 32 },
  elderBody: { fontFamily: fonts.bodySemi, fontSize: 20, lineHeight: 28 },
  elderStrong: { fontFamily: fonts.bodyBold, fontSize: 22, lineHeight: 30 },
  elderTitle: { fontFamily: fonts.title, fontSize: 26, lineHeight: 33 },
  elderDisplay: { fontFamily: fonts.title, fontSize: 32, lineHeight: 40 },
  elderHuge: { fontFamily: fonts.title, fontSize: 52, lineHeight: 60 },
} satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof textVariants;
