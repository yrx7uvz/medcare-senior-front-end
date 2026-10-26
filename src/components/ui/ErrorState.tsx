import AlertCircle from 'lucide-react-native/icons/circle-alert';
import WifiOff from 'lucide-react-native/icons/wifi-off';
import { StyleSheet, View } from 'react-native';
import type { AppError } from '../../services/errors';
import { spacing, useTheme } from '../../theme';
import { AppText } from './AppText';
import { Button } from './Button';

interface Props {
  error?: AppError;
  onRetry: () => void;
}

export function ErrorState({ error, onRetry }: Props) {
  const { colors, patient } = useTheme();
  const offline = error?.kind === 'NETWORK';
  const Icon = offline ? WifiOff : AlertCircle;
  // 4xx (ex.: 404, 403) e configuração: a mensagem da API/do app explica o problema melhor que o texto genérico
  const specific = error && (error.kind === 'CONFIG' || (error.kind === 'HTTP' && error.status >= 400 && error.status < 500)) ? error.message : null;
  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <View style={[styles.iconWrap, { backgroundColor: colors.dangerSoft }]}>
        <Icon color={colors.danger} size={patient ? 40 : 30} />
      </View>
      <AppText variant={patient ? 'patientTitle' : 'heading'} align="center">
        {offline ? 'Sem conexão' : error?.kind === 'CONFIG' ? 'App não configurado' : 'Não foi possível carregar os dados'}
      </AppText>
      <AppText variant={patient ? 'patientBody' : 'body'} muted align="center">
        {offline
          ? 'Verifique a internet do celular e tente de novo.'
          : (specific ?? 'Algo falhou ao buscar as informações. Tente de novo em instantes.')}
      </AppText>
      <Button title="Tentar novamente" onPress={onRetry} size={patient ? 'lg' : 'md'} style={styles.btn} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg, gap: spacing.sm },
  iconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  btn: { marginTop: spacing.md, alignSelf: 'stretch' },
});
