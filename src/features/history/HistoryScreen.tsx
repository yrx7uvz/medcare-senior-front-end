import { FileDown, History as HistoryIcon, Lock } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TabScreenProps } from '../../app/navigation/types';
import { CaregiverScreen } from '../../components/layout/CaregiverScreen';
import { AppText, Button, Chip, EmptyState, ErrorState, LoadingSkeleton, TextField } from '../../components/ui';
import { services } from '../../services';
import { useAppStore } from '../../store/appStore';
import { addDays, dateBRToKey, formatDateBR, toDateKey } from '../../lib/date';
import { useQuery } from '../../lib/useQuery';
import { minuteStamp, useNow } from '../../lib/useNow';
import type { HistoryStatusFilter } from '../../types/views';
import { radius, spacing, useTheme } from '../../theme';
import { HistoryList } from './HistoryList';

const STATUS_FILTERS: { value: HistoryStatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'CONFIRMED', label: 'Confirmadas' },
  { value: 'MISSED', label: 'Não confirmadas' },
  { value: 'LATE', label: 'Com atraso' },
];
type Period = '7' | '30' | 'custom';

/** T07 — Histórico com filtros de status, período e (via ElderSwitcher) idoso. */
export function HistoryScreen({ navigation }: TabScreenProps<'Historico'>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const filter = useAppStore((s) => s.selectedElderId);
  const now = useNow();
  const today = toDateKey(now);
  const [status, setStatus] = useState<HistoryStatusFilter>('ALL');
  const [period, setPeriod] = useState<Period>('7');
  const [customFrom, setCustomFrom] = useState(formatDateBR(addDays(now, -13)));
  const [customTo, setCustomTo] = useState(formatDateBR(now));

  let from = toDateKey(addDays(now, -(Number(period) - 1)));
  let to = today;
  let rangeError: string | null = null;
  if (period === 'custom') {
    const f = dateBRToKey(customFrom);
    const t = dateBRToKey(customTo);
    if (!f || !t) rangeError = 'Use datas no formato DD/MM/AAAA.';
    else if (f > t) rangeError = 'A data de início não pode ser depois do fim.';
    else {
      from = f;
      to = t;
    }
  }

  const q = useQuery(
    ['history', filter, from, to, status],
    () => services.doses.listHistory({ elder: filter, from, to, status }),
    { enabled: !rangeError, silentKey: minuteStamp(now) },
  );

  const filters = (
    <View style={styles.filters}>
      <AppText variant="label">Status</AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {STATUS_FILTERS.map((s) => (
          <Chip key={s.value} label={s.label} selected={status === s.value} onPress={() => setStatus(s.value)} />
        ))}
      </ScrollView>
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
      {rangeError ? <AppText variant="caption" color={colors.danger}>{rangeError}</AppText> : null}
      <View style={[styles.notice, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        <Lock color={colors.textMuted} size={16} />
        <AppText variant="caption" muted style={styles.flex}>
          Registros de doses não podem ser alterados retroativamente (RN08).
        </AppText>
      </View>
      <Button title="Exportar histórico em PDF" icon={FileDown} variant="secondary" onPress={() => navigation.navigate('ExportPdf')} />
    </View>
  );

  return (
    <CaregiverScreen title="Histórico de doses" subtitle={`${formatDateBR(from)} a ${formatDateBR(to)}`} withElderSwitcher>
      {q.loading ? (
        <ScrollView contentContainerStyle={styles.pad}>
          {filters}
          <LoadingSkeleton />
        </ScrollView>
      ) : q.error ? (
        <ScrollView contentContainerStyle={styles.pad}>
          {filters}
          <ErrorState error={q.error} onRetry={q.reload} />
        </ScrollView>
      ) : (
        <HistoryList
          doses={rangeError ? [] : q.data ?? []}
          todayKey={today}
          showElder={filter === 'ALL'}
          onPress={(d) => navigation.navigate('DoseDetail', { doseId: d.id })}
          header={filters}
          bottomInset={insets.bottom}
          empty={
            rangeError ? undefined : (
              <EmptyState icon={HistoryIcon} title="Nenhuma dose neste filtro" description="Mude o status ou o período para ver outros registros." />
            )
          }
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
});
