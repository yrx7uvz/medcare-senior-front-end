import { RefreshCw } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { radius, spacing, touch, useTheme } from '../../theme';
import { AppText } from './AppText';

/** Aviso discreto quando a atualização em segundo plano falhou e a tela mostra os últimos dados obtidos. */
export function RefreshFailedBanner({ onRetry }: { onRetry?: () => void }) {
  const { colors, patient } = useTheme();
  return (
    <View style={[styles.bar, { backgroundColor: colors.warningSoft }]} accessibilityLiveRegion="polite" accessibilityRole="alert">
      <AppText variant={patient ? 'patientBody' : 'label'} color={colors.warningText} style={styles.flex}>
        Não foi possível atualizar. Mostrando os últimos dados.
      </AppText>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tentar atualizar de novo"
          onPress={onRetry}
          hitSlop={8}
          style={({ pressed }) => [styles.retry, { minHeight: patient ? touch.patient : 44, opacity: pressed ? 0.7 : 1 }]}
        >
          <RefreshCw color={colors.warningText} size={patient ? 28 : 20} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  retry: { minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});
