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

export function ChatBubble({ message, mine, authorName, large }: Props) {
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
            borderColor: highContrast ? colors.border : colors.border,
            borderWidth: mine ? 0 : highContrast ? 2 : StyleSheet.hairlineWidth,
            borderBottomRightRadius: mine ? 4 : radius.lg,
            borderBottomLeftRadius: mine ? radius.lg : 4,
            maxWidth: large ? '90%' : '80%',
            padding: large ? spacing.lg : spacing.md,
          },
        ]}
      >
        <AppText variant={large ? 'elderBody' : 'body'} color={fg}>
          {message.text}
        </AppText>
        <AppText variant={large ? 'elderBody' : 'caption'} color={fg} style={[styles.time, { opacity: mine ? 0.85 : 0.75 }]}>
          {time}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  bubble: { borderRadius: radius.lg, gap: 2 },
  time: { alignSelf: 'flex-end' },
});
