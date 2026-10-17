import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, DoseStatusBadge, PillVisual, statusLabel } from '../../components/ui';
import { formatTime } from '../../lib/date';
import { TYPE_LABEL } from '../../lib/medicationMeta';
import type { DoseView } from '../../types/views';
import { cardShadow, radius, spacing, useTheme } from '../../theme';

interface Props {
  dose: DoseView;
  showElder?: boolean;
  showDate?: boolean;
  onPress?: () => void;
}

/** Linha de dose do cuidador: desenho do remédio, nome, horário e status. */
export function DoseCard({ dose, showElder, onPress }: Props) {
  const { colors, mode } = useTheme();
  const med = dose.medication;
  const time = formatTime(dose.scheduledAt);
  const confirmed = dose.confirmedAt ? `Confirmada às ${formatTime(dose.confirmedAt)}` : null;
  const detail =
    dose.status === 'ATRASADA'
      ? `Aviso enviado às ${formatTime(dose.window.alertAt)}`
      : dose.status === 'PENDENTE'
        ? 'Aguardando confirmação'
        : dose.status === 'NAO_TOMADA'
          ? 'Prazo encerrado sem confirmação'
          : confirmed;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${med.name} ${med.dosage}, ${TYPE_LABEL[med.type]}, às ${time}${showElder ? `, ${dose.elderName}` : ''}. ${statusLabel(dose.status)}. ${detail ?? ''}`}
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
        <AppText variant="heading" numberOfLines={1}>
          {med.name} {med.dosage}
        </AppText>
        <AppText variant="caption" muted numberOfLines={1}>
          {TYPE_LABEL[med.type]} • {dose.doseQuantity}
          {dose.timeNote ? ` • ${dose.timeNote}` : ''}
        </AppText>
        {showElder ? (
          <AppText variant="caption" color={colors.primaryDark} style={styles.elder} numberOfLines={1}>
            {dose.elderName}
          </AppText>
        ) : null}
        {detail ? (
          <AppText variant="caption" muted numberOfLines={1}>
            {detail}
          </AppText>
        ) : null}
      </View>
      <View style={styles.right}>
        <AppText variant="title">{time}</AppText>
        <DoseStatusBadge status={dose.status} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 4,
    minHeight: 76,
  },
  middle: { flex: 1, gap: 1 },
  right: { alignItems: 'flex-end', gap: 4 },
  elder: { fontFamily: 'NunitoSans_700Bold' },
});
