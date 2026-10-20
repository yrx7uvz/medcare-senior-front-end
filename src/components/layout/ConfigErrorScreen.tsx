import { ServerCrash } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '../ui';
import { radius, spacing, useTheme } from '../../theme';

/**
 * Tela única quando o build não pode usar o endereço da API (ausente, inválido ou http:// no release). O app não
 * chama a API nem restaura sessões: não há o que o usuário possa fazer além de instalar uma versão corrigida.
 */
export function ConfigErrorScreen({ problem }: { problem: string }) {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} accessibilityRole="alert">
        <View style={[styles.icon, { backgroundColor: colors.dangerSoft }]}>
          <ServerCrash color={colors.danger} size={36} />
        </View>
        <AppText variant="title" align="center" accessibilityRole="header">
          App com configuração inválida
        </AppText>
        <AppText variant="body" align="center">
          {problem}
        </AppText>
        <AppText variant="body" muted align="center">
          Avise a equipe responsável pelo MedCare Sênior. Seus dados não foram enviados.
        </AppText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md, alignItems: 'center' },
  icon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
});
