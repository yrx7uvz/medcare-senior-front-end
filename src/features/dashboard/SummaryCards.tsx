import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { AppText, type IconComponent } from '../../components/ui';
import type { DoseSummary } from '../../lib/doseRules';
import type { DisplayStatus } from '../../types/domain';
import { cardShadow, radius, spacing, useTheme } from '../../theme';

/** Contadores do dia: Confirmadas / Pendentes / Não confirmadas. */
export function SummaryCards({ summary }: { summary: DoseSummary }) {
  const items: { status: DisplayStatus; label: string; value: number; icon: IconComponent }[] = [
    { status: 'TOMADA', label: 'Confirmadas', value: summary.confirmed, icon: CheckCircle2 },
    { status: 'PENDENTE', label: 'Pendentes', value: summary.pending, icon: Clock },
    { status: 'NAO_TOMADA', label: 'Não confirmadas', value: summary.missed, icon: AlertTriangle },
  ];
  return (
    <View style={styles.row}>
      {items.map((it) => (
        <SummaryCard key={it.status} {...it} />
      ))}
    </View>
  );
}

function SummaryCard({ status, label, value, icon: Icon }: { status: DisplayStatus; label: string; value: number; icon: IconComponent }) {
  const { colors, mode } = useTheme();
  const c = colors.status[status];
  return (
    <View
      accessible
      accessibilityLabel={`${value} ${label.toLowerCase()}`}
      style={[styles.card, cardShadow(mode === 'dark'), { backgroundColor: colors.surface, borderColor: colors.border, borderTopColor: c.accent }]}
    >
      <View style={styles.top}>
        <AppText variant="number" color={c.fg}>
          {value}
        </AppText>
        <Icon color={c.fg} size={18} strokeWidth={2.4} />
      </View>
      <AppText variant="label" muted numberOfLines={2}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  card: { flex: 1, borderRadius: radius.lg, padding: spacing.md, gap: 2, borderWidth: StyleSheet.hairlineWidth, borderTopWidth: 4 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
