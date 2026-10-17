import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { cardShadow, radius, spacing, useTheme } from '../../theme';

interface Props extends ViewProps {
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  tone?: 'default' | 'alt';
}

export function Card({ padded = true, style, tone = 'default', ...rest }: Props) {
  const { colors, mode, highContrast } = useTheme();
  return (
    <View
      {...rest}
      style={[
        styles.card,
        cardShadow(mode === 'dark'),
        {
          backgroundColor: tone === 'alt' ? colors.surfaceAlt : colors.surface,
          borderColor: colors.border,
          borderWidth: highContrast ? 2 : StyleSheet.hairlineWidth,
          padding: padded ? spacing.lg : 0,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg },
});
