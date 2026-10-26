import { CalendarCheck, CheckCircle2, MessageCircle, Pill } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import type { RootScreenProps } from '../../app/navigation/types';
import { PatientScreen } from '../../components/layout/PatientScreen';
import { AppText, BigActionButton, Card, DoseStatusBadge, EmptyState, ErrorState, LoadingSkeleton, PillVisual, RefreshFailedBanner } from '../../components/ui';
import { services } from '../../services';
import { useAppStore } from '../../store/appStore';
import { firstName, formatLongDate, formatTime, greeting } from '../../lib/date';
import { liveAt } from '../../lib/doseLive';
import { appTodayKey } from '../../lib/serverClock';
import { useQuery } from '../../lib/useQuery';
import { minuteStamp, useNow } from '../../lib/useNow';
import { useRefreshOnFocus } from '../../lib/useScreenActivity';
import { radius, spacing, useTheme } from '../../theme';
import { PatientDoseRow } from './PatientDoseRow';
import { pickNextDose } from './nextDose';

/** T10 — Início do paciente: próxima dose, botão gigante e o dia de hoje. */
export function PatientHomeScreen({ navigation }: RootScreenProps<'PatientHome'>) {
  const { colors } = useTheme();
  const patientId = useAppStore((s) => s.patientSession?.patientId ?? '');
  const now = useNow();
  const today = appTodayKey(now);
  const silentKey = minuteStamp(now);
  const profile = useQuery(['patient-profile', patientId], () => services.patients.getProfile(patientId));
  const doses = useQuery(['patient-day', patientId, today], () => services.doses.listForDay(patientId, today), { silentKey });
  // Contador de mensagens: ao voltar para esta tela (ex.: da conversa) e ao voltar ao app, sem atualização periódica
  const unread = useQuery(['patient-unread', patientId], () => services.messages.unreadCount(patientId, 'PACIENTE'));
  useRefreshOnFocus(unread.refresh);

  const caregiver = profile.data?.caregiverFirstName ?? 'quem cuida de você';
  // Status entre as atualizações: só compara agora com a janela que veio do servidor
  const list = (doses.data ?? []).map((d) => liveAt(d, now));
  const next = pickNextDose(list);
  const allDone = list.length > 0 && !next && list.every((d) => d.storedStatus !== 'PENDENTE' || d.status === 'NAO_TOMADA');

  return (
    <PatientScreen>
      <View>
        <AppText variant="patientDisplay" accessibilityRole="header">
          {greeting(now)}, {firstName(profile.data?.patient.name ?? '')}
        </AppText>
        <AppText variant="patientBody" muted>
          {formatLongDate(now)}
        </AppText>
      </View>

      {doses.refreshError ? <RefreshFailedBanner onRetry={doses.refresh} /> : null}

      {doses.loading || profile.loading ? (
        <LoadingSkeleton variant="patient" rows={2} />
      ) : doses.error || profile.error ? (
        <ErrorState error={doses.error ?? profile.error} onRetry={() => { doses.reload(); profile.reload(); }} />
      ) : list.length === 0 ? (
        <EmptyState icon={CalendarCheck} title="Hoje você não tem remédios" description={`Se tiver dúvida, fale com ${caregiver}.`} />
      ) : (
        <>
          {next ? (
            <Card style={[styles.next, { borderColor: colors.status[next.status].accent }]}>
              <AppText variant="patientStrong" muted>
                {next.status === 'ATRASADA' ? 'Remédio atrasado' : 'Próxima dose'}
              </AppText>
              <View style={styles.nextRow}>
                <PillVisual appearance={next.medication} size="xl" name={next.medication.name} />
                <View style={styles.flex}>
                  <AppText variant="patientTitle">{next.medication.name}</AppText>
                  <AppText variant="patientStrong">{next.medication.dosage}</AppText>
                  <AppText variant="patientBody" muted>
                    {next.doseQuantity} • {next.route}
                  </AppText>
                </View>
              </View>
              <View style={styles.timeRow}>
                <AppText variant="patientHuge" accessibilityLabel={`Horário: ${formatTime(next.scheduledAt)}`}>
                  {formatTime(next.scheduledAt)}
                </AppText>
                <DoseStatusBadge status={next.status} size="patient" />
              </View>
              {next.timeNote ? <AppText variant="patientBody">{next.timeNote}</AppText> : null}
              {next.confirmability === 'OK' ? (
                <BigActionButton
                  title="TOMAR REMÉDIO AGORA"
                  icon={Pill}
                  onPress={() => navigation.navigate('PatientConfirmDose', { doseId: next.id })}
                  accessibilityHint="Abre a confirmação. Depois é só tocar em Tomei o remédio."
                />
              ) : (
                <View style={[styles.wait, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                  <AppText variant="patientBody" align="center">
                    Ainda não é hora. Você poderá confirmar a partir das {formatTime(next.window.opensAt)}.
                  </AppText>
                </View>
              )}
            </Card>
          ) : allDone ? (
            <Card style={[styles.next, styles.center]}>
              <CheckCircle2 color={colors.status.CONFIRMADA_NO_HORARIO.fg} size={56} />
              <AppText variant="patientTitle" align="center">Pronto por hoje!</AppText>
              <AppText variant="patientBody" muted align="center">Não há mais remédios para tomar hoje.</AppText>
            </Card>
          ) : null}

          <AppText variant="patientTitle" accessibilityRole="header">
            Seu dia de hoje
          </AppText>
          <View style={styles.list}>
            {list.map((d) => (
              <PatientDoseRow key={d.id} dose={d} onPress={() => navigation.navigate('PatientConfirmDose', { doseId: d.id })} />
            ))}
          </View>
        </>
      )}

      <BigActionButton
        title={`VER MENSAGENS DA ${caregiver.toUpperCase()}`}
        subtitle={unread.data ? `${unread.data} ${unread.data === 1 ? 'mensagem nova' : 'mensagens novas'}` : undefined}
        icon={MessageCircle}
        variant="primary"
        onPress={() => navigation.navigate('PatientMessages')}
      />
    </PatientScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  next: { gap: spacing.md, borderWidth: 3, borderRadius: radius.xl },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm },
  wait: { borderWidth: 2, borderRadius: radius.lg, padding: spacing.lg },
  center: { alignItems: 'center' },
  list: { gap: spacing.md },
});
