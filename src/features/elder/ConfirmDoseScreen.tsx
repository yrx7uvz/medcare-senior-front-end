import * as Haptics from 'expo-haptics';
import { ArrowLeft, CheckCircle2, Clock, Lock } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import type { RootScreenProps } from '../../app/navigation/types';
import { ElderScreen } from '../../components/layout/ElderScreen';
import { AppText, BigActionButton, Card, DoseStatusBadge, ErrorState, LoadingSkeleton, PillSizeLegend, PillVisual } from '../../components/ui';
import { services } from '../../services';
import { useAppStore } from '../../store/appStore';
import { formatTime } from '../../lib/date';
import { liveAt } from '../../lib/doseLive';
import { useMutation, useQuery } from '../../lib/useQuery';
import { minuteStamp, useNow } from '../../lib/useNow';
import { radius, spacing, useTheme } from '../../theme';

/** T11 — Confirmar dose. Liberada de 60 min antes até o encerramento (RN14). */
export function ConfirmDoseScreen({ route, navigation }: RootScreenProps<'ElderConfirmDose'>) {
  const { colors } = useTheme();
  const elderId = useAppStore((s) => s.elderSession?.elderId ?? '');
  const now = useNow(10_000);
  const { doseId } = route.params;
  const dose = useQuery(['dose', doseId], () => services.doses.get(doseId), { silentKey: minuteStamp(now) });
  const profile = useQuery(['elder-profile', elderId], () => services.elders.getProfile(elderId));
  const confirm = useMutation(services.doses.confirm);
  const caregiver = profile.data?.caregiverFirstName ?? 'seu cuidador';
  // Confirmabilidade entre as atualizações: só compara agora com a janela que veio do servidor (FE-21)
  const d = dose.data ? liveAt(dose.data, now) : undefined;

  async function onConfirm() {
    const result = await confirm.mutate(doseId);
    if (result) {
      navigation.replace('ElderDoseConfirmed', { doseId });
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    // 409 (já registrada, cedo ou encerrada): busca a versão atual para a tela mostrar o estado certo
    dose.refresh();
  }

  if (dose.loading) {
    return (
      <ElderScreen back>
        <LoadingSkeleton variant="elder" rows={1} />
      </ElderScreen>
    );
  }
  if (dose.error || !d) {
    return (
      <ElderScreen back>
        <ErrorState error={dose.error} onRetry={dose.reload} />
      </ElderScreen>
    );
  }

  const m = d.medication;
  const canConfirm = d.confirmability === 'OK';
  let message: { icon: typeof Clock; text: string; tone: 'info' | 'warn' | 'lock' } | null = null;
  if (d.confirmability === 'JA_REGISTRADA') {
    message = {
      icon: Lock,
      tone: 'lock',
      text: d.confirmedAt ? `Você já confirmou este remédio às ${formatTime(d.confirmedAt)}.` : 'O prazo desta dose já terminou e ela foi registrada como não tomada.',
    };
  } else if (d.confirmability === 'MUITO_CEDO') {
    message = { icon: Clock, tone: 'info', text: `Ainda é cedo. Você poderá confirmar a partir das ${formatTime(d.window.opensAt)}.` };
  } else if (d.confirmability === 'ENCERRADA') {
    message = { icon: Lock, tone: 'lock', text: `O prazo desta dose terminou às ${formatTime(d.window.closesAt)}. Fale com ${caregiver}.` };
  } else if (d.status === 'ATRASADA') {
    message = {
      icon: Clock,
      tone: 'warn',
      text: `Este remédio está atrasado e ${caregiver} já foi avisada. Você ainda pode confirmar até ${formatTime(d.window.closesAt)}.`,
    };
  } else {
    message = {
      icon: Clock,
      tone: 'info',
      text: `Se você não confirmar em até ${d.toleranceMinutes} minutos, sua cuidadora ${caregiver} será avisada automaticamente.`,
    };
  }
  const MsgIcon = message.icon;
  const msgColors =
    message.tone === 'warn'
      ? { bg: colors.status.ATRASADA.bg, fg: colors.status.ATRASADA.fg }
      : message.tone === 'lock'
        ? { bg: colors.surfaceAlt, fg: colors.text }
        : { bg: colors.infoSoft, fg: colors.text };

  return (
    <ElderScreen
      back
      footer={
        <>
          {confirm.error ? (
            <AppText variant="elderBody" color={colors.danger} align="center" accessibilityRole="alert">
              {confirm.error.message}
            </AppText>
          ) : null}
          {d.confirmability !== 'JA_REGISTRADA' ? (
            <BigActionButton
              title="TOMEI O REMÉDIO"
              icon={CheckCircle2}
              disabled={!canConfirm}
              loading={confirm.loading}
              onPress={onConfirm}
              accessibilityHint={canConfirm ? 'Registra que você tomou este remédio agora' : message.text}
            />
          ) : null}
          <BigActionButton
            title={d.confirmability === 'JA_REGISTRADA' ? 'Voltar' : 'Ainda não tomei — Voltar'}
            icon={ArrowLeft}
            variant="outline"
            onPress={() => navigation.goBack()}
          />
        </>
      }
    >
      <View style={styles.center}>
        <PillVisual appearance={m} size="xl" name={m.name} />
        <PillSizeLegend appearance={m} doseQuantity={d.doseQuantity} elder />
      </View>
      <View style={styles.center}>
        <AppText variant="elderDisplay" align="center">{m.name}</AppText>
        <AppText variant="elderTitle" align="center">{m.dosage}</AppText>
        <AppText variant="elderBody" muted align="center">
          Tome {d.doseQuantity} • {d.route}
        </AppText>
      </View>
      <Card style={styles.timeCard}>
        <View style={styles.flex}>
          <AppText variant="elderBody" muted>Horário</AppText>
          <AppText variant="elderHuge">{formatTime(d.scheduledAt)}</AppText>
        </View>
        <DoseStatusBadge status={d.status} size="elder" />
      </Card>
      {d.timeNote ? <AppText variant="elderStrong" align="center">{d.timeNote}</AppText> : null}
      <View style={[styles.message, { backgroundColor: msgColors.bg }]} accessibilityLiveRegion="polite">
        <MsgIcon color={msgColors.fg} size={28} />
        <AppText variant="elderBody" color={msgColors.fg} style={styles.flex}>
          {message.text}
        </AppText>
      </View>
    </ElderScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', gap: spacing.sm },
  timeCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  message: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', borderRadius: radius.lg, padding: spacing.lg },
});
