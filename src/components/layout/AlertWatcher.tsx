import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import BellRing from 'lucide-react-native/icons/bell-ring';
import { useEffect, useMemo } from 'react';
import type { RootNavigation } from '../../app/navigation/types';
import { services } from '../../services';
import { useAppStore } from '../../store/appStore';
import { useQuery } from '../../lib/useQuery';
import { minuteStamp, useNow } from '../../lib/useNow';
import { AppText, ConfirmDialog } from '../ui';
import { alertMessage } from './AlertBanner';

/**
 * Simula o push (FCM) que o cuidador recebe quando uma dose passa da
 * tolerância: um modal por alerta novo, uma única vez.
 */
export function AlertWatcher() {
  const navigation = useNavigation<RootNavigation>();
  const notifyEnabled = useAppStore((s) => s.notificationPrefs.missedDose);
  const seen = useAppStore((s) => s.seenAlertIds);
  const markSeen = useAppStore((s) => s.markAlertsSeen);
  const now = useNow(10_000);
  const alerts = useQuery(['alerts-watch'], () => services.doses.listAlerts(), { silentKey: minuteStamp(now) });

  const fresh = useMemo(
    () => (alerts.data ?? []).find((a) => !seen.includes(`${a.doseId}:${a.status}`)),
    [alerts.data, seen],
  );

  useEffect(() => {
    if (fresh && notifyEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
  }, [fresh, notifyEnabled]);

  if (!fresh || !notifyEnabled) return null;
  const key = `${fresh.doseId}:${fresh.status}`;

  return (
    <ConfirmDialog
      visible
      icon={BellRing}
      tone="danger"
      title={`Dose não confirmada — ${fresh.patientName}`}
      message={
        <>
          <AppText>{alertMessage(fresh)}</AppText>
          <AppText variant="caption" muted>
            Notificação simulada. No app real ela chega por push.
          </AppText>
        </>
      }
      confirmLabel="Ver detalhes"
      cancelLabel="Fechar"
      onConfirm={() => {
        markSeen([key]);
        navigation.navigate('DoseDetail', { doseId: fresh.doseId });
      }}
      onCancel={() => markSeen([key])}
    />
  );
}
