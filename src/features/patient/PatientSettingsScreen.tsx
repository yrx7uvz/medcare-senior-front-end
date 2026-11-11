import Contrast from 'lucide-react-native/icons/contrast';
import LockKeyhole from 'lucide-react-native/icons/lock-keyhole';
import LogOut from 'lucide-react-native/icons/log-out';
import UserRound from 'lucide-react-native/icons/user-round';
import { useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import type { RootScreenProps } from '../../app/navigation/types';
import { PatientScreen } from '../../components/layout/PatientScreen';
import { AppSwitch, AppText, BigActionButton, Card, DigitBoxes, OptionList, PinPad, ThemeToggle } from '../../components/ui';
import { services } from '../../services';
import { useAppStore } from '../../store/appStore';
import { formatLockRemaining } from '../../lib/pinCore';
import { PIN_ASK_OPTIONS, PIN_NEVER_WARNING, type PinAskMode } from '../../lib/pinGrace';
import { setPinAskMode } from '../../lib/pinSession';
import { patientDeviceStorage } from '../../lib/secureStorage';
import { useQuery } from '../../lib/useQuery';
import { radius, spacing, useTheme } from '../../theme';

/**
 * Ajustes do paciente: tema (o mesmo seletor do cuidador), alto contraste, quando pedir o PIN e a saída da conta (que
 * depende da autorização do cuidador).
 */
export function PatientSettingsScreen({ navigation }: RootScreenProps<'PatientSettings'>) {
  const { colors, highContrast } = useTheme();
  const patientId = useAppStore((s) => s.patientSession?.patientId ?? '');
  const toggleContrast = useAppStore((s) => s.togglePatientHighContrast);
  const askMode = useAppStore((s) => s.pinAskMode);
  const showToast = useAppStore((s) => s.showToast);
  const profile = useQuery(['patient-profile', patientId], () => services.patients.getProfile(patientId));
  const caregiver = profile.data?.caregiverFirstName ?? 'quem cuida de você';
  // "Nunca neste celular" só depois de confirmar o PIN atual
  const [confirmNever, setConfirmNever] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const choose = async (mode: PinAskMode) => {
    if (mode === askMode) return;
    if (mode === 'NEVER') {
      setConfirmNever(true);
      return;
    }
    await save(mode);
  };

  const save = async (mode: PinAskMode) => {
    try {
      await setPinAskMode(mode);
      setSaveError(null);
      showToast(mode === 'NEVER' ? 'O PIN não será mais pedido neste celular.' : 'Pronto. Escolha guardada neste celular.', 'info');
    } catch {
      setSaveError('Não foi possível guardar a escolha neste celular. Tente de novo.');
    }
  };

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
        <ThemeToggle />
      </Card>

      <Card style={styles.card}>
        <AppSwitch
          label="Alto contraste"
          icon={<Contrast color={colors.text} size={28} />}
          value={highContrast}
          onValueChange={toggleContrast}
        />
      </Card>

      <Card style={styles.card}>
        <View style={styles.row}>
          <LockKeyhole color={colors.primary} size={28} />
          <AppText variant="patientStrong" style={styles.flex}>
            Pedir o PIN ao abrir o app
          </AppText>
        </View>
        <OptionList label="Pedir o PIN ao abrir o app" options={PIN_ASK_OPTIONS} value={askMode} onChange={(m) => void choose(m)} />
        {askMode === 'NEVER' ? (
          <View style={[styles.box, { backgroundColor: colors.warningSoft }]}>
            <AppText variant="patientBody" color={colors.warningText}>
              {PIN_NEVER_WARNING}
            </AppText>
          </View>
        ) : null}
        {saveError ? (
          <AppText variant="patientBody" color={colors.danger} accessibilityRole="alert">
            {saveError}
          </AppText>
        ) : null}
      </Card>

      <BigActionButton
        title="SAIR DA CONTA"
        icon={LogOut}
        variant="outline"
        onPress={() => navigation.navigate('PatientLeave')}
        accessibilityHint={`Pede a ${caregiver} para tirar este celular da conta`}
      />

      <ConfirmPinDialog
        visible={confirmNever}
        onCancel={() => setConfirmNever(false)}
        onConfirmed={() => {
          setConfirmNever(false);
          void save('NEVER');
        }}
      />
    </PatientScreen>
  );
}

/** Confirma o PIN atual antes de deixar de pedi-lo (mesmo limite de tentativas da tela do PIN). */
function ConfirmPinDialog({ visible, onCancel, onConfirmed }: { visible: boolean; onCancel: () => void; onConfirmed: () => void }) {
  const { colors } = useTheme();
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const confirmedRef = useRef(onConfirmed);
  // Mesmo padrão "latest ref" de useQuery: a conferência roda só pela digitação, com o callback mais recente
  // eslint-disable-next-line react-hooks/refs
  confirmedRef.current = onConfirmed;

  const close = () => {
    setPin('');
    setMessage(null);
    onCancel();
  };

  useEffect(() => {
    if (pin.length !== 4) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- conferência do PIN dirigida pela digitação (sistema externo: SecureStore); regra do React Compiler, que o projeto não usa
    setChecking(true);
    patientDeviceStorage
      .checkPin(pin)
      .then((r) => {
        if (r.result === 'OK') {
          setMessage(null);
          confirmedRef.current();
        } else if (r.result === 'WRONG') setMessage('PIN incorreto. Tente de novo.');
        else if (r.result === 'LOCKED') setMessage(`Muitas tentativas erradas. Tente de novo em ${formatLockRemaining(r.remainingMs)}.`);
        else setMessage('Este celular não tem PIN.');
      })
      .catch(() => setMessage('Não foi possível verificar o PIN neste celular.'))
      .finally(() => {
        setChecking(false);
        setPin('');
      });
  }, [pin]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      {/* Rolável: com fonte ampliada o teclado do PIN não cabe numa tela pequena */}
      <ScrollView style={{ backgroundColor: colors.overlay }} contentContainerStyle={styles.backdrop}>
        <View style={[styles.dialog, { backgroundColor: colors.surface, borderColor: colors.border }]} accessibilityViewIsModal>
          <AppText variant="patientStrong" accessibilityRole="header">
            Digite seu PIN para confirmar
          </AppText>
          <View style={[styles.box, { backgroundColor: colors.warningSoft }]}>
            <AppText variant="patientBody" color={colors.warningText}>
              {PIN_NEVER_WARNING}
            </AppText>
          </View>
          <DigitBoxes value={pin} length={4} masked error={!!message} />
          {checking ? (
            <AppText variant="patientBody" muted align="center" accessibilityLiveRegion="polite">
              Conferindo...
            </AppText>
          ) : null}
          {message ? (
            <AppText variant="patientBody" color={colors.danger} align="center" accessibilityRole="alert">
              {message}
            </AppText>
          ) : null}
          <PinPad
            disabled={checking}
            onDigit={(d) => {
              setMessage(null);
              setPin((p) => (p.length < 4 ? p + d : p));
            }}
            onBackspace={() => setPin((p) => p.slice(0, -1))}
          />
          <BigActionButton title="Cancelar" variant="outline" onPress={close} />
        </View>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  box: { borderRadius: radius.lg, padding: spacing.md },
  backdrop: { flexGrow: 1, justifyContent: 'center', padding: spacing.md },
  dialog: { borderRadius: radius.xl, borderWidth: 1, padding: spacing.lg, gap: spacing.md },
});
