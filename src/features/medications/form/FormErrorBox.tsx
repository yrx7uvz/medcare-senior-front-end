import { Info } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../../components/ui';
import type { AppError } from '../../../services/errors';
import { radius, spacing, useTheme } from '../../../theme';

type Tone = 'info' | 'warning' | 'danger';

/** Aviso em caixa colorida (informação, atenção ou erro), com ícone e texto. */
export function NoticeBox({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const { colors } = useTheme();
  const bg = tone === 'info' ? colors.infoSoft : tone === 'warning' ? colors.warningSoft : colors.dangerSoft;
  const fg = tone === 'info' ? colors.primaryDark : tone === 'warning' ? colors.warningText : colors.danger;
  return (
    <View style={[styles.notice, { backgroundColor: bg }]} accessibilityRole={tone === 'info' ? undefined : 'alert'}>
      <Info color={fg} size={18} />
      <View style={styles.flex}>{typeof children === 'string' ? <AppText variant="caption" color={fg}>{children}</AppText> : children}</View>
    </View>
  );
}

/** Erro do envio do formulário: a mensagem da API e o motivo de cada campo recusado, já em português. */
export function FormErrorBox({ error }: { error?: AppError }) {
  const { colors } = useTheme();
  if (!error) return null;
  return (
    <NoticeBox tone="danger">
      <View style={styles.gapSm}>
        <AppText variant="bodyStrong" color={colors.danger}>{error.message}</AppText>
        {Object.values(error.fieldErrors ?? {}).map((message) => (
          <AppText key={message} variant="caption" color={colors.danger}>• {message}</AppText>
        ))}
      </View>
    </NoticeBox>
  );
}

const styles = StyleSheet.create({
  notice: { flexDirection: 'row', gap: spacing.sm, borderRadius: radius.md, padding: spacing.md, alignItems: 'flex-start' },
  flex: { flex: 1 },
  gapSm: { gap: spacing.sm },
});
