import { KeyboardAvoidingView, StyleSheet, View } from 'react-native';
import type { RootScreenProps } from '../../app/navigation/types';
import { PatientScreen } from '../../components/layout/PatientScreen';
import { AppText, ChatThread, ErrorState, LoadingSkeleton } from '../../components/ui';
import { services } from '../../services';
import { useAppStore } from '../../store/appStore';
import { appTodayKey } from '../../lib/serverClock';
import { useMessageThread } from '../../lib/useMessageThread';
import { useQuery } from '../../lib/useQuery';
import { useNow } from '../../lib/useNow';
import { spacing } from '../../theme';

const QUICK_REPLIES = ['Já tomei, agradeço', 'Estou bem', 'Pode me ligar?'];

/**
 * T13 — Mensagens do paciente (UC-010): só a conversa dele, bolhas e letra grandes, botão de enviar de 64 dp e respostas
 * rápidas. Atualiza sozinha só enquanto esta tela está visível.
 */
export function PatientMessagesScreen(_: RootScreenProps<'PatientMessages'>) {
  const patientId = useAppStore((s) => s.patientSession?.patientId ?? '');
  const now = useNow();
  const profile = useQuery(['patient-profile', patientId], () => services.patients.getProfile(patientId));
  const thread = useMessageThread(patientId, 'PACIENTE');
  const caregiver = profile.data?.caregiverFirstName ?? 'Cuidador';

  return (
    <PatientScreen back scroll={false}>
      <View style={styles.head}>
        <AppText variant="patientDisplay" accessibilityRole="header">Mensagens de {caregiver}</AppText>
      </View>
      {thread.loading ? (
        <View style={styles.pad}><LoadingSkeleton variant="patient" rows={2} /></View>
      ) : thread.error ? (
        <ErrorState error={thread.error} onRetry={thread.reload} />
      ) : (
        <KeyboardAvoidingView style={styles.flex}>
          <ChatThread
            large
            messages={thread.messages}
            viewer="PACIENTE"
            otherName={caregiver}
            todayKey={appTodayKey(now)}
            sending={thread.sending}
            sendError={thread.sendError}
            quickReplies={QUICK_REPLIES}
            onSend={thread.send}
            hasOlder={thread.hasOlder}
            loadingOlder={thread.loadingOlder}
            olderError={thread.olderError?.message}
            onLoadOlder={thread.loadOlder}
          />
        </KeyboardAvoidingView>
      )}
    </PatientScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { paddingHorizontal: spacing.lg },
  pad: { padding: spacing.lg },
});
