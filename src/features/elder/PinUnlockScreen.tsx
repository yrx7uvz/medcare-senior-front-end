import { HelpCircle } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { RootScreenProps } from '../../app/navigation/types';
import { ElderScreen } from '../../components/layout/ElderScreen';
import { AppText, BigActionButton, ConfirmDialog, DigitBoxes, PinPad } from '../../components/ui';
import { useAppStore } from '../../store/appStore';
import { elderDeviceStorage } from '../../lib/secureStorage';
import { radius, spacing, useTheme } from '../../theme';

/** PIN pedido a cada abertura do app do idoso. */
export function PinUnlockScreen(_: RootScreenProps<'ElderPinUnlock'>) {
  const { colors } = useTheme();
  const setUnlocked = useAppStore((s) => s.setElderUnlocked);
  const setElderSession = useAppStore((s) => s.setElderSession);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [forgot, setForgot] = useState(false);
  // Falha do SecureStore ao verificar o PIN ou ao desconectar
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    if (pin.length !== 4) return;
    elderDeviceStorage
      .verifyPin(pin)
      .then((ok) => {
        if (ok) setUnlocked(true);
        else {
          setError(true);
          setPin('');
        }
      })
      .catch(() => {
        setStorageError('Não foi possível verificar o PIN neste celular.');
        setPin('');
      });
  }, [pin, setUnlocked]);

  return (
    <ElderScreen>
      <View style={styles.head}>
        <AppText variant="elderDisplay" accessibilityRole="header">Digite seu PIN</AppText>
        <AppText variant="elderBody" muted>Os 4 números que você criou.</AppText>
      </View>
      <DigitBoxes value={pin} length={4} masked error={error} />
      {error ? (
        <View style={[styles.box, { backgroundColor: colors.dangerSoft }]} accessibilityRole="alert">
          <AppText variant="elderBody" color={colors.danger} align="center">PIN incorreto. Tente de novo.</AppText>
        </View>
      ) : null}
      {storageError ? (
        <View style={[styles.box, { backgroundColor: colors.dangerSoft }]} accessibilityRole="alert">
          <AppText variant="elderBody" color={colors.danger} align="center">{storageError}</AppText>
        </View>
      ) : null}
      {storageError ? <BigActionButton title="Tentar novamente" variant="primary" onPress={() => setStorageError(null)} /> : null}
      <PinPad
        disabled={!!storageError}
        onDigit={(d) => {
          setError(false);
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
            await elderDeviceStorage.clear();
          } catch {
            setForgot(false);
            setStorageError('Não foi possível desconectar este celular.');
            return;
          }
          setForgot(false);
          setElderSession(null);
        }}
      />
    </ElderScreen>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.sm, paddingTop: spacing.sm },
  box: { borderRadius: radius.lg, padding: spacing.md },
});
