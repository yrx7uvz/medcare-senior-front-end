import * as Haptics from 'expo-haptics';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import CheckCircle2 from 'lucide-react-native/icons/circle-check';
import Clock from 'lucide-react-native/icons/clock';
import Lock from 'lucide-react-native/icons/lock';
import { StyleSheet, View } from 'react-native';
import type { RootScreenProps } from '../../app/navigation/types';
import { PatientScreen } from '../../components/layout/PatientScreen';
import { AppText, BigActionButton, Card, DoseStatusBadge, ErrorState, LoadingSkeleton, PillSizeLegend, PillVisual } from '../../components/ui';
import { services } from '../../services';
import { useAppStore } from '../../store/appStore';
import { formatTime } from '../../lib/date';
import { liveAt } from '../../lib/doseLive';
import { useMutation, useQuery } from '../../lib/useQuery';
import { minuteStamp, useNow } from '../../lib/useNow';
import { radius, spacing, useTheme } from '../../theme';

/** Confirmação da dose pelo paciente: liberada de 60 min antes do horário até o limite de confirmação vindo do servidor. */
export function ConfirmDoseScreen({ route, navigation }: RootScreenProps<'PatientConfirmDose'>) {
  const { colors } = useTheme();
  const patientId = useAppStore((s) => s.patientSession?.patientId ?? '');
  const now = useNow(10_000);
  const { doseId } = route.params;
  const dose = useQuery(['dose', doseId], () => services.doses.get(doseId), { silentKey: minuteStamp(now) });
  const profile = useQuery(['patient-profile', patientId], () => services.patients.getProfile(patientId));
  const confirm = useMutation(services.doses.confirm);
  const caregiver = profile.data?.caregiverFirstName ?? 'quem cuida de você';
  // Confirmabilidade entre as atualizações: só compara agora com a janela que veio do servidor
  const d = dose.data ? liveAt(dose.data, now) : undefined;

  async function onConfirm() {
    const result = await confirm.mutate(doseId);
    if (result) {
      navigation.replace('PatientDoseConfirmed', { doseId });
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    // 409 (já registrada, cedo ou encerrada): busca a versão atual para a tela mostrar o estado certo
    dose.refresh();
  }

  if (dose.loading) {
    return (
      <PatientScreen back>
        <LoadingSkeleton variant="patient" rows={1} />
      </PatientScreen>
    );
  }
  if (dose.error || !d) {
    return (
      <PatientScreen back>
        <ErrorState error={dose.error} onRetry={dose.reload} />
      </PatientScreen>
    );
  }

  const m = d.medication;
  const canConfirm = d.confirmability === 'OK';
  let message: { icon: typeof Clock; text: string; tone: 'info' | 'warn' | 'lock' } | null = null;
  if (d.confirmability === 'JA_REGISTRADA') {
    message = {
      icon: Lock,
      tone: 'lock',
      text: d.confirmedAt ? `Você já confirmou este remédio às ${formatTime(d.confirmedAt)}.` : 'O prazo desta dose já terminou e ela foi registrada como não confirmada.',
    };
  } else if (d.confirmability === 'MUITO_CEDO') {
    message = { icon: Clock, tone: 'info', text: `Ainda é cedo. Você poderá confirmar a partir das ${formatTime(d.window.opensAt)}.` };
  } else if (d.confirmability === 'ENCERRADA') {
    message = { icon: Lock, tone: 'lock', text: `O prazo desta dose terminou às ${formatTime(d.confirmUntil)}. Fale com ${caregiver}.` };
  } else if (d.status === 'ATRASADA') {
    message = {
      icon: Clock,
      tone: 'warn',
      text: `Este remédio está atrasado e ${caregiver} já recebeu o aviso. Você ainda pode confirmar até ${formatTime(d.confirmUntil)}.`,
    };
  } else {
    message = {
      icon: Clock,
      tone: 'info',
      text: `Se você não confirmar em até ${d.toleranceMinutes} minutos, ${caregiver} recebe um aviso automaticamente.`,
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
    <PatientScreen
      back
      footer={
        <>
          {confirm.error ? (
            <AppText variant="patientBody" color={colors.danger} align="center" accessibilityRole="alert">
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
        <PillSizeLegend appearance={m} doseQuantity={d.doseQuantity} patient />
      </View>
      <View style={styles.center}>
        <AppText variant="patientDisplay" align="center">{m.name}</AppText>
        <AppText variant="patientTitle" align="center">{m.dosage}</AppText>
        <AppText variant="patientBody" muted align="center">
          Tome {d.doseQuantity} • {d.route}
        </AppText>
      </View>
      <Card style={styles.timeCard}>
        <View style={styles.flex}>
          <AppText variant="patientBody" muted>Horário</AppText>
          <AppText variant="patientHuge">{formatTime(d.scheduledAt)}</AppText>
        </View>
        <DoseStatusBadge status={d.status} size="patient" />
      </Card>
      {d.timeNote ? <AppText variant="patientStrong" align="center">{d.timeNote}</AppText> : null}
      <View style={[styles.message, { backgroundColor: msgColors.bg }]} accessibilityLiveRegion="polite">
        <MsgIcon color={msgColors.fg} size={28} />
        <AppText variant="patientBody" color={msgColors.fg} style={styles.flex}>
          {message.text}
        </AppText>
      </View>
    </PatientScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', gap: spacing.sm },
  timeCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  message: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', borderRadius: radius.lg, padding: spacing.lg },
});
