import { CheckCircle2, FileDown, FileText, Share2, Users } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootScreenProps } from '../../app/navigation/types';
import { ElderSwitcher } from '../../components/layout/ElderSwitcher';
import { StackHeader } from '../../components/layout/StackHeader';
import {
  AdherenceBars, AppText, Avatar, Button, Card, Chip, EmptyState, ErrorState, LoadingSkeleton, PillVisual, TextField,
} from '../../components/ui';
import { services } from '../../services';
import { useAppStore } from '../../store/appStore';
import { addDays, dateBRToKey, formatDateBR, formatTime } from '../../lib/date';
import { useMutation, useQuery } from '../../lib/useQuery';
import { useNow } from '../../lib/useNow';
import type { PdfResult } from '../../types/views';
import { radius, spacing, useTheme } from '../../theme';

const CONTENTS = [
  'Nome do paciente e período do relatório',
  'Remédios em uso, com dosagem e tipo',
  'Cada dose com data, horário e status',
  'Taxa de adesão por remédio e geral',
];

/** T07B — Exportar PDF (simulado). Exige um paciente específico. */
export function ExportPdfScreen({ navigation }: RootScreenProps<'ExportPdf'>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const filter = useAppStore((s) => s.selectedElderId);
  const setSelected = useAppStore((s) => s.setSelectedElder);
  const now = useNow(60_000);
  const [from, setFrom] = useState(formatDateBR(addDays(now, -29)));
  const [to, setTo] = useState(formatDateBR(now));
  const [result, setResult] = useState<PdfResult | null>(null);
  const elders = useQuery(['elders'], () => services.elders.list());

  const fromKey = dateBRToKey(from);
  const toKey = dateBRToKey(to);
  const rangeError = !fromKey || !toKey ? 'Use datas no formato DD/MM/AAAA.' : fromKey > toKey ? 'A data de início não pode ser depois do fim.' : null;
  const elderId = filter === 'ALL' ? null : filter;

  const report = useQuery(
    ['adherence', elderId, fromKey, toKey],
    () => services.reports.getAdherence(elderId!, fromKey!, toKey!),
    { enabled: !!elderId && !rangeError },
  );
  const generate = useMutation(services.reports.generatePdf);

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <StackHeader title="Exportar PDF" subtitle="Relatório de adesão para a consulta" />
      <ElderSwitcher />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]}>
        {!elderId ? (
          <Card style={styles.card}>
            <EmptyState icon={Users} title="Escolha o paciente" description="O relatório em PDF é feito para um paciente por vez." />
            <View style={styles.chips}>
              {(elders.data ?? []).map((e) => (
                <Chip key={e.id} label={e.name} onPress={() => setSelected(e.id)} leading={<Avatar name={e.name} color={e.avatarColor} size={24} />} />
              ))}
            </View>
          </Card>
        ) : (
          <>
            <Card style={styles.card}>
              <AppText variant="heading" accessibilityRole="header">Período</AppText>
              <View style={styles.range}>
                <View style={styles.flex}>
                  <TextField label="Data de início" value={from} onChangeText={(v) => { setFrom(v); setResult(null); }} mask="date" keyboardType="number-pad" />
                </View>
                <View style={styles.flex}>
                  <TextField label="Data de fim" value={to} onChangeText={(v) => { setTo(v); setResult(null); }} mask="date" keyboardType="number-pad" />
                </View>
              </View>
              {rangeError ? <AppText variant="caption" color={colors.danger}>{rangeError}</AppText> : null}
            </Card>

            <Card style={styles.card}>
              <AppText variant="heading" accessibilityRole="header">O PDF terá</AppText>
              {CONTENTS.map((c) => (
                <View key={c} style={styles.contentRow}>
                  <CheckCircle2 color={colors.status.CONFIRMADA_NO_HORARIO.fg} size={18} />
                  <AppText style={styles.flex}>{c}</AppText>
                </View>
              ))}
            </Card>

            <Card style={styles.card}>
              <View style={styles.titleRow}>
                <AppText variant="heading" accessibilityRole="header" style={styles.flex}>Prévia da adesão</AppText>
                {report.data?.overallRate != null ? <AppText variant="title" color={colors.primaryDark}>{report.data.overallRate}% geral</AppText> : null}
              </View>
              {rangeError ? null : report.loading ? (
                <LoadingSkeleton rows={2} />
              ) : report.error ? (
                <ErrorState error={report.error} onRetry={report.reload} />
              ) : report.data && report.data.items.length ? (
                <>
                  <AdherenceBars
                    items={report.data.items.map((i) => ({
                      key: i.medication.id,
                      label: `${i.medication.name} ${i.medication.dosage}`,
                      rate: i.rate,
                      detail: `${i.confirmed} de ${i.confirmed + i.missed} doses confirmadas${i.late ? ` (${i.late} com atraso)` : ''}${i.open ? ` • ${i.open} em aberto` : ''}`,
                      leading: <PillVisual appearance={i.medication} size="sm" />,
                    }))}
                  />
                  <AppText variant="caption" muted>
                    Adesão = doses confirmadas ÷ doses encerradas no período. Doses ainda em aberto não entram na conta. A linha vertical marca 80%.
                  </AppText>
                </>
              ) : (
                <AppText muted>Nenhuma dose registrada neste período.</AppText>
              )}
            </Card>

            {result ? (
              <Card style={[styles.card, { borderColor: colors.status.CONFIRMADA_NO_HORARIO.accent, borderWidth: 1.5 }]}>
                <View style={styles.titleRow} accessibilityLiveRegion="polite">
                  <FileText color={colors.status.CONFIRMADA_NO_HORARIO.fg} size={26} />
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong">PDF gerado (simulação)</AppText>
                    <AppText variant="caption" muted>
                      {result.fileName} • {result.sizeKb} KB • às {formatTime(result.generatedAt)}
                    </AppText>
                  </View>
                </View>
                <Button
                  title="Compartilhar"
                  icon={Share2}
                  variant="secondary"
                  onPress={() =>
                    Share.share({ message: `Relatório de adesão ${result.fileName} (arquivo simulado no protótipo do MedCare Sênior).` })
                  }
                />
              </Card>
            ) : null}
            {generate.error ? <AppText color={colors.danger}>{generate.error.message}</AppText> : null}

            <Button
              title={generate.loading ? 'Gerando PDF…' : 'Gerar e baixar PDF'}
              icon={FileDown}
              size="lg"
              loading={generate.loading}
              disabled={!!rangeError || !report.data}
              onPress={async () => {
                const r = await generate.mutate(elderId, fromKey!, toKey!);
                if (r) setResult(r);
              }}
            />
            <Button title="Voltar ao histórico" variant="ghost" onPress={() => navigation.goBack()} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: spacing.lg, gap: spacing.lg },
  card: { gap: spacing.md, borderRadius: radius.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  range: { flexDirection: 'row', gap: spacing.md },
  contentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
