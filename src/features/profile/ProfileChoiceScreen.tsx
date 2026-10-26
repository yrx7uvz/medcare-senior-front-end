import HeartHandshake from 'lucide-react-native/icons/heart-handshake';
import UserRound from 'lucide-react-native/icons/user-round';
import { StyleSheet, View } from 'react-native';
import type { RootScreenProps } from '../../app/navigation/types';
import { PatientScreen } from '../../components/layout/PatientScreen';
import { AppText, BigActionButton } from '../../components/ui';
import { chooseProfile } from '../../lib/session';
import { spacing } from '../../theme';

/**
 * Primeira tela do aparelho: quem vai usar este celular. Tema do paciente na tela
 * inteira (texto ≥ 20sp, botões ≥ 88dp). A escolha fica gravada no SecureStore.
 */
export function ProfileChoiceScreen(_: RootScreenProps<'ProfileChoice'>) {
  return (
    <PatientScreen>
      <View style={styles.head}>
        <AppText variant="patientDisplay" accessibilityRole="header">
          Quem vai usar este celular?
        </AppText>
        <AppText variant="patientBody" muted>
          Escolha uma opção. Dá para trocar depois.
        </AppText>
      </View>
      <BigActionButton
        title="Cuido de alguém"
        subtitle="Acompanho os remédios de outra pessoa"
        icon={HeartHandshake}
        variant="primary"
        onPress={() => void chooseProfile('CAREGIVER')}
      />
      <BigActionButton
        title="Tomo os remédios"
        subtitle="Quero ver e confirmar meus remédios"
        icon={UserRound}
        variant="success"
        onPress={() => void chooseProfile('PATIENT')}
      />
    </PatientScreen>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.sm, paddingTop: spacing.sm },
});
