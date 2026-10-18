import { CalendarX, ChevronLeft, ChevronRight, UserPlus } from 'lucide-react-native';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootScreenProps } from '../../app/navigation/types';
import { StackHeader } from '../../components/layout/StackHeader';
import { AppText, Avatar, Card, Chip, EmptyState, ErrorState, IconButton, LoadingSkeleton, RefreshFailedBanner } from '../../components/ui';
import { services } from '../../services';
import { useAppStore } from '../../store/appStore';
import { addDays, formatDayHeader, parseDateTime, toDateKey } from '../../lib/date';
import { liveAt } from '../../lib/doseLive';
import { appTodayKey } from '../../lib/serverClock';
import { useQuery } from '../../lib/useQuery';
import { minuteStamp, useNow } from '../../lib/useNow';
import type { DailyReportTotals } from '../../types/views';
import { radius, spacing, useTheme } from '../../theme';
import { DoseCard } from '../dashboard/DoseCard';

/**
 * UC-008 / HU06 — "Visualizar Relatório Diário de Uso dos Medicamentos": as doses de um dia de um idoso, com o status
 * de cada uma e os totais, atualizado automaticamente. Paciente e dia selecionáveis (dias passados e hoje).
 */
export function DailyReportScreen({ route, navigation }: RootScreenProps<'DailyReport'>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const filter = useAppStore((s) => s.selectedElderId);
  const now = useNow();
  const today = appTodayKey(now);
  const elders = useQuery(['elders'], () => services.elders.list());
  const [chosenElder, setChosenElder] = useState<string | undefined>(route.params?.elderId ?? (filter !== 'ALL' ? filter : undefined));
  const [day, setDay] = useState(route.params?.day ?? today);
  const elderId = chosenElder ?? elders.data?.[0]?.id;
  const report = useQuery(['daily-report', elderId, day], () => services.reports.getDaily(elderId!, day), {
    enabled: !!elderId,
    silentKey: minuteStamp(now),
  });

  const shift = (days: number) => setDay(toDateKey(addDays(parseDateTime(day), days)));
  const doses = (report.data?.doses ?? []).map((d) => liveAt(d, now));

  let content: React.ReactNode;
  if (elders.loading || (report.loading && !!elderId)) {
    content = <LoadingSkeleton rows={3} />;
  } else if (elders.error || report.error) {
    content = (
      <ErrorState
        error={elders.error ?? report.error}
        onRetry={() => {
          elders.reload();
          report.reload();
        }}
      />
    );
  } else if (!elders.data?.length) {
    content = (
      <EmptyState
        icon={UserPlus}
        title="Nenhum paciente cadastrado"
        description="Cadastre um paciente para acompanhar o uso dos medicamentos."
        actionLabel="Cadastrar paciente"
        onAction={() => navigation.navigate('ElderForm')}
      />
    );
  } else if (report.data) {
    content = (
      <>
        <Totals totals={report.data.totals} />
        {doses.length === 0 ? (
          // UC-008, fluxo 2a: sem tratamento ativo para o dia
          <EmptyState icon={CalendarX} title="Nenhuma dose programada para este dia" description="Não há remédios agendados para este paciente nesta data." />
        ) : (
          doses.map((d) => <DoseCard key={d.id} dose={d} onPress={() => navigation.navigate('DoseDetail', { doseId: d.id })} />)
        )}
      </>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <StackHeader title="Relatório diário" subtitle="Uso dos medicamentos no dia" />
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]}
        refreshControl={<RefreshControl refreshing={false} onRefresh={report.reload} colors={[colors.primary]} />}
      >
        {elders.data && elders.data.length > 1 ? (
          <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Paciente">
            {elders.data.map((e) => (
              <Chip
                key={e.id}
                label={e.name}
                selected={e.id === elderId}
                onPress={() => setChosenElder(e.id)}
                leading={<Avatar name={e.name} color={e.avatarColor} size={24} />}
              />
            ))}
          </View>
        ) : null}

        <View style={[styles.dayRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <IconButton icon={ChevronLeft} accessibilityLabel="Dia anterior" onPress={() => shift(-1)} />
          <AppText variant="heading" align="center" style={styles.flex} accessibilityLiveRegion="polite">
            {formatDayHeader(day, today)}
          </AppText>
          <IconButton icon={ChevronRight} accessibilityLabel="Próximo dia" disabled={day >= today} onPress={() => shift(1)} />
        </View>

        {report.refreshError ? <RefreshFailedBanner onRetry={report.refresh} /> : null}
        {content}
      </ScrollView>
    </View>
  );
}

function Totals({ totals }: { totals: DailyReportTotals }) {
  const { colors } = useTheme();
  const items: { label: string; value: number; fg: string; bg: string }[] = [
    { label: 'Tomadas', value: totals.taken, ...colors.status.TOMADA },
    { label: 'Com atraso', value: totals.late, ...colors.status.CONFIRMADA_COM_ATRASO },
    { label: 'Não tomadas', value: totals.missed, ...colors.status.NAO_TOMADA },
    { label: 'Pendentes', value: totals.pending, ...colors.status.PENDENTE },
  ];
  return (
    <Card style={styles.totals}>
      <View style={styles.totalsRow}>
        {items.map((it) => (
          <View key={it.label} style={[styles.total, { backgroundColor: it.bg }]} accessible accessibilityLabel={`${it.label}: ${it.value}`}>
            <AppText variant="title" color={it.fg}>
              {it.value}
            </AppText>
            <AppText variant="caption" color={it.fg}>
              {it.label}
            </AppText>
          </View>
        ))}
      </View>
      <AppText variant="bodyStrong" accessibilityLiveRegion="polite">
        {totals.adherencePercent === null
          ? 'Adesão do dia: ainda sem doses encerradas'
          : `Adesão do dia: ${String(totals.adherencePercent).replace('.', ',')}% (${totals.taken + totals.late} de ${totals.total - totals.pending})`}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: spacing.lg, gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dayRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.xs },
  totals: { gap: spacing.md },
  totalsRow: { flexDirection: 'row', gap: spacing.sm },
  total: { flex: 1, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' },
});
