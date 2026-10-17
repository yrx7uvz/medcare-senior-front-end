import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Chip } from '../../components/ui';
import { WEEKDAYS_LONG, WEEKDAYS_SHORT } from '../../lib/date';
import { spacing, useTheme } from '../../theme';

/** Ordem brasileira: segunda a domingo. */
const ORDER = [1, 2, 3, 4, 5, 6, 0];

export function WeekdayChips({ value, onChange, error }: { value: number[]; onChange: (v: number[]) => void; error?: string }) {
  const { colors } = useTheme();
  const all = value.length === 7;
  const toggle = (d: number) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort());
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {ORDER.map((d) => {
          const selected = value.includes(d);
          return (
            <Pressable
              key={d}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={WEEKDAYS_LONG[d]}
              onPress={() => toggle(d)}
              style={[
                styles.day,
                { backgroundColor: selected ? colors.primary : colors.surface, borderColor: selected ? colors.primary : colors.border },
              ]}
            >
              <AppText variant="label" color={selected ? colors.onPrimary : colors.text} maxFontSizeMultiplier={1.3}>
                {WEEKDAYS_SHORT[d]}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.shortcuts}>
        <Chip label="Todos os dias" selected={all} onPress={() => onChange(all ? [] : [0, 1, 2, 3, 4, 5, 6])} />
        <Chip label="Segunda a sexta" selected={value.length === 5 && [1, 2, 3, 4, 5].every((d) => value.includes(d))} onPress={() => onChange([1, 2, 3, 4, 5])} />
      </View>
      {error ? <AppText variant="caption" color={colors.danger}>{error}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  day: { minWidth: 44, height: 48, paddingHorizontal: 6, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
  shortcuts: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
