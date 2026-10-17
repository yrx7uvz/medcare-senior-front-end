import { MessageCircle } from 'lucide-react-native';
import { useEffect } from 'react';
import { FlatList, KeyboardAvoidingView, Pressable, StyleSheet, View } from 'react-native';
import type { TabScreenProps } from '../../app/navigation/types';
import { CaregiverScreen } from '../../components/layout/CaregiverScreen';
import { AppText, Avatar, ChatThread, EmptyState, ErrorState, LoadingSkeleton } from '../../components/ui';
import { services } from '../../services';
import { useAppStore } from '../../store/appStore';
import { firstName, formatDayHeader, formatTime, toDateKey } from '../../lib/date';
import { useMutation, useQuery } from '../../lib/useQuery';
import { useNow } from '../../lib/useNow';
import { cardShadow, radius, spacing, useTheme } from '../../theme';

/** T09 — Mensagens do cuidador. "Todos" mostra a lista de conversas por idoso. */
export function CaregiverMessagesScreen(_: TabScreenProps<'Mensagens'>) {
  const filter = useAppStore((s) => s.selectedElderId);
  return (
    <CaregiverScreen title="Mensagens" subtitle={filter === 'ALL' ? 'Conversas por paciente' : undefined} withElderSwitcher>
      {filter === 'ALL' ? <ConversationList /> : <Conversation elderId={filter} />}
    </CaregiverScreen>
  );
}

function ConversationList() {
  const { colors, mode } = useTheme();
  const setSelected = useAppStore((s) => s.setSelectedElder);
  const now = useNow();
  const q = useQuery(['conversations'], () => services.messages.listConversations());
  if (q.loading) return <View style={styles.pad}><LoadingSkeleton rows={2} /></View>;
  if (q.error) return <ErrorState error={q.error} onRetry={q.reload} />;
  return (
    <FlatList
      data={q.data}
      keyExtractor={(c) => c.elder.id}
      contentContainerStyle={styles.list}
      ListEmptyComponent={<EmptyState icon={MessageCircle} title="Nenhuma conversa" description="Cadastre um paciente para trocar mensagens." />}
      renderItem={({ item }) => {
        const last = item.lastMessage;
        const when = last ? (last.sentAt.slice(0, 10) === toDateKey(now) ? formatTime(last.sentAt) : formatDayHeader(last.sentAt.slice(0, 10), toDateKey(now))) : '';
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Conversa com ${item.elder.name}. ${item.unread ? `${item.unread} não lidas. ` : ''}${last ? `Última mensagem: ${last.text}` : 'Sem mensagens'}`}
            onPress={() => setSelected(item.elder.id)}
            style={({ pressed }) => [styles.row, cardShadow(mode === 'dark'), { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
          >
            <Avatar name={item.elder.name} color={item.elder.avatarColor} size={44} />
            <View style={styles.flex}>
              <View style={styles.rowTop}>
                <AppText variant="heading" style={styles.flex} numberOfLines={1}>{item.elder.name}</AppText>
                <AppText variant="caption" muted>{when}</AppText>
              </View>
              <AppText variant="body" muted numberOfLines={1}>
                {last ? `${last.from === 'CUIDADOR' ? 'Você: ' : ''}${last.text}` : 'Sem mensagens ainda'}
              </AppText>
            </View>
            {item.unread ? (
              <View style={[styles.unread, { backgroundColor: colors.primary }]}>
                <AppText variant="caption" color={colors.onPrimary} style={styles.bold}>{item.unread}</AppText>
              </View>
            ) : null}
          </Pressable>
        );
      }}
    />
  );
}

function Conversation({ elderId }: { elderId: string }) {
  const now = useNow();
  const thread = useQuery(['thread', elderId], () => services.messages.listThread(elderId), { silentKey: Math.floor(now.getTime() / 20_000) });
  const elder = useQuery(['elder', elderId], () => services.elders.get(elderId));
  const send = useMutation((text: string) => services.messages.send(elderId, 'CUIDADOR', text));

  useEffect(() => {
    if (thread.data?.some((m) => m.from === 'IDOSO' && !m.read)) services.messages.markRead(elderId, 'CUIDADOR').catch(() => undefined);
  }, [thread.data, elderId]);

  if (thread.loading) return <View style={styles.pad}><LoadingSkeleton rows={3} /></View>;
  if (thread.error) return <ErrorState error={thread.error} onRetry={thread.reload} />;
  return (
    <KeyboardAvoidingView style={styles.flex}>
      <ChatThread
        messages={thread.data ?? []}
        viewer="CUIDADOR"
        otherName={firstName(elder.data?.name ?? 'Paciente')}
        todayKey={toDateKey(now)}
        sending={send.loading}
        onSend={async (text) => !!(await send.mutate(text))}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: { padding: spacing.lg },
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, minHeight: 72 },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  unread: { minWidth: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  bold: { fontFamily: 'NunitoSans_700Bold' },
});
