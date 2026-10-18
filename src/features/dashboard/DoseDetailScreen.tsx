import { Lock, MessageCircle } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootScreenProps } from '../../app/navigation/types';
import { StackHeader } from '../../components/layout/StackHeader';
import { AppText, Button, Card, DoseStatusBadge, ErrorState, LoadingSkeleton, PillSizeLegend, PillVisual } from '../../components/ui';
import { services } from '../../services';
import { useAppStore } from '../../store/appStore';
import { firstName, formatDateBR, formatTime } from '../../lib/date';
import { liveAt } from '../../lib/doseLive';
import { TYPE_LABEL, describeAppearance } from '../../lib/medicationMeta';
import { useQuery } from '../../lib/useQuery';
import { minuteStamp, useNow } from '../../lib/useNow';
import { radius, spacing, useTheme } from '../../theme';

/** Detalhe somente leitura de uma dose (RN08: sem editar nem apagar). */
export function DoseDetailScreen({ route, navigation }: RootScreenProps<'DoseDetail'>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const setSelected = useAppStore((s) => s.setSelectedElder);
  const now = useNow();
  const { doseId, elderId, day } = route.params;
  const hint = elderId && day ? { elderId, day } : undefined;
  const q = useQuery(['dose', doseId], () => services.doses.get(doseId, hint), { silentKey: minuteStamp(now) });
  const d = q.data ? liveAt(q.data, now) : undefined;

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <StackHeader title="Detalhes da dose" subtitle={d ? d.elderName : undefined} />
      {q.loading ? (
        <View style={styles.body}><LoadingSkeleton rows={2} /></View>
      ) : q.error || !d ? (
        <ErrorState error={q.error} onRetry={q.reload} />
      ) : (
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]}>
          <Card style={styles.hero}>
            <PillVisual appearance={d.medication} size="lg" name={d.medication.name} />
            <View style={styles.flex}>
              <AppText variant="title">{d.medication.name} {d.medication.dosage}</AppText>
              <AppText muted>{TYPE_LABEL[d.medication.type]} • {d.doseQuantity} • {d.route}</AppText>
              <View style={{ marginTop: spacing.sm }}>
                <DoseStatusBadge status={d.status} size="md" />
              </View>
            </View>
          </Card>

          <Card style={styles.gap}>
            <PillSizeLegend appearance={d.medication} doseQuantity={d.doseQuantity} />
            <AppText variant="caption" muted>{describeAppearance(d.medication)}</AppText>
          </Card>

          <Card style={styles.gap}>
            <Row label="Paciente" value={d.elderName} />
            <Row label="Data" value={formatDateBR(d.scheduledAt.slice(0, 10))} />
            <Row label="Horário programado" value={formatTime(d.scheduledAt)} />
            {d.timeNote ? <Row label="Observação" value={d.timeNote} /> : null}
            <Row label="Confirmação" value={d.confirmedAt ? `às ${formatTime(d.confirmedAt)}` : 'Não registrada'} />
            <Row label="Pode confirmar a partir de" value={formatTime(d.window.opensAt)} />
            <Row label="Aviso ao cuidador" value={`${formatTime(d.window.alertAt)} (tolerância de ${d.toleranceMinutes} min)`} />
            <Row label="Encerramento" value={formatTime(d.window.closesAt)} />
          </Card>

          {d.status === 'ATRASADA' ? (
            <Card tone="alt" style={styles.gap}>
              <AppText>
                O aviso já foi enviado. {firstName(d.elderName)} ainda pode confirmar com atraso até {formatTime(d.window.closesAt)}; depois disso
                a dose passa a &quot;Não tomada&quot;.
              </AppText>
              <Button
                title={`Enviar mensagem para ${firstName(d.elderName)}`}
                icon={MessageCircle}
                onPress={() => {
                  setSelected(d.elderId);
                  navigation.navigate('CaregiverTabs', { screen: 'Mensagens' });
                }}
              />
            </Card>
          ) : null}

          {d.storedStatus !== 'PENDENTE' || d.status === 'NAO_TOMADA' ? (
            <View style={[styles.locked, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <Lock color={colors.textMuted} size={18} />
              <AppText variant="caption" muted style={styles.flex}>
                Registro de dose definitivo: não pode ser alterado retroativamente (RN08).
              </AppText>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <AppText variant="label" muted style={styles.rowLabel}>{label}</AppText>
      <AppText variant="bodyStrong" style={styles.rowValue}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: spacing.lg, gap: spacing.md },
  hero: { flexDirection: 'row', gap: spacing.lg, alignItems: 'center' },
  gap: { gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, minHeight: 28, alignItems: 'center' },
  rowLabel: { flex: 1 },
  rowValue: { flex: 1.2, textAlign: 'right' },
  locked: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
});
