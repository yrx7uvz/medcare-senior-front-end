import { KeyboardAvoidingView, StyleSheet, View } from 'react-native';
import type { RootScreenProps } from '../../app/navigation/types';
import { ElderScreen } from '../../components/layout/ElderScreen';
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
 * T13 — Mensagens do idoso (UC-010): só a conversa dele, bolhas e letra grandes, botão de enviar de 64 dp e respostas
 * rápidas. Atualiza sozinha só enquanto esta tela está visível.
 */
export function ElderMessagesScreen(_: RootScreenProps<'ElderMessages'>) {
  const elderId = useAppStore((s) => s.elderSession?.elderId ?? '');
  const now = useNow();
  const profile = useQuery(['elder-profile', elderId], () => services.elders.getProfile(elderId));
  const thread = useMessageThread(elderId, 'IDOSO');
  const caregiver = profile.data?.caregiverFirstName ?? 'Cuidador';

  return (
    <ElderScreen back scroll={false}>
      <View style={styles.head}>
        <AppText variant="elderDisplay" accessibilityRole="header">Mensagens de {caregiver}</AppText>
      </View>
      {thread.loading ? (
        <View style={styles.pad}><LoadingSkeleton variant="elder" rows={2} /></View>
      ) : thread.error ? (
        <ErrorState error={thread.error} onRetry={thread.reload} />
      ) : (
        <KeyboardAvoidingView style={styles.flex}>
          <ChatThread
            large
            messages={thread.messages}
            viewer="IDOSO"
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
    </ElderScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { paddingHorizontal: spacing.lg },
  pad: { padding: spacing.lg },
});
