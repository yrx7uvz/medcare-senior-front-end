import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, DoseStatusBadge, PillVisual, statusLabel } from '../../components/ui';
import { formatTime } from '../../lib/date';
import type { DoseView } from '../../types/views';
import { radius, spacing, useTheme } from '../../theme';

/** Linha grande da lista "Seu dia de hoje" (toque ≥ 96dp). */
export function ElderDoseRow({ dose, onPress }: { dose: DoseView; onPress: () => void }) {
  const { colors, highContrast } = useTheme();
  const m = dose.medication;
  const time = formatTime(dose.scheduledAt);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${m.name} ${m.dosage}, às ${time}. ${statusLabel(dose.status, true)}.`}
      accessibilityHint={dose.storedStatus === 'PENDENTE' ? 'Abre a tela para confirmar' : 'Mostra os detalhes'}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: highContrast ? 2 : 1,
          borderLeftColor: colors.status[dose.status].accent,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <PillVisual appearance={m} size="md" />
      <View style={styles.texts}>
        <AppText variant="elderStrong" numberOfLines={2}>
          {m.name} {m.dosage}
        </AppText>
        <AppText variant="elderBody" muted>
          {time} • {dose.doseQuantity}
        </AppText>
        <DoseStatusBadge status={dose.status} size="elder" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.lg, borderRadius: radius.xl, borderLeftWidth: 8, minHeight: 96 },
  texts: { flex: 1, gap: 4 },
});
