import { useEffect } from 'react';
import { KeyboardAvoidingView, StyleSheet, View } from 'react-native';
import type { RootScreenProps } from '../../app/navigation/types';
import { ElderScreen } from '../../components/layout/ElderScreen';
import { AppText, ChatThread, ErrorState, LoadingSkeleton } from '../../components/ui';
import { services } from '../../services';
import { useAppStore } from '../../store/appStore';
import { toDateKey } from '../../lib/date';
import { useMutation, useQuery } from '../../lib/useQuery';
import { useNow } from '../../lib/useNow';
import { spacing } from '../../theme';

const QUICK_REPLIES = ['Já tomei, obrigado', 'Estou bem', 'Pode me ligar?'];

/** T13 — Mensagens do idoso: bolhas grandes e respostas rápidas. */
export function ElderMessagesScreen(_: RootScreenProps<'ElderMessages'>) {
  const elderId = useAppStore((s) => s.elderSession?.elderId ?? '');
  const now = useNow();
  const profile = useQuery(['elder-profile', elderId], () => services.elders.getProfile(elderId));
  const thread = useQuery(['thread', elderId], () => services.messages.listThread(elderId), { silentKey: Math.floor(now.getTime() / 20_000) });
  const send = useMutation((text: string) => services.messages.send(elderId, 'IDOSO', text));
  const caregiver = profile.data?.caregiverFirstName ?? 'Cuidador';

  useEffect(() => {
    if (thread.data?.some((m) => m.from === 'CUIDADOR' && !m.read)) services.messages.markRead(elderId, 'IDOSO').catch(() => undefined);
  }, [thread.data, elderId]);

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
            messages={thread.data ?? []}
            viewer="IDOSO"
            otherName={caregiver}
            todayKey={toDateKey(now)}
            sending={send.loading}
            quickReplies={QUICK_REPLIES}
            onSend={async (text) => !!(await send.mutate(text))}
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
