import Check from 'lucide-react-native/icons/check';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../../components/ui';
import { PILL_COLORS, colorName } from '../../lib/medicationMeta';
import { hitSlopFor, spacing, useTheme } from '../../theme';
import { illustration, pillColors } from '../../theme/colors';

/** Amostra de cor: 40 dp visíveis, área de toque completada até 48 dp. */
const SWATCH = 40;

/** Paleta de cores com nome falado pelo leitor de tela. */
/** Cores escuras: a marca de seleção por cima é clara. */
const DARK_PILL_COLORS: string[] = [pillColors.preto, pillColors.roxo, pillColors.marrom, pillColors.azul, pillColors.vermelho, pillColors.ambar];

export function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (c: string) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <AppText variant="label">
        {label}: <AppText variant="label" muted>{colorName(value)}</AppText>
      </AppText>
      <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {PILL_COLORS.map((c) => {
          const selected = c.value.toLowerCase() === value.toLowerCase();
          const dark = DARK_PILL_COLORS.includes(c.value);
          return (
            <Pressable
              key={c.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={c.name}
              onPress={() => onChange(c.value)}
              hitSlop={hitSlopFor(SWATCH)}
              style={[
                styles.swatch,
                { backgroundColor: c.value, borderColor: selected ? colors.primary : colors.border, borderWidth: selected ? 3 : 1.5 },
              ]}
            >
              {selected ? <Check color={dark ? illustration.checkOnDark : illustration.checkOnLight} size={18} strokeWidth={3} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: SWATCH, height: SWATCH, borderRadius: SWATCH / 2, alignItems: 'center', justifyContent: 'center' },
});
