import { Send } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { Message, MessageAuthor } from '../../types/domain';
import { formatDayHeader } from '../../lib/date';
import { MESSAGE_MAX_LENGTH, messageCounter, messageError, messageLength } from '../../lib/messages';
import { fonts, radius, spacing, useTheme } from '../../theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { ChatBubble } from './ChatBubble';
import { Chip } from './Chip';

interface Props {
  /** Da mais antiga para a mais nova. */
  messages: Message[];
  viewer: MessageAuthor;
  otherName: string;
  todayKey: string;
  /** Devolve se deu certo (o texto só é apagado nesse caso). */
  onSend: (text: string) => Promise<boolean>;
  sending?: boolean;
  /** Erro do último envio (mensagem já traduzida). */
  sendError?: string | null;
  large?: boolean;
  quickReplies?: string[];
  hasOlder?: boolean;
  loadingOlder?: boolean;
  olderError?: string | null;
  onLoadOlder?: () => void;
}

/**
 * Conversa com bolhas, separadores por dia, mensagens anteriores sob pedido e envio com a mesma regra da API (1 a 500
 * caracteres, sem só espaços). O botão fica desligado enquanto envia.
 */
export function ChatThread({
  messages,
  viewer,
  otherName,
  todayKey,
  onSend,
  sending,
  sendError,
  large,
  quickReplies,
  hasOlder,
  loadingOlder,
  olderError,
  onLoadOlder,
}: Props) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const empty = messageLength(text) === 0;
  const tooLong = messageLength(text) > MESSAGE_MAX_LENGTH;
  const lastId = messages[messages.length - 1]?.id;

  // Só rola para o fim quando chega mensagem nova (carregar as anteriores não mexe na posição)
  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [lastId]);

  async function send(value: string) {
    const problem = messageError(value);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    const ok = await onSend(value.trim());
    if (ok) setText('');
  }

  const shownError = error ?? sendError ?? null;

  return (
    <View style={styles.flex}>
      <ScrollView ref={scrollRef} contentContainerStyle={[styles.list, { gap: large ? spacing.md : spacing.sm }]}>
        {hasOlder || olderError ? (
          <View style={styles.older}>
            {olderError ? (
              <AppText variant={large ? 'elderBody' : 'caption'} color={colors.danger} align="center" accessibilityRole="alert">
                {olderError}
              </AppText>
            ) : null}
            <Button
              title="Mensagens anteriores"
              variant="ghost"
              size={large ? 'lg' : 'md'}
              loading={loadingOlder}
              disabled={loadingOlder}
              onPress={onLoadOlder}
            />
          </View>
        ) : null}
        {messages.length === 0 ? (
          <AppText variant={large ? 'elderBody' : 'body'} muted align="center" style={styles.emptyText}>
            Nenhuma mensagem ainda. Escreva a primeira.
          </AppText>
        ) : null}
        {messages.map((m, i) => {
          const day = m.sentAt.slice(0, 10);
          const header = i === 0 || messages[i - 1].sentAt.slice(0, 10) !== day ? formatDayHeader(day, todayKey) : null;
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
            <Chip key={q} label={q} disabled={sending} onPress={() => send(q)} accessibilityLabel={`Enviar resposta rápida: ${q}`} />
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
            accessibilityHint={`Até ${MESSAGE_MAX_LENGTH} caracteres`}
            multiline
            maxLength={MESSAGE_MAX_LENGTH}
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: shownError || tooLong ? colors.danger : colors.inputBorder,
                backgroundColor: colors.inputBackground,
                fontSize: large ? 22 : 16,
                minHeight: large ? 64 : 48,
                fontFamily: fonts.body,
              },
            ]}
          />
          <View style={styles.meta}>
            <View style={styles.flex}>
              {shownError ? (
                <AppText variant={large ? 'elderBody' : 'caption'} color={colors.danger} accessibilityLiveRegion="polite">
                  {shownError}
                </AppText>
              ) : null}
            </View>
            <AppText variant="caption" color={tooLong ? colors.danger : colors.textMuted} accessibilityLabel={`${messageLength(text)} de ${MESSAGE_MAX_LENGTH} caracteres`}>
              {messageCounter(text)}
            </AppText>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={sending ? 'Enviando mensagem' : 'Enviar mensagem'}
          accessibilityState={{ disabled: empty || tooLong || !!sending, busy: !!sending }}
          disabled={empty || tooLong || sending}
          onPress={() => send(text)}
          style={({ pressed }) => [
            styles.send,
            {
              width: large ? 64 : 48,
              height: large ? 64 : 48,
              backgroundColor: empty || tooLong || sending ? colors.skeleton : colors.primary,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Send color={empty || tooLong || sending ? colors.textMuted : colors.onPrimary} size={large ? 28 : 22} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: spacing.lg, flexGrow: 1 },
  older: { alignItems: 'center', gap: spacing.xs },
  emptyText: { marginTop: spacing.xxl },
  quick: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  input: { borderWidth: 1.5, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, maxHeight: 140 },
  meta: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: 2 },
  send: { borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
