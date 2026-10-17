import { AlertTriangle, X } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import type { AlertView } from '../../types/views';
import { formatTime } from '../../lib/date';
import { radius, spacing, useTheme } from '../../theme';
import { AppText, Button, IconButton } from '../ui';

interface Props {
  alert: AlertView;
  onDetails: () => void;
  onDismiss: () => void;
  extraCount?: number;
}

export function alertMessage(a: AlertView) {
  return a.status === 'NAO_TOMADA'
    ? `${a.medicationName} ${a.dosage} (${formatTime(a.scheduledAt)}) não foi tomada. O prazo terminou.`
    : `${a.medicationName} ${a.dosage} (${formatTime(a.scheduledAt)}) não foi confirmada dentro da tolerância.`;
}

/** Faixa vermelha do painel quando há dose não confirmada além da tolerância. */
export function AlertBanner({ alert, onDetails, onDismiss, extraCount = 0 }: Props) {
  const { colors } = useTheme();
  const c = colors.status.NAO_TOMADA;
  return (
    <View
      style={[styles.wrap, { backgroundColor: c.bg, borderColor: c.accent }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
    >
      <View style={styles.top}>
        <AlertTriangle color={c.fg} size={22} />
        <View style={styles.texts}>
          <AppText variant="bodyStrong" color={c.fg}>
            Dose não confirmada — {alert.elderName}
          </AppText>
          <AppText variant="body" color={colors.text}>
            {alertMessage(alert)}
          </AppText>
          {extraCount > 0 ? (
            <AppText variant="caption" color={c.fg}>
              E mais {extraCount} {extraCount === 1 ? 'alerta' : 'alertas'} hoje.
            </AppText>
          ) : null}
        </View>
        <IconButton icon={X} color={c.fg} size={40} accessibilityLabel="Fechar alerta" onPress={onDismiss} />
      </View>
      <View style={styles.actions}>
        <Button title="Ver detalhes" size="sm" variant="danger" onPress={onDetails} style={styles.flex} />
        <Button title="Fechar" size="sm" variant="ghost" onPress={onDismiss} style={styles.flex} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, borderWidth: 1.5, padding: spacing.md, gap: spacing.sm },
  top: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  texts: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
