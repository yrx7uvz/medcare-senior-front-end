import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Message } from '../../types/domain';
import { formatTime } from '../../lib/date';
import { radius, spacing, useTheme } from '../../theme';
import { AppText } from './AppText';

interface Props {
  message: Message;
  mine: boolean;
  authorName: string;
  large?: boolean;
}

/**
 * Memorizado pelo conteúdo: a conversa é consultada a cada 10 s e cada consulta traz objetos novos; só os balões que
 * mudaram (texto, horário ou lida) são redesenhados.
 */
export const ChatBubble = memo(function ChatBubble({ message, mine, authorName, large }: Props) {
  const { colors, highContrast } = useTheme();
  const bg = mine ? colors.primary : colors.surface;
  const fg = mine ? colors.onPrimary : colors.text;
  const time = formatTime(message.sentAt);
  return (
    <View
      accessible
      accessibilityLabel={`${mine ? 'Você' : authorName}, às ${time}: ${message.text}`}
      style={[styles.row, { justifyContent: mine ? 'flex-end' : 'flex-start' }]}
    >
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: bg,
            borderColor: colors.border,
            borderWidth: mine ? 0 : highContrast ? 2 : StyleSheet.hairlineWidth,
            borderBottomRightRadius: mine ? 4 : radius.lg,
            borderBottomLeftRadius: mine ? radius.lg : 4,
            maxWidth: large ? '90%' : '80%',
            padding: large ? spacing.lg : spacing.md,
          },
        ]}
      >
        <AppText variant={large ? 'patientBody' : 'body'} color={fg}>
          {message.text}
        </AppText>
        <AppText variant={large ? 'patientBody' : 'caption'} color={fg} style={[styles.time, { opacity: mine ? 0.85 : 0.75 }]}>
          {time}
        </AppText>
      </View>
    </View>
  );
}, mesmoBalao);

function mesmoBalao(a: Props, b: Props): boolean {
  return a.mine === b.mine && a.authorName === b.authorName && a.large === b.large && a.message.id === b.message.id
    && a.message.text === b.message.text && a.message.sentAt === b.message.sentAt && a.message.read === b.message.read;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  bubble: { borderRadius: radius.lg, gap: 2 },
  time: { alignSelf: 'flex-end' },
});
