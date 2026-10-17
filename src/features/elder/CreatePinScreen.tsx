import { ShieldCheck } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { RootScreenProps } from '../../app/navigation/types';
import { ElderScreen } from '../../components/layout/ElderScreen';
import { AppText, DigitBoxes, PinPad } from '../../components/ui';
import { useAppStore } from '../../store/appStore';
import { firstName } from '../../lib/date';
import { elderDeviceStorage } from '../../lib/secureStorage';
import { radius, spacing, useTheme } from '../../theme';

/** Criação do PIN local de 4 dígitos, guardado só no aparelho (HU07). */
export function CreatePinScreen({ route }: RootScreenProps<'ElderCreatePin'>) {
  const { colors } = useTheme();
  const { elderId, elderName, token } = route.params;
  const setElderSession = useAppStore((s) => s.setElderSession);
  const setUnlocked = useAppStore((s) => s.setElderUnlocked);
  const [first, setFirst] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (pin.length !== 4) return;
    if (first === null) {
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
    (async () => {
      await elderDeviceStorage.saveSession({ elderId, token });
      await elderDeviceStorage.savePin(pin);
      setUnlocked(true);
      setElderSession({ elderId });
    })();
  }, [pin, first, elderId, token, setElderSession, setUnlocked]);

  return (
    <ElderScreen>
      <View style={styles.head}>
        <AppText variant="elderDisplay" accessibilityRole="header">
          {first === null ? `Olá, ${firstName(elderName)}! Crie seu PIN` : 'Digite o PIN de novo'}
        </AppText>
        <AppText variant="elderBody" muted>
          {first === null ? 'Escolha 4 números fáceis de lembrar. Você vai usá-los para abrir o app.' : 'Para confirmar que está certo.'}
        </AppText>
      </View>
      <DigitBoxes value={pin} length={4} masked error={!!error} />
      {error ? (
        <View style={[styles.box, { backgroundColor: colors.dangerSoft }]} accessibilityRole="alert">
          <AppText variant="elderBody" color={colors.danger} align="center">{error}</AppText>
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
        <AppText variant="elderBody" style={styles.flex}>O PIN fica guardado só neste celular.</AppText>
      </View>
    </ElderScreen>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.sm, paddingTop: spacing.sm },
  box: { borderRadius: radius.lg, padding: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
