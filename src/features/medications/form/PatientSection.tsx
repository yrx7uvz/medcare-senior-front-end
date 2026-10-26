import { Controller, type Control } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { AppText, Avatar, Card, Chip } from '../../../components/ui';
import type { MedicationFormValues } from '../../../lib/schemas';
import type { Patient } from '../../../types/domain';
import { spacing, useTheme } from '../../../theme';

/** Paciente do remédio: fixo (edição ou vindo do paciente) ou escolhido entre os do cuidador. */
export function PatientSection({ control, patients, lockPatient, patientId }: {
  control: Control<MedicationFormValues>;
  patients: Patient[];
  lockPatient: boolean;
  patientId: string;
}) {
  const { colors } = useTheme();
  const locked = patients.find((x) => x.id === patientId);
  return (
    <Card style={styles.card}>
      <AppText variant="heading" accessibilityRole="header">Paciente</AppText>
      {lockPatient ? (
        <View style={styles.patientRow}>
          {locked ? (
            <>
              <Avatar name={locked.name} color={locked.avatarColor} size={32} />
              <AppText variant="bodyStrong" style={styles.flex}>{locked.name}</AppText>
            </>
          ) : null}
        </View>
      ) : (
        <Controller
          control={control}
          name="patientId"
          render={({ field, fieldState }) => (
            <View style={styles.gapSm}>
              <View style={styles.chips}>
                {patients.map((e) => (
                  <Chip
                    key={e.id}
                    label={e.name}
                    selected={field.value === e.id}
                    onPress={() => field.onChange(e.id)}
                    leading={<Avatar name={e.name} color={e.avatarColor} size={24} />}
                  />
                ))}
              </View>
              {fieldState.error ? <AppText variant="caption" color={colors.danger}>{fieldState.error.message}</AppText> : null}
            </View>
          )}
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  gapSm: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  patientRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
