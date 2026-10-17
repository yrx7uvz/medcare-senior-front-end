import { HeartHandshake, UserRound } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import type { RootScreenProps } from '../../app/navigation/types';
import { ElderScreen } from '../../components/layout/ElderScreen';
import { AppText, BigActionButton } from '../../components/ui';
import { chooseProfile } from '../../lib/session';
import { spacing } from '../../theme';

/**
 * Primeira tela do aparelho: quem vai usar este celular. Tema do idoso na tela
 * inteira (texto ≥ 20sp, botões ≥ 88dp). A escolha fica gravada no SecureStore.
 */
export function ProfileChoiceScreen(_: RootScreenProps<'ProfileChoice'>) {
  return (
    <ElderScreen>
      <View style={styles.head}>
        <AppText variant="elderDisplay" accessibilityRole="header">
          Quem vai usar este celular?
        </AppText>
        <AppText variant="elderBody" muted>
          Escolha uma opção. Dá para trocar depois.
        </AppText>
      </View>
      <BigActionButton
        title="Sou cuidador"
        subtitle="Cuido dos remédios de alguém"
        icon={HeartHandshake}
        variant="primary"
        onPress={() => void chooseProfile('CAREGIVER')}
      />
      <BigActionButton
        title="Sou idoso"
        subtitle="Quero ver e confirmar meus remédios"
        icon={UserRound}
        variant="success"
        onPress={() => void chooseProfile('ELDER')}
      />
    </ElderScreen>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.sm, paddingTop: spacing.sm },
});
