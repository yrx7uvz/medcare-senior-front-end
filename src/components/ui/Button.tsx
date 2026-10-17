import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, spacing, touch, useTheme } from '../../theme';
import { AppText } from './AppText';
import type { IconComponent } from './icons';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

export interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconComponent;
  loading?: boolean;
  disabled?: boolean;
  size?: 'md' | 'lg' | 'sm';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon: Icon,
  loading,
  disabled,
  size = 'md',
  style,
  accessibilityLabel,
  accessibilityHint,
}: ButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;
  const palette = {
    primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
    secondary: { bg: colors.surface, fg: colors.primary, border: colors.primary },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
    danger: { bg: colors.danger, fg: colors.surface, border: colors.danger },
    success: { bg: colors.successButton, fg: colors.onSuccessButton, border: colors.successButton },
  }[variant];
  const height = size === 'lg' ? 56 : size === 'sm' ? 40 : touch.min;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      onPress={onPress}
      hitSlop={size === 'sm' ? 4 : 0}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: height,
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          paddingHorizontal: size === 'sm' ? spacing.md : spacing.lg,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.row}>
          {Icon ? <Icon color={palette.fg} size={size === 'sm' ? 16 : 20} strokeWidth={2.2} /> : null}
          <AppText variant={size === 'sm' ? 'label' : 'bodyStrong'} color={palette.fg} numberOfLines={2} align="center">
            {title}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
