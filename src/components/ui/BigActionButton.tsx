import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { radius, spacing, touch, useTheme } from '../../theme';
import { AppText } from './AppText';
import type { IconComponent } from './icons';

interface Props {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  icon?: IconComponent;
  variant?: 'success' | 'primary' | 'outline';
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
}

/** Botão do paciente: alvo de toque ≥ 88dp, texto ≥ 24sp, feedback tátil. */
export function BigActionButton({ title, subtitle, onPress, icon: Icon, variant = 'success', disabled, loading, accessibilityHint }: Props) {
  const { colors, highContrast } = useTheme();
  const bg = variant === 'success' ? colors.successButton : variant === 'primary' ? colors.primary : 'transparent';
  const fg = variant === 'success' ? colors.onSuccessButton : variant === 'primary' ? colors.onPrimary : colors.text;
  const border = variant === 'outline' ? colors.text : bg;
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: variant === 'outline' ? touch.patient : touch.patientPrimary,
          backgroundColor: isDisabled ? colors.skeleton : bg,
          borderColor: isDisabled ? colors.skeleton : border,
          borderWidth: highContrast || variant === 'outline' ? 3 : 0,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="large" color={fg} />
      ) : (
        <View style={styles.row}>
          {Icon ? <Icon color={isDisabled ? colors.textMuted : fg} size={variant === 'outline' ? 28 : 36} strokeWidth={2.6} /> : null}
          <View style={styles.texts}>
            <AppText
              variant={variant === 'outline' ? 'patientStrong' : 'patientTitle'}
              color={isDisabled ? colors.textMuted : fg}
              maxFontSizeMultiplier={1.4}
            >
              {title}
            </AppText>
            {subtitle ? (
              <AppText variant="patientBody" color={isDisabled ? colors.textMuted : fg} maxFontSizeMultiplier={1.4}>
                {subtitle}
              </AppText>
            ) : null}
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.xl, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  texts: { flexShrink: 1, alignItems: 'center' },
});
