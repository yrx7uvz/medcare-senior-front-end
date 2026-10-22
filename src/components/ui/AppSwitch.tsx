import type React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { radius, spacing, useTheme } from '../../theme';
import { AppText } from './AppText';

interface Props {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** Texto menor embaixo do rótulo (ex.: o que a opção faz). */
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

/**
 * Seletor liga/desliga com as cores do tema (nunca as do sistema): ligado = cor primária com polegar contrastante;
 * desligado = cinza neutro com borda visível. O estado também aparece em texto ("Ligado"/"Desligado"), não só na cor.
 * A linha inteira é o alvo do toque (mínimo de 48 dp) e o leitor de tela anuncia como "chave".
 */
export function AppSwitch({ label, value, onValueChange, description, icon, disabled }: Props) {
  const { colors, elder } = useTheme();
  const s = colors.switch;
  const state = value ? 'Ligado' : 'Desligado';
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={({ pressed }) => [styles.row, { opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }]}
    >
      {icon}
      <View style={styles.texts}>
        <AppText variant={elder ? 'elderBody' : 'bodyStrong'}>{label}</AppText>
        {description ? (
          <AppText variant="caption" muted>
            {description}
          </AppText>
        ) : null}
      </View>
      <AppText variant="caption" muted style={styles.state} importantForAccessibility="no">
        {state}
      </AppText>
      <View
        style={[
          styles.track,
          value
            ? { backgroundColor: s.onTrack, borderColor: s.onTrack, justifyContent: 'flex-end' }
            : { backgroundColor: s.offTrack, borderColor: s.offBorder, justifyContent: 'flex-start' },
        ]}
      >
        <View style={[styles.thumb, { backgroundColor: value ? s.onThumb : s.offThumb }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56 },
  texts: { flex: 1, gap: 2 },
  state: { minWidth: 64, textAlign: 'right' },
  track: { width: 52, height: 30, borderRadius: radius.pill, borderWidth: 2, padding: 2, flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 22, height: 22, borderRadius: 11 },
});
