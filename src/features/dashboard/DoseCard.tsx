import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, DoseStatusBadge, PillVisual, statusLabel } from '../../components/ui';
import { formatTime } from '../../lib/date';
import { doseCardDetail } from '../../lib/doseConfirm';
import { TYPE_LABEL } from '../../lib/medicationMeta';
import type { DoseView } from '../../types/views';
import { cardShadow, radius, spacing, useTheme } from '../../theme';

interface Props {
  dose: DoseView;
  showPatient?: boolean;
  onPress?: () => void;
}

/**
 * Linha de dose do cuidador: desenho do remédio, nome, horário, status e quem confirmou. Em tela estreita ou com fonte
 * ampliada os textos quebram linha em vez de cortar; o status fica embaixo do nome para ter a largura toda.
 */
export function DoseCard({ dose, showPatient, onPress }: Props) {
  const { colors, mode } = useTheme();
  const med = dose.medication;
  const time = formatTime(dose.scheduledAt);
  const detail = doseCardDetail(dose);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${med.name} ${med.dosage}, ${TYPE_LABEL[med.type]}, às ${time}${showPatient ? `, ${dose.patientName}` : ''}. ${statusLabel(dose.status)}. ${detail ?? ''}`}
      accessibilityHint="Abre os detalhes da dose"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        cardShadow(mode === 'dark'),
        { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: colors.status[dose.status].accent, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <PillVisual appearance={med} size="sm" />
      <View style={styles.middle}>
        <AppText variant="heading" numberOfLines={2}>
          {med.name} {med.dosage}
        </AppText>
        <AppText variant="caption" muted numberOfLines={2}>
          {TYPE_LABEL[med.type]} • {dose.doseQuantity}
          {dose.timeNote ? ` • ${dose.timeNote}` : ''}
        </AppText>
        {showPatient ? (
          <AppText variant="caption" color={colors.primaryDark} style={styles.patient} numberOfLines={2}>
            {dose.patientName}
          </AppText>
        ) : null}
        {detail ? (
          <AppText variant="caption" muted>
            {detail}
          </AppText>
        ) : null}
        <View style={styles.badge}>
          <DoseStatusBadge status={dose.status} />
        </View>
      </View>
      <AppText variant="title" style={styles.time}>
        {time}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 4,
    minHeight: 76,
  },
  middle: { flex: 1, gap: 2, minWidth: 0 },
  badge: { marginTop: spacing.xs },
  patient: { fontFamily: 'NunitoSans_700Bold' },
  time: { flexShrink: 0 },
});
