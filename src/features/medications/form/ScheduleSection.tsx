import { CalendarRange } from 'lucide-react-native';
import { Controller, type Control } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { AppText, Card, FormTextField } from '../../../components/ui';
import type { MedicationFormValues } from '../../../lib/schemas';
import { spacing, useTheme } from '../../../theme';
import { WeekdayChips } from '../WeekdayChips';
import { TimesField } from './TimesField';

/** Dias da semana, horários (seletor em rolagem) e período do tratamento. */
export function ScheduleSection({ control, isEdit }: { control: Control<MedicationFormValues>; isEdit: boolean }) {
  const { colors } = useTheme();
  return (
    <Card style={styles.card}>
      <View style={styles.inline}>
        <CalendarRange color={colors.primary} size={20} />
        <AppText variant="heading" accessibilityRole="header" style={styles.flex}>Dias e horários</AppText>
      </View>
      <AppText variant="label">Dias da semana</AppText>
      <Controller
        control={control}
        name="weekdays"
        render={({ field, fieldState }) => <WeekdayChips value={field.value} onChange={field.onChange} error={fieldState.error?.message} />}
      />
      <AppText variant="label">Horários</AppText>
      <Controller
        control={control}
        name="times"
        render={({ field, fieldState }) => (
          <TimesField
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error?.message ?? fieldState.error?.root?.message}
          />
        )}
      />
      <View style={styles.dates}>
        <View style={styles.date}>
          {/* A API não deixa mudar o início de um tratamento já criado */}
          <FormTextField
            control={control}
            name="startDate"
            label="Início"
            required
            mask="date"
            keyboardType="number-pad"
            placeholder="DD/MM/AAAA"
            editable={!isEdit}
            hint={isEdit ? 'O início não pode ser alterado' : undefined}
          />
        </View>
        <View style={styles.date}>
          <FormTextField control={control} name="endDate" label="Fim (opcional)" mask="date" keyboardType="number-pad" placeholder="Contínuo" />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // Em tela estreita as datas ficam uma embaixo da outra
  dates: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  date: { flexGrow: 1, flexBasis: 140 },
  flex: { flex: 1 },
});
