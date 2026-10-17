import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { AppText, PillVisual } from '../../components/ui';
import { SHAPE_LABEL } from '../../lib/medicationMeta';
import { PILL_SHAPE_VALUES, type PillShape } from '../../types/domain';
import { radius, spacing, useTheme } from '../../theme';

const SAMPLE: Record<PillShape, { l: number; w: number }> = {
  REDONDO: { l: 10, w: 10 },
  OVAL: { l: 16, w: 9 },
  OBLONGO: { l: 18, w: 8 },
  RETANGULAR: { l: 16, w: 10 },
  LOSANGO: { l: 14, w: 10 },
  OUTRO: { l: 14, w: 11 },
};

/** Seletor visual de formato do comprimido. */
export function ShapePicker({ value, color, onChange }: { value: PillShape; color: string; onChange: (s: PillShape) => void }) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityRole="radiogroup">
      {PILL_SHAPE_VALUES.map((s) => {
        const selected = value === s;
        return (
          <Pressable
            key={s}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`Formato ${SHAPE_LABEL[s]}`}
            onPress={() => onChange(s)}
            style={[styles.tile, { borderColor: selected ? colors.primary : colors.border, borderWidth: selected ? 2.5 : 1.5, backgroundColor: colors.surface }]}
          >
            <PillVisual appearance={{ type: 'COMPRIMIDO', shape: s, primaryColor: color, lengthMm: SAMPLE[s].l, widthMm: SAMPLE[s].w }} size="sm" />
            <AppText variant="caption" color={selected ? colors.primaryDark : colors.text}>
              {SHAPE_LABEL[s]}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: 2 },
  tile: { width: 80, alignItems: 'center', gap: 4, padding: spacing.sm, borderRadius: radius.md },
});
