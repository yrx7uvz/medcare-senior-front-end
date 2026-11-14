import KeyRound from 'lucide-react-native/icons/key-round';
import RotateCw from 'lucide-react-native/icons/rotate-cw';
import Send from 'lucide-react-native/icons/send';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootScreenProps } from '../../app/navigation/types';
import { StackHeader } from '../../components/layout/StackHeader';
import { AppText, Button, Card, TextField } from '../../components/ui';
import { IS_DEMO } from '../../config/env';
import { services } from '../../services';
import { useAppStore } from '../../store/appStore';
import { isEmail } from '../../lib/schemas';
import { DEMO_EMAIL_CODE, onlyCodeDigits, resetFormProblem } from '../../lib/emailCode';
import { useMutation } from '../../lib/useQuery';
import { RESEND_WAIT_MS, resendLabel, useSecondsLeft } from '../../lib/useSecondsLeft';
import { radius, spacing, useTheme } from '../../theme';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';

/**
 * "Esqueci minha senha", em dois passos: o e-mail (o servidor envia um código se houver conta, sem dizer se há) e
 * depois o código com a senha nova. Pronto, volta ao login com o e-mail preenchido.
 */
export function ForgotPasswordScreen({ navigation, route }: RootScreenProps<'ForgotPassword'>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const setFlash = useAppStore((s) => s.setFlash);
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const secondsLeft = useSecondsLeft(resendAt);
  const request = useMutation(services.auth.requestPasswordReset);
  const reset = useMutation(services.auth.resetPassword);

  async function sendCode() {
    setProblem(null);
    if (!isEmail(email)) {
      setProblem('Digite o e-mail da sua conta.');
      return;
    }
    const result = await request.run(email);
    if (result.ok) {
      setResendAt(Date.now() + RESEND_WAIT_MS);
      setStep('code');
    }
  }

  async function changePassword() {
    const missing = resetFormProblem(code, password, confirmation);
    setProblem(missing);
    if (missing) return;
    const result = await reset.run({ email, code, newPassword: password });
    if (result.ok) {
      setFlash('Senha trocada. Entre com a senha nova.');
      navigation.replace('Login', { email: email.trim() });
    }
  }

  const error = step === 'email' ? request.error : (reset.error ?? request.error);

  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: colors.background }]}>
      <StackHeader title="Esqueci minha senha" subtitle="Crie uma senha nova com um código enviado ao seu e-mail" />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
        {step === 'email' ? (
          <Card style={styles.card}>
            <AppText variant="heading" accessibilityRole="header">Qual é o e-mail da conta?</AppText>
            <TextField
              label="E-mail"
              value={email}
              onChangeText={(t) => {
                setProblem(null);
                setEmail(t);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              onSubmitEditing={() => void sendCode()}
            />
            <Button title="Enviar código" icon={Send} size="lg" loading={request.loading} onPress={() => void sendCode()} />
          </Card>
        ) : (
          <Card style={styles.card}>
            <AppText variant="heading" accessibilityRole="header">Digite o código e a senha nova</AppText>
            <AppText>
              Se houver uma conta com <AppText variant="bodyStrong">{email.trim()}</AppText>, enviamos para ele um código de 6
              números. O código vale por 15 minutos.
            </AppText>
            {IS_DEMO ? <AppText variant="caption" muted>Demonstração: o código é {DEMO_EMAIL_CODE}.</AppText> : null}
            <TextField
              label="Código do e-mail"
              value={code}
              onChangeText={(t) => {
                setProblem(null);
                if (reset.error) reset.clearError();
                setCode(onlyCodeDigits(t));
              }}
              keyboardType="number-pad"
              maxLength={6}
              large
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              placeholder="000000"
            />
            <TextField label="Senha nova" value={password} onChangeText={setPassword} password autoComplete="new-password" textContentType="newPassword" />
            <PasswordStrengthMeter password={password} />
            <TextField label="Confirmar senha nova" value={confirmation} onChangeText={setConfirmation} password onSubmitEditing={() => void changePassword()} />
            <Button title="Trocar senha" icon={KeyRound} size="lg" loading={reset.loading} onPress={() => void changePassword()} />
            <Button
              title={resendLabel(secondsLeft)}
              icon={RotateCw}
              variant="secondary"
              disabled={secondsLeft > 0}
              loading={request.loading}
              onPress={() => {
                reset.clearError();
                void sendCode();
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Usar outro e-mail"
              hitSlop={10}
              style={styles.link}
              onPress={() => {
                setStep('email');
                setCode('');
                setProblem(null);
                reset.clearError();
              }}
            >
              <AppText variant="bodyStrong" color={colors.primary}>Usar outro e-mail</AppText>
            </Pressable>
            <AppText variant="caption" muted>Não chegou? Confira a caixa de spam ou de lixo eletrônico.</AppText>
          </Card>
        )}

        {problem || error ? (
          <View style={[styles.error, { backgroundColor: colors.dangerSoft }]} accessibilityRole="alert">
            <AppText variant="bodyStrong" color={colors.danger}>{problem ?? error?.message}</AppText>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: spacing.lg, gap: spacing.lg },
  card: { gap: spacing.md },
  link: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
  error: { borderRadius: radius.md, padding: spacing.md },
});
