import Contrast from 'lucide-react-native/icons/contrast';
import LogOut from 'lucide-react-native/icons/log-out';
import UserRound from 'lucide-react-native/icons/user-round';
import { StyleSheet, View } from 'react-native';
import type { RootScreenProps } from '../../app/navigation/types';
import { PatientScreen } from '../../components/layout/PatientScreen';
import { AppSwitch, AppText, BigActionButton, Card } from '../../components/ui';
import { services } from '../../services';
import { useAppStore } from '../../store/appStore';
import { useQuery } from '../../lib/useQuery';
import { spacing, useTheme } from '../../theme';

/** Ajustes do paciente: alto contraste e a saída da conta (que depende da autorização do cuidador). */
export function PatientSettingsScreen({ navigation }: RootScreenProps<'PatientSettings'>) {
  const { colors, highContrast } = useTheme();
  const patientId = useAppStore((s) => s.patientSession?.patientId ?? '');
  const toggleContrast = useAppStore((s) => s.togglePatientHighContrast);
  const profile = useQuery(['patient-profile', patientId], () => services.patients.getProfile(patientId));
  const caregiver = profile.data?.caregiverFirstName ?? 'quem cuida de você';

  return (
    <PatientScreen back>
      <AppText variant="patientDisplay" accessibilityRole="header">
        Ajustes
      </AppText>

      <Card style={styles.card}>
        <View style={styles.row}>
          <UserRound color={colors.primary} size={28} />
          <View style={styles.flex}>
            <AppText variant="patientStrong">{profile.data?.patient.name ?? ''}</AppText>
            <AppText variant="patientBody" muted>
              Cuidado por {caregiver}
            </AppText>
          </View>
        </View>
      </Card>

      <Card style={styles.card}>
        <AppSwitch
          label="Alto contraste"
          icon={<Contrast color={colors.text} size={28} />}
          value={highContrast}
          onValueChange={toggleContrast}
        />
      </Card>

      <BigActionButton
        title="SAIR DA CONTA"
        icon={LogOut}
        variant="outline"
        onPress={() => navigation.navigate('PatientLeave')}
        accessibilityHint={`Pede a ${caregiver} para tirar este celular da conta`}
      />
    </PatientScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
