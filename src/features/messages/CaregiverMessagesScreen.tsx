import MessageCircle from 'lucide-react-native/icons/message-circle';
import { FlatList, KeyboardAvoidingView, Pressable, StyleSheet, View } from 'react-native';
import type { TabScreenProps } from '../../app/navigation/types';
import { CaregiverScreen } from '../../components/layout/CaregiverScreen';
import { AppText, Avatar, ChatThread, EmptyState, ErrorState, LoadingSkeleton } from '../../components/ui';
import { services } from '../../services';
import { useAppStore } from '../../store/appStore';
import { firstName, formatDayHeader, formatTime } from '../../lib/date';
import { MESSAGE_POLL_MS, unreadBadge } from '../../lib/messages';
import { appTodayKey } from '../../lib/serverClock';
import { useMessageThread } from '../../lib/useMessageThread';
import { useQuery } from '../../lib/useQuery';
import { useNow } from '../../lib/useNow';
import { usePolling, useScreenActive } from '../../lib/useScreenActivity';
import { cardShadow, radius, spacing, useTheme } from '../../theme';

/**
 * Mensagens do cuidador (UC-010). "Todos" mostra a lista de conversas por paciente; um paciente, a conversa. Atualiza
 * sozinha só enquanto esta tela está visível.
 */
export function CaregiverMessagesScreen(_: TabScreenProps<'Mensagens'>) {
  const filter = useAppStore((s) => s.selectedPatientId);
  return (
    <CaregiverScreen title="Mensagens" subtitle={filter === 'ALL' ? 'Conversas por paciente' : undefined} withPatientSwitcher>
      {filter === 'ALL' ? <ConversationList /> : <Conversation patientId={filter} />}
    </CaregiverScreen>
  );
}

function ConversationList() {
  const { colors, mode } = useTheme();
  const setSelected = useAppStore((s) => s.setSelectedPatient);
  const now = useNow();
  const today = appTodayKey(now);
  const active = useScreenActive();
  const q = useQuery(['conversations'], () => services.messages.listConversations());
  usePolling(q.refresh, MESSAGE_POLL_MS, active && q.data !== undefined);
  if (q.loading) return <View style={styles.pad}><LoadingSkeleton rows={2} /></View>;
  if (q.error) return <ErrorState error={q.error} onRetry={q.reload} />;
  return (
    <FlatList
      data={q.data}
      keyExtractor={(c) => c.patient.id}
      contentContainerStyle={styles.list}
      ListEmptyComponent={<EmptyState icon={MessageCircle} title="Nenhuma conversa" description="Cadastre um paciente para trocar mensagens." />}
      renderItem={({ item }) => {
        const last = item.lastMessage;
        const when = last ? (last.sentAt.slice(0, 10) === today ? formatTime(last.sentAt) : formatDayHeader(last.sentAt.slice(0, 10), today)) : '';
        const badge = unreadBadge(item.unread);
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Conversa com ${item.patient.name}. ${item.unread ? `${item.unread} não lidas. ` : ''}${last ? `Última mensagem: ${last.text}` : 'Sem mensagens'}`}
            onPress={() => setSelected(item.patient.id)}
            style={({ pressed }) => [styles.row, cardShadow(mode === 'dark'), { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
          >
            <Avatar name={item.patient.name} color={item.patient.avatarColor} size={44} />
            <View style={styles.flex}>
              <View style={styles.rowTop}>
                <AppText variant="heading" style={styles.flex} numberOfLines={1}>{item.patient.name}</AppText>
                <AppText variant="caption" muted>{when}</AppText>
              </View>
              <AppText variant="body" muted numberOfLines={1}>
                {last ? `${last.from === 'CUIDADOR' ? 'Você: ' : ''}${last.text}` : 'Sem mensagens ainda'}
              </AppText>
            </View>
            {badge ? (
              <View style={[styles.unread, { backgroundColor: colors.primary }]}>
                <AppText variant="caption" color={colors.onPrimary} style={styles.bold}>{badge}</AppText>
              </View>
            ) : null}
          </Pressable>
        );
      }}
    />
  );
}

function Conversation({ patientId }: { patientId: string }) {
  const now = useNow();
  const thread = useMessageThread(patientId, 'CUIDADOR');
  const patient = useQuery(['patient', patientId], () => services.patients.get(patientId));

  if (thread.loading) return <View style={styles.pad}><LoadingSkeleton rows={3} /></View>;
  if (thread.error) return <ErrorState error={thread.error} onRetry={thread.reload} />;
  return (
    <KeyboardAvoidingView style={styles.flex}>
      <ChatThread
        messages={thread.messages}
        viewer="CUIDADOR"
        otherName={firstName(patient.data?.name ?? 'Paciente')}
        todayKey={appTodayKey(now)}
        sending={thread.sending}
        sendError={thread.sendError}
        onSend={thread.send}
        hasOlder={thread.hasOlder}
        loadingOlder={thread.loadingOlder}
        olderError={thread.olderError?.message}
        onLoadOlder={thread.loadOlder}
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
