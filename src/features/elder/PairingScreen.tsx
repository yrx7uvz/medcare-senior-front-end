import { Link2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { RootScreenProps } from '../../app/navigation/types';
import { ElderScreen } from '../../components/layout/ElderScreen';
import { AppText, BigActionButton, DigitBoxes, PinPad } from '../../components/ui';
import { services } from '../../services';
import { formatCountdown } from '../../lib/date';
import { useMutation } from '../../lib/useQuery';
import { radius, spacing, useTheme } from '../../theme';

/** T-Pareamento — código de 6 dígitos (RN11) com bloqueio após 5 erros (RN12). */
export function PairingScreen({ navigation }: RootScreenProps<'ElderPairing'>) {
  const { colors } = useTheme();
  const [code, setCode] = useState('');
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);
  const [tick, setTick] = useState(Date.now());
  const validate = useMutation(services.elders.validateLinkCode);

  useEffect(() => {
    if (!blockedUntil) return;
    const id = setInterval(() => {
      setTick(Date.now());
      if (Date.now() >= blockedUntil) setBlockedUntil(null);
    }, 1000);
    return () => clearInterval(id);
  }, [blockedUntil]);

  const blocked = blockedUntil !== null && tick < blockedUntil;

  async function submit() {
    const pairing = await validate.mutate(code);
    if (pairing) {
      navigation.navigate('ElderCreatePin', pairing);
      setCode('');
    } else {
      setCode('');
    }
  }

  useEffect(() => {
    if (validate.error?.status === 429 && validate.error.retryAfterSec) setBlockedUntil(Date.now() + validate.error.retryAfterSec * 1000);
  }, [validate.error]);

  const errorText = blocked
    ? `Muitas tentativas. Tente de novo em ${formatCountdown((blockedUntil ?? 0) - tick)}.`
    : validate.error && validate.error.status !== 429
      ? validate.error.message
      : null;

  return (
    <ElderScreen
      footer={
        <BigActionButton
          title="CONECTAR"
          icon={Link2}
          disabled={code.length !== 6 || blocked}
          loading={validate.loading}
          onPress={submit}
        />
      }
    >
      <View style={styles.head}>
        <AppText variant="elderDisplay" accessibilityRole="header">Vamos conectar seu celular</AppText>
        <AppText variant="elderBody" muted>
          Digite os 6 números que quem cuida de você recebeu no aplicativo.
        </AppText>
      </View>
      <DigitBoxes value={code} length={6} error={!!errorText} />
      {errorText ? (
        <View style={[styles.error, { backgroundColor: colors.dangerSoft }]} accessibilityRole="alert">
          <AppText variant="elderBody" color={colors.danger} align="center">{errorText}</AppText>
        </View>
      ) : null}
      <PinPad
        disabled={blocked || validate.loading}
        onDigit={(d) => {
          if (validate.error) validate.clearError();
          setCode((c) => (c.length < 6 ? c + d : c));
        }}
        onBackspace={() => setCode((c) => c.slice(0, -1))}
      />
    </ElderScreen>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.sm, paddingTop: spacing.sm },
  error: { borderRadius: radius.lg, padding: spacing.md },
});
