import { AlertCircle, WifiOff } from 'lucide-react-native';
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
  const { colors, elder } = useTheme();
  const offline = error?.kind === 'NETWORK';
  const Icon = offline ? WifiOff : AlertCircle;
  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <View style={[styles.iconWrap, { backgroundColor: colors.dangerSoft }]}>
        <Icon color={colors.danger} size={elder ? 40 : 30} />
      </View>
      <AppText variant={elder ? 'elderTitle' : 'heading'} align="center">
        {offline ? 'Sem conexão' : 'Não foi possível carregar os dados'}
      </AppText>
      <AppText variant={elder ? 'elderBody' : 'body'} muted align="center">
        {offline ? 'Verifique a internet do celular e tente de novo.' : 'Algo falhou ao buscar as informações. Tente de novo em instantes.'}
      </AppText>
      <Button title="Tentar novamente" onPress={onRetry} size={elder ? 'lg' : 'md'} style={styles.btn} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg, gap: spacing.sm },
  iconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  btn: { marginTop: spacing.md, alignSelf: 'stretch' },
});
