import WifiOff from 'lucide-react-native/icons/wifi-off';
import { StyleSheet, View } from 'react-native';
import { useDevStore } from '../../store/devStore';
import { spacing, useTheme } from '../../theme';
import { AppText } from '../ui';

export function OfflineBanner() {
  const { colors, patient } = useTheme();
  const offline = useDevStore((s) => s.offline);
  if (!offline) return null;
  return (
    <View style={[styles.bar, { backgroundColor: colors.warningSoft }]} accessibilityLiveRegion="polite">
      <WifiOff color={colors.warningText} size={patient ? 24 : 16} />
      <AppText variant={patient ? 'patientBody' : 'label'} color={colors.warningText}>
        Sem conexão. As ações serão possíveis quando a internet voltar.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
});
