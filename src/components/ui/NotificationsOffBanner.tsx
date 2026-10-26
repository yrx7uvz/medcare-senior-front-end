import BellOff from 'lucide-react-native/icons/bell-off';
import { StyleSheet, View } from 'react-native';
import { ENABLE_NOTIFICATIONS_LABEL, NOTIFICATIONS_OFF_MESSAGE } from '../../lib/notificationsOff';
import { radius, spacing, useTheme } from '../../theme';
import { AppText } from './AppText';
import { Button } from './Button';

/**
 * Faixa de atenção quando as notificações do aparelho estão desligadas: sem elas o cuidador não recebe o aviso de dose
 * não confirmada. O botão pede a permissão ou abre as configurações do Android.
 */
export function NotificationsOffBanner({ onEnable }: { onEnable: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: colors.warningSoft, borderColor: colors.warningText }]} accessibilityRole="alert">
      <View style={styles.top}>
        <BellOff color={colors.warningText} size={22} />
        <AppText variant="body" color={colors.warningText} style={styles.flex}>
          {NOTIFICATIONS_OFF_MESSAGE}
        </AppText>
      </View>
      <Button title={ENABLE_NOTIFICATIONS_LABEL} size="sm" variant="secondary" onPress={onEnable} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 1.5, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  top: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  flex: { flex: 1 },
});
