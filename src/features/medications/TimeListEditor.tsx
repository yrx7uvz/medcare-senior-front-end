import { Plus, X } from 'lucide-react-native';
import { useFieldArray, type Control, type FieldErrors } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { AppText, Button, FormTextField, IconButton } from '../../components/ui';
import type { MedicationFormValues } from '../../lib/schemas';
import { spacing, useTheme } from '../../theme';

/** Horários múltiplos com observação. Repetidos no mesmo dia são bloqueados (RN07). */
export function TimeListEditor({ control, errors }: { control: Control<MedicationFormValues>; errors: FieldErrors<MedicationFormValues> }) {
  const { colors } = useTheme();
  const { fields, append, remove } = useFieldArray({ control, name: 'times' });
  const rootError = errors.times?.root?.message ?? errors.times?.message;
  return (
    <View style={styles.wrap}>
      {fields.map((f, i) => (
        <View key={f.id} style={styles.row}>
          <View style={styles.time}>
            <FormTextField control={control} name={`times.${i}.time`} label={`Horário ${i + 1}`} mask="time" keyboardType="number-pad" placeholder="HH:MM" />
          </View>
          <View style={styles.note}>
            <FormTextField control={control} name={`times.${i}.note`} label="Observação" placeholder="Ex.: após o almoço" />
          </View>
          <View style={styles.remove}>
            <IconButton icon={X} color={colors.danger} accessibilityLabel={`Remover horário ${i + 1}`} disabled={fields.length === 1} onPress={() => remove(i)} />
          </View>
        </View>
      ))}
      {rootError ? <AppText variant="caption" color={colors.danger}>{rootError}</AppText> : null}
      <Button title="Horário" icon={Plus} variant="secondary" size="sm" style={styles.add} onPress={() => append({ time: '', note: '' })} accessibilityLabel="Adicionar horário" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  time: { width: 104 },
  note: { flex: 1 },
  remove: { paddingTop: 22 },
  add: { alignSelf: 'flex-start' },
});
