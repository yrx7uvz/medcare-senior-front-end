import { CalendarCheck, CalendarX, ClipboardList, UserPlus } from 'lucide-react-native';
import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TabScreenProps } from '../../app/navigation/types';
import { AlertBanner } from '../../components/layout/AlertBanner';
import { CaregiverScreen } from '../../components/layout/CaregiverScreen';
import { AppText, Avatar, Button, EmptyState, ErrorState, LoadingSkeleton, RefreshFailedBanner } from '../../components/ui';
import { services } from '../../services';
import { useAppStore } from '../../store/appStore';
import { firstName, formatLongDate, greeting } from '../../lib/date';
import { liveAt } from '../../lib/doseLive';
import { appTodayKey } from '../../lib/serverClock';
import { summarize } from '../../lib/doseRules';
import { useQuery } from '../../lib/useQuery';
import { minuteStamp, useNow } from '../../lib/useNow';
import type { DoseView } from '../../types/views';
import { spacing, useTheme } from '../../theme';
import { DoseCard } from './DoseCard';
import { SummaryCards } from './SummaryCards';

/** T03 — Painel diário do cuidador. */
export function DashboardScreen({ navigation }: TabScreenProps<'Painel'>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const session = useAppStore((s) => s.session);
  const filter = useAppStore((s) => s.selectedPatientId);
  const dismissed = useAppStore((s) => s.dismissedAlertIds);
  const dismiss = useAppStore((s) => s.dismissAlert);
  const now = useNow();
  const today = appTodayKey(now);
  const silentKey = minuteStamp(now);

  const patients = useQuery(['patients'], () => services.patients.list());
  const doses = useQuery(['doses-day', filter, today], () => services.doses.listForDay(filter, today), { silentKey });
  const alerts = useQuery(['alerts'], () => services.doses.listAlerts(), { silentKey });

  const visibleAlerts = (alerts.data ?? []).filter(
    (a) => !dismissed.includes(`${a.doseId}:${a.status}`) && (filter === 'ALL' || a.patientId === filter),
  );
  // Status entre as atualizações: só compara agora com a janela que veio do servidor
  const list = (doses.data ?? []).map((d) => liveAt(d, now));
  const summary = summarize(list.map((d) => d.status));
  const selectedPatient = filter === 'ALL' ? null : patients.data?.find((e) => e.id === filter);
  const openDose = (d: DoseView) => navigation.navigate('DoseDetail', { doseId: d.id });

  let content: React.ReactNode;
  if (doses.loading || patients.loading) {
    content = <LoadingSkeleton variant="dashboard" />;
  } else if (doses.error || patients.error) {
    content = (
      <ErrorState
        error={doses.error ?? patients.error}
        onRetry={() => {
          doses.reload();
          patients.reload();
        }}
      />
    );
  } else if (!patients.data?.length) {
    content = (
      <EmptyState
        icon={UserPlus}
        title="Nenhum paciente cadastrado"
        description="Cadastre o primeiro paciente para começar a acompanhar as doses."
        actionLabel="Cadastrar paciente"
        onAction={() => navigation.navigate('PatientForm')}
      />
    );
  } else {
    content = (
      <>
        <SummaryCards summary={summary} />
        <View style={styles.sectionHead}>
          <AppText variant="heading" accessibilityRole="header">
            Doses de hoje
          </AppText>
          <AppText variant="caption" muted>
            {summary.total} {summary.total === 1 ? 'dose' : 'doses'}
          </AppText>
        </View>
        <Button
          title="Relatório diário"
          icon={ClipboardList}
          variant="secondary"
          size="sm"
          style={styles.reportButton}
          onPress={() => navigation.navigate('DailyReport', filter === 'ALL' ? undefined : { patientId: filter })}
          accessibilityHint="Abre o relatório de uso dos medicamentos de um paciente em um dia"
        />
        {list.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="Sem doses para hoje"
            description={
              selectedPatient
                ? `${firstName(selectedPatient.name)} não tem remédios programados para hoje.`
                : 'Nenhum paciente tem remédios programados para hoje.'
            }
          />
        ) : filter === 'ALL' ? (
          (patients.data ?? []).map((patient) => {
            const group = list.filter((d) => d.patientId === patient.id);
            const s = summarize(group.map((d) => d.status));
            const hasAlert = group.some((d) => d.status === 'ATRASADA' || d.status === 'NAO_TOMADA');
            return (
              <View key={patient.id} style={styles.group}>
                <View style={styles.groupHead} accessible accessibilityRole="header" accessibilityLabel={`${patient.name}: ${s.confirmed} de ${s.total} confirmadas`}>
                  <Avatar name={patient.name} color={patient.avatarColor} size={36} alert={hasAlert} />
                  <View style={styles.flex}>
                    <AppText variant="heading">{patient.name}</AppText>
                    <AppText variant="caption" muted>
                      {s.total ? `${s.confirmed} de ${s.total} confirmadas` : 'Sem doses hoje'}
                    </AppText>
                  </View>
                </View>
                {group.length === 0 ? (
                  <View style={[styles.noDoses, { borderColor: colors.border }]}>
                    <CalendarX color={colors.textMuted} size={18} />
                    <AppText variant="caption" muted>
                      Nenhuma dose programada para hoje.
                    </AppText>
                  </View>
                ) : (
                  group.map((d) => <DoseCard key={d.id} dose={d} onPress={() => openDose(d)} />)
                )}
              </View>
            );
          })
        ) : (
          list.map((d) => <DoseCard key={d.id} dose={d} onPress={() => openDose(d)} />)
        )}
      </>
    );
  }

  const name = firstName(session?.name ?? '');
  return (
    <CaregiverScreen title={`${greeting(now)}, ${name}`} subtitle={formatLongDate(now)} withPatientSwitcher>
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              doses.reload();
              alerts.refresh();
            }}
            colors={[colors.primary]}
          />
        }
      >
        {doses.refreshError || alerts.refreshError ? (
          <RefreshFailedBanner
            onRetry={() => {
              doses.refresh();
              alerts.refresh();
            }}
          />
        ) : null}
        {visibleAlerts.length > 0 ? (
          <AlertBanner
            alert={visibleAlerts[0]}
            extraCount={visibleAlerts.length - 1}
            onDetails={() => navigation.navigate('DoseDetail', { doseId: visibleAlerts[0].doseId })}
            onDismiss={() => dismiss(`${visibleAlerts[0].doseId}:${visibleAlerts[0].status}`)}
          />
        ) : null}
        {content}
      </ScrollView>
    </CaregiverScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: spacing.lg, gap: spacing.md },
  reportButton: { alignSelf: 'flex-start' },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: spacing.sm },
  group: { gap: spacing.sm, marginBottom: spacing.sm },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
  noDoses: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, padding: spacing.md },
});
