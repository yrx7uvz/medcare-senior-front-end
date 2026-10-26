import * as Clipboard from 'expo-clipboard';
import ClipboardPaste from 'lucide-react-native/icons/clipboard-paste';
import Link2 from 'lucide-react-native/icons/link-2';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { RootScreenProps } from '../../app/navigation/types';
import { PatientScreen } from '../../components/layout/PatientScreen';
import { SwitchProfileLink } from '../../components/layout/SwitchProfileLink';
import { AppText, BigActionButton, Button, DigitBoxes, PinPad } from '../../components/ui';
import { services } from '../../services';
import { useAppStore } from '../../store/appStore';
import { formatCountdown } from '../../lib/date';
import { PASTE_INVALID_MESSAGE, parsePastedCode } from '../../lib/pairingCode';
import { useMutation } from '../../lib/useQuery';
import { radius, spacing, useTheme } from '../../theme';

/**
 * Pareamento do aparelho do paciente: código de 6 números (digitado no teclado da tela ou colado), com bloqueio
 * temporário depois de muitas tentativas erradas.
 */
export function PairingScreen({ navigation }: RootScreenProps<'PatientPairing'>) {
  const { colors } = useTheme();
  const [code, setCode] = useState('');
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);
  const [tick, setTick] = useState(() => Date.now());
  const [pasteMessage, setPasteMessage] = useState<string | null>(null);
  const validate = useMutation(services.patients.validateLinkCode);
  // Ex.: aparelho desconectado pela API (sessão do paciente inválida)
  const flash = useAppStore((s) => s.flash);
  const setFlash = useAppStore((s) => s.setFlash);

  useEffect(() => {
    if (!blockedUntil) return;
    const id = setInterval(() => {
      setTick(Date.now());
      if (Date.now() >= blockedUntil) setBlockedUntil(null);
    }, 1000);
    return () => clearInterval(id);
  }, [blockedUntil]);

  const blocked = blockedUntil !== null && tick < blockedUntil;

  /** Lê a área de transferência só neste toque; preenche as caixas, mas quem conecta é o botão CONECTAR. */
  async function pasteCode() {
    let pasted: string | null = null;
    try {
      pasted = parsePastedCode(await Clipboard.getStringAsync());
    } catch {
      pasted = null;
    }
    if (!pasted) {
      setPasteMessage(PASTE_INVALID_MESSAGE);
      return;
    }
    if (validate.error) validate.clearError();
    setPasteMessage(null);
    setCode(pasted);
  }

  async function submit() {
    setFlash(null);
    const pairing = await validate.mutate(code);
    if (pairing) {
      navigation.navigate('PatientCreatePin', pairing);
      setCode('');
    } else {
      setCode('');
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reage ao erro da mutação (estado externo ao componente); regra do React Compiler, que o projeto não usa
    if (validate.error?.status === 429 && validate.error.retryAfterSec) setBlockedUntil(Date.now() + validate.error.retryAfterSec * 1000);
  }, [validate.error]);

  const errorText = blocked
    ? `Muitas tentativas. Tente de novo em ${formatCountdown((blockedUntil ?? 0) - tick)}.`
    : // 429 com Retry-After vira a contagem acima; sem o header, fica a mensagem do erro (já em português)
      validate.error && (validate.error.status !== 429 || !validate.error.retryAfterSec)
      ? validate.error.message
      : null;

  return (
    <PatientScreen
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
        <AppText variant="patientDisplay" accessibilityRole="header">Vamos conectar seu celular</AppText>
        <AppText variant="patientBody" muted>
          Digite os 6 números que quem cuida de você recebeu no aplicativo.
        </AppText>
      </View>
      {flash ? (
        <View style={[styles.error, { backgroundColor: colors.infoSoft }]} accessibilityRole="alert">
          <AppText variant="patientBody" align="center">{flash}</AppText>
        </View>
      ) : null}
      <DigitBoxes value={code} length={6} error={!!errorText} />
      <Button
        title="Colar código"
        icon={ClipboardPaste}
        variant="secondary"
        size="sm"
        style={styles.paste}
        disabled={blocked || validate.loading}
        accessibilityHint="Coloca nas caixas um código de 6 números que você copiou"
        onPress={() => void pasteCode()}
      />
      {pasteMessage ? (
        <AppText variant="patientBody" color={colors.danger} align="center" accessibilityRole="alert">{pasteMessage}</AppText>
      ) : null}
      {errorText ? (
        <View style={[styles.error, { backgroundColor: colors.dangerSoft }]} accessibilityRole="alert">
          <AppText variant="patientBody" color={colors.danger} align="center">{errorText}</AppText>
        </View>
      ) : null}
      <PinPad
        disabled={blocked || validate.loading}
        onDigit={(d) => {
          if (validate.error) validate.clearError();
          setPasteMessage(null);
          setCode((c) => (c.length < 6 ? c + d : c));
        }}
        onBackspace={() => setCode((c) => c.slice(0, -1))}
      />
      <SwitchProfileLink />
    </PatientScreen>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.sm, paddingTop: spacing.sm },
  error: { borderRadius: radius.lg, padding: spacing.md },
  paste: { alignSelf: 'center' },
});
