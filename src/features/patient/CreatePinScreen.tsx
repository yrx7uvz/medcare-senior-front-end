import ShieldCheck from 'lucide-react-native/icons/shield-check';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { RootScreenProps } from '../../app/navigation/types';
import { PatientScreen } from '../../components/layout/PatientScreen';
import { SwitchProfileLink } from '../../components/layout/SwitchProfileLink';
import { AppText, BigActionButton, DigitBoxes, PinPad } from '../../components/ui';
import { useAppStore } from '../../store/appStore';
import { firstName } from '../../lib/date';
import { patientDeviceStorage } from '../../lib/secureStorage';
import { radius, spacing, useTheme } from '../../theme';

/** Criação do PIN local de 4 dígitos, guardado só no aparelho (HU07). */
export function CreatePinScreen({ route }: RootScreenProps<'PatientCreatePin'>) {
  const { colors } = useTheme();
  const { patientId, patientName, token } = route.params;
  const setPatientSession = useAppStore((s) => s.setPatientSession);
  const setUnlocked = useAppStore((s) => s.setPatientUnlocked);
  const [first, setFirst] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  // PIN confirmado que ainda não pôde ser gravado (falha do SecureStore): permite tentar de novo
  const [unsaved, setUnsaved] = useState<string | null>(null);

  async function persist(confirmed: string) {
    try {
      await patientDeviceStorage.saveSession({ patientId, token });
      await patientDeviceStorage.savePin(confirmed);
    } catch {
      setUnsaved(confirmed);
      return;
    }
    setUnsaved(null);
    setUnlocked(true);
    setPatientSession({ patientId, token });
  }

  useEffect(() => {
    if (pin.length !== 4) return;
    if (first === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- máquina de estados do PIN dirigida pelo efeito (comportamento atual); regra do React Compiler, que o projeto não usa
      setFirst(pin);
      setPin('');
      return;
    }
    if (pin !== first) {
      setError('Os PINs não são iguais. Vamos começar de novo.');
      setFirst(null);
      setPin('');
      return;
    }
    void persist(pin);
    // persist muda a cada render; o efeito reage só à digitação do PIN
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, first]);

  return (
    <PatientScreen>
      <View style={styles.head}>
        <AppText variant="patientDisplay" accessibilityRole="header">
          {first === null ? `Olá, ${firstName(patientName)}! Crie seu PIN` : 'Digite o PIN de novo'}
        </AppText>
        <AppText variant="patientBody" muted>
          {first === null ? 'Escolha 4 números fáceis de lembrar. Você vai usá-los para abrir o app.' : 'Para confirmar que está certo.'}
        </AppText>
      </View>
      <DigitBoxes value={pin} length={4} masked error={!!error} />
      {unsaved ? (
        <View style={[styles.box, { backgroundColor: colors.dangerSoft }]} accessibilityRole="alert">
          <AppText variant="patientBody" color={colors.danger} align="center">
            Não foi possível guardar o PIN neste celular.
          </AppText>
        </View>
      ) : null}
      {unsaved ? <BigActionButton title="Tentar novamente" variant="primary" onPress={() => void persist(unsaved)} /> : null}
      {error ? (
        <View style={[styles.box, { backgroundColor: colors.dangerSoft }]} accessibilityRole="alert">
          <AppText variant="patientBody" color={colors.danger} align="center">{error}</AppText>
        </View>
      ) : null}
      <PinPad
        onDigit={(d) => {
          setError(null);
          setPin((p) => (p.length < 4 ? p + d : p));
        }}
        onBackspace={() => setPin((p) => p.slice(0, -1))}
      />
      <View style={[styles.box, styles.row, { backgroundColor: colors.infoSoft }]}>
        <ShieldCheck color={colors.primaryDark} size={26} />
        <AppText variant="patientBody" style={styles.flex}>O PIN fica guardado só neste celular.</AppText>
      </View>
      <SwitchProfileLink />
    </PatientScreen>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.sm, paddingTop: spacing.sm },
  box: { borderRadius: radius.lg, padding: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
