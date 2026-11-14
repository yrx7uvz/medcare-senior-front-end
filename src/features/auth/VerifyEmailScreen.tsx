import LogOut from 'lucide-react-native/icons/log-out';
import MailCheck from 'lucide-react-native/icons/mail-check';
import RotateCw from 'lucide-react-native/icons/rotate-cw';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OfflineBanner } from '../../components/layout/OfflineBanner';
import { AppText, Button, Card, TextField } from '../../components/ui';
import { services } from '../../services';
import { useAppStore } from '../../store/appStore';
import { onlyCodeDigits } from '../../lib/emailCode';
import { logoutCaregiver } from '../../lib/session';
import { useMutation } from '../../lib/useQuery';
import { RESEND_WAIT_MS, resendLabel, useSecondsLeft } from '../../lib/useSecondsLeft';
import { radius, spacing, useTheme } from '../../theme';
import { Logo } from './Logo';

/**
 * Confirmação do e-mail do cuidador: o código de 6 números enviado no cadastro (ou por "Reenviar código"). Enquanto não
 * confirmar, é a única tela do cuidador: a API não deixa cadastrar pacientes sem isso. "Usar outro e-mail" sai da conta.
 */
export function VerifyEmailScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const session = useAppStore((s) => s.session);
  const setSession = useAppStore((s) => s.setSession);
  const showToast = useAppStore((s) => s.showToast);
  const [code, setCode] = useState('');
  // O cadastro (ou o login) acabou de enviar um código: o próximo só depois de 1 minuto
  const [resendAt, setResendAt] = useState<number | null>(() => Date.now() + RESEND_WAIT_MS);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const secondsLeft = useSecondsLeft(resendAt);
  const confirm = useMutation(services.auth.confirmEmail);
  const resend = useMutation(services.auth.resendEmailCode);

  async function submit() {
    if (!session) return;
    const result = await confirm.run(code);
    if (result.ok) {
      showToast('E-mail confirmado. Boas-vindas!');
      setSession({ ...session, emailVerified: true });
    }
  }

  async function resendCode() {
    setResendMessage(null);
    confirm.clearError();
    const result = await resend.run();
    if (result.ok) {
      setResendAt(Date.now() + RESEND_WAIT_MS);
      setCode('');
      setResendMessage('Enviamos um código novo. O anterior não vale mais.');
    } else if (result.error.status === 429 && result.error.retryAfterSec) {
      setResendAt(Date.now() + result.error.retryAfterSec * 1000);
    }
  }

  const error = confirm.error ?? (resend.error && resend.error.status !== 429 ? resend.error : undefined);

  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }} keyboardShouldPersistTaps="handled">
        <View style={[styles.hero, { backgroundColor: colors.header, paddingTop: insets.top + spacing.xxl }]}>
          <Logo light />
        </View>
        <OfflineBanner />

        <View style={styles.body}>
          <Card style={styles.card}>
            <View style={styles.titleRow}>
              <MailCheck color={colors.primary} size={28} />
              <AppText variant="title" accessibilityRole="header" style={styles.flex}>
                Confirme seu e-mail
              </AppText>
            </View>
            <AppText>
              Enviamos um código de 6 números para{' '}
              <AppText variant="bodyStrong">{session?.email ?? 'o seu e-mail'}</AppText>. Digite-o abaixo para começar a cadastrar
              quem você cuida.
            </AppText>
            <TextField
              label="Código do e-mail"
              value={code}
              onChangeText={(t) => {
                if (confirm.error) confirm.clearError();
                setCode(onlyCodeDigits(t));
              }}
              keyboardType="number-pad"
              maxLength={6}
              large
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              placeholder="000000"
              onSubmitEditing={() => {
                if (code.length === 6) void submit();
              }}
            />
            {error ? (
              <View style={[styles.message, { backgroundColor: colors.dangerSoft }]} accessibilityRole="alert">
                <AppText variant="bodyStrong" color={colors.danger}>
                  {error.message}
                </AppText>
              </View>
            ) : null}
            {resendMessage ? (
              <View style={[styles.message, { backgroundColor: colors.infoSoft }]} accessibilityRole="alert">
                <AppText color={colors.primaryDark}>{resendMessage}</AppText>
              </View>
            ) : null}
            <Button title="Confirmar e-mail" icon={MailCheck} size="lg" disabled={code.length !== 6} loading={confirm.loading} onPress={() => void submit()} />
            <Button
              title={resendLabel(secondsLeft)}
              icon={RotateCw}
              variant="secondary"
              disabled={secondsLeft > 0}
              loading={resend.loading}
              onPress={() => void resendCode()}
            />
            <AppText variant="caption" muted>
              O código vale por 15 minutos. Não chegou? Confira a caixa de spam ou de lixo eletrônico.
            </AppText>
          </Card>

          <Button
            title="Usar outro e-mail (sair desta conta)"
            icon={LogOut}
            variant="ghost"
            onPress={() => void logoutCaregiver()}
            accessibilityHint="Sai desta conta para entrar ou criar uma conta com outro e-mail"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl + spacing.xl, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl },
  body: { paddingHorizontal: spacing.lg, gap: spacing.lg, marginTop: -spacing.xxl },
  card: { gap: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  message: { borderRadius: radius.md, padding: spacing.md },
});
