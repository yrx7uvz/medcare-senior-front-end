import { Text, type TextProps } from 'react-native';
import { textVariants, useTheme, type TextVariant } from '../../theme';

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  color?: string;
  muted?: boolean;
  align?: 'left' | 'center' | 'right';
}

/** Texto com a escala do tema. Respeita o tamanho de fonte do sistema. */
export function AppText({ variant = 'body', color, muted, align, style, maxFontSizeMultiplier, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  return (
    <Text
      {...rest}
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? 1.8}
      style={[textVariants[variant], { color: color ?? (muted ? colors.textMuted : colors.text), textAlign: align }, style]}
    />
  );
}
