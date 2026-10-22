import { Controller, type Control } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { AppText, Avatar, Card, Chip } from '../../../components/ui';
import type { MedicationFormValues } from '../../../lib/schemas';
import type { Elder } from '../../../types/domain';
import { spacing, useTheme } from '../../../theme';

/** Paciente do remédio: fixo (edição ou vindo do paciente) ou escolhido entre os do cuidador. */
export function ElderSection({ control, elders, lockElder, elderId }: {
  control: Control<MedicationFormValues>;
  elders: Elder[];
  lockElder: boolean;
  elderId: string;
}) {
  const { colors } = useTheme();
  const locked = elders.find((x) => x.id === elderId);
  return (
    <Card style={styles.card}>
      <AppText variant="heading" accessibilityRole="header">Paciente</AppText>
      {lockElder ? (
        <View style={styles.elderRow}>
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
          name="elderId"
          render={({ field, fieldState }) => (
            <View style={styles.gapSm}>
              <View style={styles.chips}>
                {elders.map((e) => (
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
  elderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
