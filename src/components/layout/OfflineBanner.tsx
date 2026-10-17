import { WifiOff } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useDevStore } from '../../store/devStore';
import { spacing, useTheme } from '../../theme';
import { AppText } from '../ui';

export function OfflineBanner() {
  const { colors, elder } = useTheme();
  const offline = useDevStore((s) => s.offline);
  if (!offline) return null;
  return (
    <View style={[styles.bar, { backgroundColor: colors.warningSoft }]} accessibilityLiveRegion="polite">
      <WifiOff color={colors.warningText} size={elder ? 24 : 16} />
      <AppText variant={elder ? 'elderBody' : 'label'} color={colors.warningText}>
        Sem conexão. As ações serão possíveis quando a internet voltar.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
});
