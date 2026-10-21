import { FileDown, History as HistoryIcon, Lock } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TabScreenProps } from '../../app/navigation/types';
import { CaregiverScreen } from '../../components/layout/CaregiverScreen';
import { AppText, Button, Chip, EmptyState, ErrorState, LoadingSkeleton, TextField } from '../../components/ui';
import { services, toAppError, type AppError } from '../../services';
import { useAppStore } from '../../store/appStore';
import { formatDateBR, keyToDateBR } from '../../lib/date';
import {
  emptyHistoryNotice,
  hasMoreHistory,
  HISTORY_PAGE_SIZE,
  HISTORY_STATUS_FILTERS,
  historyRange,
  mergeHistory,
  shiftDateKey,
  type HistoryPeriod,
} from '../../lib/history';
import { appTodayKey } from '../../lib/serverClock';
import { useQuery } from '../../lib/useQuery';
import { useNow } from '../../lib/useNow';
import type { DoseView, HistoryStatusFilter } from '../../types/views';
import { radius, spacing, useTheme } from '../../theme';
import { HistoryList } from './HistoryList';

/** Páginas seguintes já carregadas ("carregar mais"), válidas só para os filtros em `key`. */
interface MorePages {
  key: string;
  items: DoseView[];
  lastPage: number;
  totalPages: number;
}

/**
 * Histórico de doses (UC-011): filtros de idoso (ElderSwitcher), remédio, status e período; páginas de 20 do mais
 * recente para o mais antigo, com "carregar mais". Datas no fuso de São Paulo. Período sem registros mostra aviso
 * (RN-011); período invertido é recusado na tela e, se chegar à API, a mensagem do 400 é mostrada.
 */
