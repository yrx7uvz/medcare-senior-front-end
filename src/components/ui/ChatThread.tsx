import { Send } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { Message, MessageAuthor } from '../../types/domain';
import { formatDayHeader } from '../../lib/date';
import { fonts, radius, spacing, useTheme } from '../../theme';
import { AppText } from './AppText';
import { ChatBubble } from './ChatBubble';
import { Chip } from './Chip';

interface Props {
  messages: Message[];
  viewer: MessageAuthor;
  otherName: string;
  todayKey: string;
  onSend: (text: string) => Promise<boolean>;
  sending?: boolean;
  large?: boolean;
  quickReplies?: string[];
}

/** Conversa com bolhas, separadores por dia e envio bloqueado para texto vazio. */
export function ChatThread({ messages, viewer, otherName, todayKey, onSend, sending, large, quickReplies }: Props) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const empty = text.trim().length === 0;

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [messages.length]);

  async function send(value: string) {
    if (!value.trim()) {
      setError('Escreva uma mensagem antes de enviar.');
      return;
    }
    setError(null);
    const ok = await onSend(value);
    if (ok) setText('');
  }

  let lastDay = '';
  return (
    <View style={styles.flex}>
      <ScrollView ref={scrollRef} contentContainerStyle={[styles.list, { gap: large ? spacing.md : spacing.sm }]}>
        {messages.length === 0 ? (
          <AppText variant={large ? 'elderBody' : 'body'} muted align="center" style={styles.emptyText}>
            Nenhuma mensagem ainda. Escreva a primeira.
          </AppText>
        ) : null}
        {messages.map((m) => {
          const day = m.sentAt.slice(0, 10);
          const header = day !== lastDay ? formatDayHeader(day, todayKey) : null;
          lastDay = day;
          return (
            <View key={m.id} style={{ gap: spacing.sm }}>
              {header ? (
                <AppText variant={large ? 'elderBody' : 'caption'} muted align="center" accessibilityRole="header">
                  {header}
                </AppText>
              ) : null}
              <ChatBubble message={m} mine={m.from === viewer} authorName={otherName} large={large} />
            </View>
          );
        })}
      </ScrollView>

      {quickReplies?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quick}>
          {quickReplies.map((q) => (
            <Chip key={q} label={q} onPress={() => send(q)} accessibilityLabel={`Enviar resposta rápida: ${q}`} />
          ))}
        </ScrollView>
      ) : null}

      <View style={[styles.composer, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
        <View style={styles.flex}>
          <TextInput
            value={text}
            onChangeText={(t) => {
              setText(t);
              if (error) setError(null);
            }}
            placeholder="Escreva sua mensagem"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={`Mensagem para ${otherName}`}
            multiline
            maxLength={500}
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: error ? colors.danger : colors.border,
                backgroundColor: colors.inputBackground,
                fontSize: large ? 22 : 16,
                minHeight: large ? 64 : 48,
                fontFamily: fonts.body,
              },
            ]}
          />
          {error ? (
            <AppText variant={large ? 'elderBody' : 'caption'} color={colors.danger} accessibilityLiveRegion="polite">
              {error}
            </AppText>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enviar mensagem"
          accessibilityState={{ disabled: empty || !!sending }}
          disabled={empty || sending}
          onPress={() => send(text)}
          style={({ pressed }) => [
            styles.send,
            {
              width: large ? 64 : 48,
              height: large ? 64 : 48,
              backgroundColor: empty ? colors.skeleton : colors.primary,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Send color={empty ? colors.textMuted : colors.onPrimary} size={large ? 28 : 22} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: spacing.lg, flexGrow: 1 },
  emptyText: { marginTop: spacing.xxl },
  quick: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  input: { borderWidth: 1.5, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, maxHeight: 140 },
  send: { borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
