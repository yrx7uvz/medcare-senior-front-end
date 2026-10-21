import * as Haptics from 'expo-haptics';
import { Delete } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { radius, spacing, useTheme } from '../../theme';
import { AppText } from './AppText';

interface PadProps {
  onDigit: (d: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

/** Teclado numérico grande (teclas de 72dp) para código de vínculo e PIN. */
export function PinPad({ onDigit, onBackspace, disabled }: PadProps) {
  const { colors, highContrast } = useTheme();
  return (
    <View style={styles.grid}>
      {KEYS.map((k, i) =>
        k === '' ? (
          <View key={i} style={styles.key} />
        ) : (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={k === 'del' ? 'Apagar último número' : k}
            accessibilityState={{ disabled: !!disabled }}
            disabled={disabled}
            onPress={() => {
              Haptics.selectionAsync().catch(() => undefined);
              if (k === 'del') onBackspace();
              else onDigit(k);
            }}
            style={({ pressed }) => [
              styles.key,
              {
                backgroundColor: pressed ? colors.primarySoft : colors.surface,
                borderColor: colors.border,
                borderWidth: highContrast ? 2 : 1,
                opacity: disabled ? 0.4 : 1,
              },
            ]}
          >
            {k === 'del' ? <Delete color={colors.text} size={30} /> : <AppText variant="elderDisplay" maxFontSizeMultiplier={1.2}>{k}</AppText>}
          </Pressable>
        ),
      )}
    </View>
  );
}

/** Caixas de dígitos (código de 6 ou PIN de 4, mascarado). */
export function DigitBoxes({ value, length, masked, error }: { value: string; length: number; masked?: boolean; error?: boolean }) {
  const { colors } = useTheme();
  const spoken = masked ? `${value.length} de ${length} números digitados` : value ? `Digitado: ${value.split('').join(' ')}` : 'Nenhum número digitado';
  return (
    <View style={styles.boxes} accessible accessibilityLabel={spoken} accessibilityLiveRegion="polite">
      {Array.from({ length }, (_, i) => {
        const filled = i < value.length;
        const active = i === value.length;
        return (
          <View
            key={i}
            style={[
              styles.box,
              {
                width: length > 4 ? 46 : 60,
                borderColor: error ? colors.danger : active ? colors.primary : colors.inputBorder,
                borderWidth: active || error ? 3 : 2,
                backgroundColor: colors.surface,
              },
            ]}
          >
            {filled ? (
              masked ? (
                <View style={[styles.dot, { backgroundColor: colors.text }]} />
              ) : (
                <AppText variant="elderDisplay" maxFontSizeMultiplier={1}>
                  {value[i]}
                </AppText>
              )
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.md, maxWidth: 300, alignSelf: 'center' },
  key: { width: 84, height: 72, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  boxes: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  box: { height: 64, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 18, height: 18, borderRadius: 9 },
});