export function HistoryScreen({ navigation }: TabScreenProps<'Historico'>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const elder = useAppStore((s) => s.selectedElderId);
  const now = useNow();
  const today = appTodayKey(now);
  const [status, setStatus] = useState<HistoryStatusFilter>('ALL');
  const [period, setPeriod] = useState<HistoryPeriod>('7');
  const [customFrom, setCustomFrom] = useState(keyToDateBR(shiftDateKey(today, -13)));
  const [customTo, setCustomTo] = useState(keyToDateBR(today));
  // O remédio escolhido vale só para o idoso em que foi escolhido
  const [medicationChoice, setMedicationChoice] = useState<{ elder: string; id: string } | null>(null);
  const medicationId = medicationChoice && medicationChoice.elder === elder ? medicationChoice.id : undefined;

  const range = historyRange(period, today, customFrom, customTo);
  const filters = { elder, medicationId, from: range.from, to: range.to, status };
  const filtersKey = JSON.stringify(filters);

  const first = useQuery(['history', filtersKey], () => services.doses.listHistory({ ...filters, page: 0, size: HISTORY_PAGE_SIZE }), {
    enabled: !range.error,
  });
  const medications = useQuery(['history-medications', elder], () => services.medications.list(elder), { enabled: elder !== 'ALL' });

  const [more, setMore] = useState<MorePages | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<AppError | null>(null);
  const current = more && more.key === filtersKey ? more : null;
  const firstPage = first.data;
  const doses = firstPage ? mergeHistory(firstPage.items, current?.items ?? []) : [];
  const pageInfo = current ? { page: current.lastPage, totalPages: current.totalPages } : firstPage ? { page: firstPage.page, totalPages: firstPage.totalPages } : null;
  const canLoadMore = !range.error && pageInfo !== null && hasMoreHistory(pageInfo);

  const loadMore = async () => {
    if (!pageInfo || loadingMore) return;
    const key = filtersKey;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const next = await services.doses.listHistory({ ...filters, page: pageInfo.page + 1, size: HISTORY_PAGE_SIZE });
      setMore((prev) => {
        const base = prev && prev.key === key ? prev.items : [];
        return { key, items: [...base, ...next.items], lastPage: next.page, totalPages: next.totalPages };
      });
    } catch (e) {
      setMoreError(toAppError(e));
    } finally {
      setLoadingMore(false);
    }
  };

  const filtered = status !== 'ALL' || medicationId !== undefined;
  const notice = emptyHistoryNotice(range, filtered);

  const header = (
    <View style={styles.filters}>
      <AppText variant="label">Status</AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {HISTORY_STATUS_FILTERS.map((s) => (
          <Chip key={s.value} label={s.label} selected={status === s.value} onPress={() => setStatus(s.value)} />
        ))}
      </ScrollView>
      {elder !== 'ALL' && medications.data && medications.data.length > 0 ? (
        <>
          <AppText variant="label">Remédio</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label="Todos" selected={medicationId === undefined} onPress={() => setMedicationChoice(null)} />
            {medications.data.map((m) => (
              <Chip
                key={m.medication.id}
                label={m.medication.name}
                selected={medicationId === m.medication.id}
                onPress={() => setMedicationChoice({ elder, id: m.medication.id })}
              />
            ))}
          </ScrollView>
        </>
      ) : null}
      <AppText variant="label">Período</AppText>
      <View style={styles.chips}>
        <Chip label="7 dias" selected={period === '7'} onPress={() => setPeriod('7')} />
        <Chip label="30 dias" selected={period === '30'} onPress={() => setPeriod('30')} />
        <Chip label="Personalizado" selected={period === 'custom'} onPress={() => setPeriod('custom')} />
      </View>
      {period === 'custom' ? (
        <View style={styles.range}>
          <View style={styles.flex}>
            <TextField label="De" value={customFrom} onChangeText={setCustomFrom} mask="date" keyboardType="number-pad" />
          </View>
          <View style={styles.flex}>
            <TextField label="Até" value={customTo} onChangeText={setCustomTo} mask="date" keyboardType="number-pad" />
          </View>
        </View>
      ) : null}
      {range.error ? (
        <AppText variant="caption" color={colors.danger} accessibilityRole="alert">
          {range.error}
        </AppText>
      ) : null}
      <View style={[styles.notice, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        <Lock color={colors.textMuted} size={16} />
        <AppText variant="caption" muted style={styles.flex}>
          Registros de doses não podem ser alterados retroativamente (RN08).
        </AppText>
      </View>
      <Button title="Exportar histórico em PDF" icon={FileDown} variant="secondary" onPress={() => navigation.navigate('ExportPdf')} />
      {firstPage && firstPage.totalElements > 0 ? (
        <AppText variant="caption" muted>
          {firstPage.totalElements} {firstPage.totalElements === 1 ? 'registro' : 'registros'} no período
        </AppText>
      ) : null}
    </View>
  );

  const footer =
    canLoadMore || moreError ? (
      <View style={styles.footer}>
        {moreError ? (
          <AppText variant="caption" color={colors.danger} accessibilityRole="alert">
            {moreError.message}
          </AppText>
        ) : null}
        <Button
          title={moreError ? 'Tentar carregar de novo' : 'Carregar mais'}
          variant="secondary"
          loading={loadingMore}
          disabled={loadingMore}
          onPress={loadMore}
          accessibilityHint={`Mostra registros mais antigos (${doses.length} de ${firstPage?.totalElements ?? 0})`}
        />
      </View>
    ) : undefined;

  return (
    <CaregiverScreen title="Histórico de doses" subtitle={`${formatDateBR(range.from)} a ${formatDateBR(range.to)}`} withElderSwitcher>
      {first.loading ? (
        <ScrollView contentContainerStyle={styles.pad}>
          {header}
          <LoadingSkeleton />
        </ScrollView>
      ) : first.error ? (
        <ScrollView contentContainerStyle={styles.pad}>
          {header}
          <ErrorState error={first.error} onRetry={first.reload} />
        </ScrollView>
      ) : (
        <HistoryList
          doses={range.error ? [] : doses}
          todayKey={today}
          showElder={elder === 'ALL'}
          onPress={(d) => navigation.navigate('DoseDetail', { doseId: d.id })}
          header={header}
          footer={footer}
          bottomInset={insets.bottom}
          empty={range.error ? undefined : <EmptyState icon={HistoryIcon} title={notice.title} description={notice.description} />}
        />
      )}
    </CaregiverScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: { padding: spacing.lg, gap: spacing.md },
  filters: { gap: spacing.sm, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  range: { flexDirection: 'row', gap: spacing.md },
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.xs },
  footer: { gap: spacing.sm, marginTop: spacing.md },
});
