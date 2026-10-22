import { CommonActions } from '@react-navigation/native';
import { CheckCircle2, Lock, MessageCircle, SearchX } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootScreenProps } from '../../app/navigation/types';
import { StackHeader } from '../../components/layout/StackHeader';
import {
  AppText, Button, Card, ConfirmDialog, DoseStatusBadge, EmptyState, ErrorState, LoadingSkeleton, PillSizeLegend, PillVisual,
} from '../../components/ui';
import { services } from '../../services';
import { useAppStore } from '../../store/appStore';
import { firstName, formatDateBR, formatTime } from '../../lib/date';
import { caregiverConfirmState, confirmFailure, confirmQuestion } from '../../lib/doseConfirm';
import { liveAt } from '../../lib/doseLive';
import { doseOpenFailure } from '../../lib/doseOpen';
import { TYPE_LABEL, describeAppearance } from '../../lib/medicationMeta';
import { invalidateQueries } from '../../lib/queryBus';
import { useMutation, useQuery } from '../../lib/useQuery';
import { minuteStamp, useNow } from '../../lib/useNow';
import { radius, spacing, useTheme } from '../../theme';

/**
 * Detalhe da dose para o cuidador: dados do remédio, janela e quem confirmou. Enquanto a dose está pendente e dentro do
 * prazo (janela e limite de confirmação vindos do servidor), o cuidador pode confirmar por aqui. Dose registrada não
 * muda.
 */
export function DoseDetailScreen({ route, navigation }: RootScreenProps<'DoseDetail'>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const setSelected = useAppStore((s) => s.setSelectedElder);
  const showToast = useAppStore((s) => s.showToast);
  const now = useNow();
  const { doseId, elderId, day, fromPush } = route.params;
  const hint = elderId && day ? { elderId, day } : undefined;
  const q = useQuery(['dose', doseId], () => services.doses.get(doseId, hint), { silentKey: minuteStamp(now) });
  const d = q.data ? liveAt(q.data, now) : undefined;
  const missing = doseOpenFailure(q.error);
  const loadedElderId = q.data?.elderId;
  const confirm = useMutation(services.doses.confirm);
  const [asking, setAsking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  // Aberta por um aviso: o Painel por baixo passa a mostrar o paciente da dose (só depois de a API confirmar que é dele)
  useEffect(() => {
    if (fromPush && loadedElderId) setSelected(loadedElderId);
  }, [fromPush, loadedElderId, setSelected]);

  const goToPanel = () =>
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'CaregiverTabs', params: { screen: 'Painel' } }] }));

  async function confirmDose() {
    if (!d || confirm.loading) return;
    setFailure(null);
    const result = await confirm.run(d.id);
    setAsking(false);
    if (result.ok) {
      showToast('Dose confirmada.');
      // Painel, histórico e relatório do dia buscam de novo (o servidor já descartou o relatório em cache)
      invalidateQueries();
      q.reload();
      return;
    }
    const f = confirmFailure(result.error);
    setFailure(f.message);
    if (f.reload) q.reload();
  }

  const state = d ? caregiverConfirmState(d) : null;

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <StackHeader title="Detalhes da dose" subtitle={d ? d.elderName : undefined} />
      {q.loading && !q.data ? (
        <View style={styles.body}><LoadingSkeleton rows={2} /></View>
      ) : missing ? (
        <View style={styles.body}>
          <Card>
            <EmptyState icon={SearchX} title="Dose não encontrada" description={missing.notice} actionLabel="Ir para o Painel" onAction={goToPanel} />
          </Card>
        </View>
      ) : q.error || !d || !state ? (
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

          {state.kind === 'pode' ? (
            <Card style={styles.gap}>
              <AppText variant="bodyStrong">{state.message}</AppText>
              <Button
                title="Confirmar dose"
                icon={CheckCircle2}
                size="lg"
                loading={confirm.loading}
                disabled={confirm.loading}
                onPress={() => {
                  setFailure(null);
                  setAsking(true);
                }}
                accessibilityHint={`Registra que ${firstName(d.elderName)} tomou esta dose`}
              />
              {d.status === 'ATRASADA' ? (
                <AppText variant="caption" muted>
                  O aviso já foi enviado. Depois do prazo, a dose passa a &quot;Não confirmada&quot;.
                </AppText>
              ) : null}
            </Card>
          ) : state.kind === 'cedo' || state.kind === 'encerrada' ? (
            <Card tone="alt">
              <AppText variant="bodyStrong">{state.message}</AppText>
            </Card>
          ) : null}

          {failure ? (
            <View style={[styles.notice, { backgroundColor: colors.dangerSoft }]} accessibilityRole="alert">
              <AppText color={colors.danger} style={styles.flex}>{failure}</AppText>
            </View>
          ) : null}

          <Card style={styles.gap}>
            <PillSizeLegend appearance={d.medication} doseQuantity={d.doseQuantity} />
            <AppText variant="caption" muted>{describeAppearance(d.medication)}</AppText>
          </Card>

          <Card style={styles.gap}>
            <Row label="Paciente" value={d.elderName} />
            <Row label="Data" value={formatDateBR(d.scheduledAt.slice(0, 10))} />
            <Row label="Horário programado" value={formatTime(d.scheduledAt)} />
            {d.timeNote ? <Row label="Observação" value={d.timeNote} /> : null}
            <Row label="Confirmação" value={state.kind === 'registrada' && state.message ? state.message : 'Não registrada'} />
            <Row label="Pode confirmar a partir de" value={formatTime(d.window.opensAt)} />
            <Row label="Aviso ao cuidador" value={`${formatTime(d.window.alertAt)} (tolerância de ${d.toleranceMinutes} min)`} />
            <Row label="Pode ser confirmada até" value={formatTime(d.confirmUntil)} />
          </Card>

          {d.status === 'ATRASADA' ? (
            <Card tone="alt" style={styles.gap}>
              <AppText>Quer lembrar {firstName(d.elderName)} de confirmar a dose?</AppText>
              <Button
                title={`Enviar mensagem para ${firstName(d.elderName)}`}
                icon={MessageCircle}
                variant="secondary"
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
                Registro de dose definitivo: não pode ser alterado depois, para o histórico ser confiável.
              </AppText>
            </View>
          ) : null}
        </ScrollView>
      )}

      {d ? (
        <ConfirmDialog
          visible={asking}
          title="Confirmar dose"
          message={confirmQuestion(d)}
          confirmLabel="Confirmar"
          icon={CheckCircle2}
          loading={confirm.loading}
          confirmDisabled={confirm.loading}
          onConfirm={() => void confirmDose()}
          onCancel={() => {
            if (!confirm.loading) setAsking(false);
          }}
        />
      ) : null}
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
  notice: { flexDirection: 'row', gap: spacing.sm, borderRadius: radius.md, padding: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, minHeight: 28, alignItems: 'center' },
  rowLabel: { flex: 1 },
  rowValue: { flex: 1.2, textAlign: 'right' },
  locked: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
});
