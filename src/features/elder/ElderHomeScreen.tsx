import { CalendarCheck, CheckCircle2, MessageCircle, Pill } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import type { RootScreenProps } from '../../app/navigation/types';
import { ElderScreen } from '../../components/layout/ElderScreen';
import { AppText, BigActionButton, Card, DoseStatusBadge, EmptyState, ErrorState, LoadingSkeleton, PillVisual, RefreshFailedBanner } from '../../components/ui';
import { services } from '../../services';
import { useAppStore } from '../../store/appStore';
import { firstName, formatLongDate, formatTime, greeting } from '../../lib/date';
import { liveAt } from '../../lib/doseLive';
import { appTodayKey } from '../../lib/serverClock';
import { useQuery } from '../../lib/useQuery';
import { minuteStamp, useNow } from '../../lib/useNow';
import { radius, spacing, useTheme } from '../../theme';
import { ElderDoseRow } from './ElderDoseRow';
import { pickNextDose } from './nextDose';

/** T10 — Início do idoso: próxima dose, botão gigante e o dia de hoje. */
export function ElderHomeScreen({ navigation }: RootScreenProps<'ElderHome'>) {
  const { colors } = useTheme();
  const elderId = useAppStore((s) => s.elderSession?.elderId ?? '');
  const now = useNow();
  const today = appTodayKey(now);
  const silentKey = minuteStamp(now);
  const profile = useQuery(['elder-profile', elderId], () => services.elders.getProfile(elderId));
  const doses = useQuery(['elder-day', elderId, today], () => services.doses.listForDay(elderId, today), { silentKey });
  const unread = useQuery(['elder-unread', elderId], () => services.messages.unreadCount(elderId, 'IDOSO'), { silentKey });

  const caregiver = profile.data?.caregiverFirstName ?? 'cuidador';
  // Status entre as atualizações: só compara agora com a janela que veio do servidor (FE-21)
  const list = (doses.data ?? []).map((d) => liveAt(d, now));
  const next = pickNextDose(list);
  const allDone = list.length > 0 && !next && list.every((d) => d.storedStatus !== 'PENDENTE' || d.status === 'NAO_TOMADA');

  return (
    <ElderScreen>
      <View>
        <AppText variant="elderDisplay" accessibilityRole="header">
          {greeting(now)}, {firstName(profile.data?.elder.name ?? '')}
        </AppText>
        <AppText variant="elderBody" muted>
          {formatLongDate(now)}
        </AppText>
      </View>

      {doses.refreshError ? <RefreshFailedBanner onRetry={doses.refresh} /> : null}

      {doses.loading || profile.loading ? (
        <LoadingSkeleton variant="elder" rows={2} />
      ) : doses.error || profile.error ? (
        <ErrorState error={doses.error ?? profile.error} onRetry={() => { doses.reload(); profile.reload(); }} />
      ) : list.length === 0 ? (
        <EmptyState icon={CalendarCheck} title="Hoje você não tem remédios" description={`Se tiver dúvida, fale com ${caregiver}.`} />
      ) : (
        <>
          {next ? (
            <Card style={[styles.next, { borderColor: colors.status[next.status].accent }]}>
              <AppText variant="elderStrong" muted>
                {next.status === 'ATRASADA' ? 'Remédio atrasado' : 'Próxima dose'}
              </AppText>
              <View style={styles.nextRow}>
                <PillVisual appearance={next.medication} size="xl" name={next.medication.name} />
                <View style={styles.flex}>
                  <AppText variant="elderTitle">{next.medication.name}</AppText>
                  <AppText variant="elderStrong">{next.medication.dosage}</AppText>
                  <AppText variant="elderBody" muted>
                    {next.doseQuantity} • {next.route}
                  </AppText>
                </View>
              </View>
              <View style={styles.timeRow}>
                <AppText variant="elderHuge" accessibilityLabel={`Horário: ${formatTime(next.scheduledAt)}`}>
                  {formatTime(next.scheduledAt)}
                </AppText>
                <DoseStatusBadge status={next.status} size="elder" />
              </View>
              {next.timeNote ? <AppText variant="elderBody">{next.timeNote}</AppText> : null}
              {next.confirmability === 'OK' ? (
                <BigActionButton
                  title="TOMAR REMÉDIO AGORA"
                  icon={Pill}
                  onPress={() => navigation.navigate('ElderConfirmDose', { doseId: next.id })}
                  accessibilityHint="Abre a confirmação. Depois é só tocar em Tomei o remédio."
                />
              ) : (
                <View style={[styles.wait, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                  <AppText variant="elderBody" align="center">
                    Ainda não é hora. Você poderá confirmar a partir das {formatTime(next.window.opensAt)}.
                  </AppText>
                </View>
              )}
            </Card>
          ) : allDone ? (
            <Card style={[styles.next, styles.center]}>
              <CheckCircle2 color={colors.status.TOMADA.fg} size={56} />
              <AppText variant="elderTitle" align="center">Pronto por hoje!</AppText>
              <AppText variant="elderBody" muted align="center">Não há mais remédios para tomar hoje.</AppText>
            </Card>
          ) : null}

          <AppText variant="elderTitle" accessibilityRole="header">
            Seu dia de hoje
          </AppText>
          <View style={styles.list}>
            {list.map((d) => (
              <ElderDoseRow key={d.id} dose={d} onPress={() => navigation.navigate('ElderConfirmDose', { doseId: d.id })} />
            ))}
          </View>
        </>
      )}

      <BigActionButton
        title={`VER MENSAGENS DA ${caregiver.toUpperCase()}`}
        subtitle={unread.data ? `${unread.data} ${unread.data === 1 ? 'mensagem nova' : 'mensagens novas'}` : undefined}
        icon={MessageCircle}
        variant="primary"
        onPress={() => navigation.navigate('ElderMessages')}
      />
    </ElderScreen>
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
