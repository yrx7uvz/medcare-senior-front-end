import { HelpCircle, Lock } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import type { RootScreenProps } from '../../app/navigation/types';
import { PatientScreen } from '../../components/layout/PatientScreen';
import { AppText, BigActionButton, ConfirmDialog, DigitBoxes, PinPad } from '../../components/ui';
import { useAppStore } from '../../store/appStore';
import { formatLockRemaining } from '../../lib/pinCore';
import { patientDeviceStorage } from '../../lib/secureStorage';
import { radius, spacing, useTheme } from '../../theme';

const monotonicNow = () => globalThis.performance.now();

/**
 * PIN pedido a cada abertura do app do paciente. Depois de 5 erros seguidos o teclado fica bloqueado por um tempo
 * crescente (30 s, 2 min, 10 min), com a contagem na tela; o bloqueio continua se o app for fechado.
 */
export function PinUnlockScreen(_: RootScreenProps<'PatientPinUnlock'>) {
  const { colors } = useTheme();
  const setUnlocked = useAppStore((s) => s.setPatientUnlocked);
  const setPatientSession = useAppStore((s) => s.setPatientSession);
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  // Fim do bloqueio no relógio monotônico (null = liberado) e o que falta, para a tela
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [forgot, setForgot] = useState(false);
  // Falha do SecureStore ao verificar o PIN ou ao desconectar
  const [storageError, setStorageError] = useState<string | null>(null);

  const startLock = (ms: number) => {
    setLockedUntil(monotonicNow() + ms);
    setRemainingMs(ms);
  };

  useEffect(() => {
    patientDeviceStorage
      .pinLockRemainingMs()
      .then((ms) => {
        if (ms > 0) startLock(ms);
      })
      .catch(() => setStorageError('Não foi possível verificar o PIN neste celular.'));
    // Guarda quanto falta do bloqueio ao ir para o segundo plano e ao sair da tela
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void patientDeviceStorage.persistPinAttempts().catch(() => undefined);
    });
    return () => {
      sub.remove();
      void patientDeviceStorage.persistPinAttempts().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    if (lockedUntil === null) return;
    const id = setInterval(() => {
      const left = lockedUntil - monotonicNow();
      if (left <= 0) {
        setLockedUntil(null);
        setRemainingMs(0);
        setWrong(null);
      } else setRemainingMs(left);
    }, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  useEffect(() => {
    if (pin.length !== 4) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- conferência do PIN dirigida pela digitação (sistema externo: SecureStore); regra do React Compiler, que o projeto não usa
    setChecking(true);
    patientDeviceStorage
      .checkPin(pin)
      .then((r) => {
        if (r.result === 'OK') setUnlocked(true);
        else if (r.result === 'LOCKED') {
          setWrong(null);
          startLock(r.remainingMs);
        } else if (r.result === 'WRONG') setWrong(r.attemptsBeforeLock);
        else setStorageError('Este celular não tem PIN. Use "Esqueci meu PIN" para conectar de novo.');
      })
      .catch(() => setStorageError('Não foi possível verificar o PIN neste celular.'))
      .finally(() => {
        setChecking(false);
        setPin('');
      });
  }, [pin, setUnlocked]);

  const locked = lockedUntil !== null;

  return (
    <PatientScreen>
      <View style={styles.head}>
        <AppText variant="patientDisplay" accessibilityRole="header">Digite seu PIN</AppText>
        <AppText variant="patientBody" muted>Os 4 números que você criou.</AppText>
      </View>
      <DigitBoxes value={pin} length={4} masked error={wrong !== null} />
      {checking ? (
        <AppText variant="patientBody" muted align="center" accessibilityLiveRegion="polite">Conferindo...</AppText>
      ) : null}
      {wrong !== null && !locked ? (
        <View style={[styles.box, { backgroundColor: colors.dangerSoft }]} accessibilityRole="alert">
          <AppText variant="patientBody" color={colors.danger} align="center">
            PIN incorreto. {wrong === 1 ? 'Mais 1 tentativa' : `Mais ${wrong} tentativas`} antes de o teclado ficar bloqueado por um tempo.
          </AppText>
        </View>
      ) : null}
      {locked ? (
        <View style={[styles.box, styles.row, { backgroundColor: colors.dangerSoft }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Lock color={colors.danger} size={28} />
          <AppText variant="patientBody" color={colors.danger} style={styles.flex}>
            Muitas tentativas erradas. Tente de novo em {formatLockRemaining(remainingMs)}.
          </AppText>
        </View>
      ) : null}
      {storageError ? (
        <View style={[styles.box, { backgroundColor: colors.dangerSoft }]} accessibilityRole="alert">
          <AppText variant="patientBody" color={colors.danger} align="center">{storageError}</AppText>
        </View>
      ) : null}
      {storageError ? <BigActionButton title="Tentar novamente" variant="primary" onPress={() => setStorageError(null)} /> : null}
      <PinPad
        disabled={!!storageError || locked || checking}
        onDigit={(d) => {
          setWrong(null);
          setPin((p) => (p.length < 4 ? p + d : p));
        }}
        onBackspace={() => setPin((p) => p.slice(0, -1))}
      />
      <BigActionButton title="Esqueci meu PIN" icon={HelpCircle} variant="outline" onPress={() => setForgot(true)} />
      <ConfirmDialog
        visible={forgot}
        title="Conectar de novo"
        message="Peça um novo código para quem cuida de você. Este celular será desconectado e você vai criar outro PIN."
        confirmLabel="Desconectar este celular"
        onCancel={() => setForgot(false)}
        onConfirm={async () => {
          try {
            await patientDeviceStorage.clear();
          } catch {
            setForgot(false);
            setStorageError('Não foi possível desconectar este celular.');
            return;
          }
          setForgot(false);
          setPatientSession(null);
        }}
      />
    </PatientScreen>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.sm, paddingTop: spacing.sm },
  box: { borderRadius: radius.lg, padding: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
