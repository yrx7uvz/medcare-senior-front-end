import * as Haptics from 'expo-haptics';
import AlarmClockCheck from 'lucide-react-native/icons/alarm-clock-check';
import CheckCircle2 from 'lucide-react-native/icons/circle-check';
import Home from 'lucide-react-native/icons/house';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';
import type { RootScreenProps } from '../../app/navigation/types';
import { PatientScreen } from '../../components/layout/PatientScreen';
import { AppText, BigActionButton, Card, ErrorState, LoadingSkeleton, PillVisual } from '../../components/ui';
import { services } from '../../services';
import { useAppStore } from '../../store/appStore';
import { formatTime } from '../../lib/date';
import { appTodayKey } from '../../lib/serverClock';
import { useQuery } from '../../lib/useQuery';
import { useNow } from '../../lib/useNow';
import { spacing, useTheme } from '../../theme';
import { pickNextDose } from './nextDose';

/** T12 — Dose confirmada, com feedback tátil e anúncio por voz. */
export function DoseConfirmedScreen({ route, navigation }: RootScreenProps<'PatientDoseConfirmed'>) {
  const { colors } = useTheme();
  const patientId = useAppStore((s) => s.patientSession?.patientId ?? '');
  const now = useNow(60_000);
  const { doseId } = route.params;
  const dose = useQuery(['dose', doseId], () => services.doses.get(doseId));
  const today = appTodayKey(now);
  const day = useQuery(['patient-day', patientId, today], () => services.doses.listForDay(patientId, today));
  const profile = useQuery(['patient-profile', patientId], () => services.patients.getProfile(patientId));
  const [scale] = useState(() => new Animated.Value(0.6));
  const d = dose.data;
  const late = d?.status === 'CONFIRMADA_COM_ATRASO';
  const caregiver = profile.data?.caregiverFirstName ?? 'quem cuida de você';

  useEffect(() => {
    if (!d) return;
    // Feedback tátil + "som" simulado pelo anúncio do leitor de tela.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    AccessibilityInfo.announceForAccessibility(late ? 'Remédio confirmado com atraso' : 'Remédio confirmado');
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) scale.setValue(1);
      else Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
    });
  }, [d, late, scale]);

  if (dose.loading) {
    return (
      <PatientScreen>
        <LoadingSkeleton variant="patient" rows={1} />
      </PatientScreen>
    );
  }
  if (dose.error || !d) {
    return (
      <PatientScreen>
        <ErrorState error={dose.error} onRetry={dose.reload} />
      </PatientScreen>
    );
  }

  const next = pickNextDose(day.data ?? [], d.id);
  const accent = late ? colors.status.CONFIRMADA_COM_ATRASO : colors.status.CONFIRMADA_NO_HORARIO;
  const Icon = late ? AlarmClockCheck : CheckCircle2;

  return (
    <PatientScreen
      footer={<BigActionButton title="Voltar à tela inicial" icon={Home} variant="primary" onPress={() => navigation.popToTop()} />}
    >
      <View style={styles.center}>
        <Animated.View style={[styles.circle, { backgroundColor: accent.bg, borderColor: accent.accent, transform: [{ scale }] }]}>
          <Icon color={accent.fg} size={88} strokeWidth={2.4} />
        </Animated.View>
        <AppText variant="patientDisplay" align="center" accessibilityRole="header">
          {late ? 'Confirmado com atraso' : 'Remédio confirmado!'}
        </AppText>
        <AppText variant="patientStrong" align="center">
          {d.medication.name} {d.medication.dosage} confirmado às {d.confirmedAt ? formatTime(d.confirmedAt) : '--:--'}.
        </AppText>
        <AppText variant="patientBody" align="center" muted>
          {caregiver} já recebeu a confirmação.
        </AppText>
      </View>

      {next ? (
        <Card style={styles.next}>
          <AppText variant="patientStrong" muted>Próxima dose hoje</AppText>
          <View style={styles.row}>
            <PillVisual appearance={next.medication} size="lg" name={next.medication.name} />
            <View style={styles.flex}>
              <AppText variant="patientTitle">{next.medication.name}</AppText>
              <AppText variant="patientBody">{next.medication.dosage} • {next.doseQuantity}</AppText>
              <AppText variant="patientDisplay">{formatTime(next.scheduledAt)}</AppText>
            </View>
          </View>
        </Card>
      ) : (
        <Card style={styles.next}>
          <AppText variant="patientStrong" align="center">Você não tem mais remédios hoje.</AppText>
        </Card>
      )}
    </PatientScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.lg },
  circle: { width: 160, height: 160, borderRadius: 80, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  next: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
});
