import { zodResolver } from '@hookform/resolvers/zod';
import { UserPlus } from 'lucide-react-native';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootScreenProps } from '../../app/navigation/types';
import { StackHeader } from '../../components/layout/StackHeader';
import { SwitchProfileLink } from '../../components/layout/SwitchProfileLink';
import { AppText, Button, Card, Checkbox, FormTextField } from '../../components/ui';
import { services } from '../../services';
import { useAppStore } from '../../store/appStore';
import { applyFieldErrors, mapFieldErrors } from '../../lib/formErrors';
import { signUpSchema, type SignUpValues } from '../../lib/schemas';
import { useMutation } from '../../lib/useQuery';
import { radius, spacing, useTheme } from '../../theme';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';

const SIGN_UP_FIELDS = ['name', 'email', 'phone', 'password', 'lgpdConsent'] as const;

/** T02 — Cadastro do cuidador com consentimento LGPD obrigatório. */
export function SignUpScreen({ navigation }: RootScreenProps<'SignUp'>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const setSession = useAppStore((s) => s.setSession);
  const showToast = useAppStore((s) => s.showToast);
  const { control, handleSubmit, watch, setError } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', email: '', phone: '', password: '', confirmPassword: '', lgpdConsent: false },
  });
  const signUp = useMutation(services.auth.signUp);
  // react-hook-form não é compatível com o React Compiler (só aviso; o projeto não usa o compilador).
  // eslint-disable-next-line react-hooks/incompatible-library
  const consent = watch('lgpdConsent');
  const password = watch('password');

  const onSubmit = handleSubmit(async (v) => {
    const session = await signUp.mutate({ name: v.name, email: v.email, phone: v.phone, password: v.password, lgpdConsent: v.lgpdConsent });
    if (session) {
      showToast('Conta criada. Bem-vinda!');
      setSession(session);
    }
  });

  // Erros da API mostrados nos campos: e-mail duplicado (codigo EMAIL_DUPLICADO) e validação por campo (campos[])
  const duplicateEmail = signUp.error?.code === 'EMAIL_DUPLICADO';
  const inlineError = duplicateEmail || mapFieldErrors<SignUpValues>(signUp.error, SIGN_UP_FIELDS).length > 0;
  useEffect(() => {
    if (!signUp.error) return;
    if (signUp.error.code === 'EMAIL_DUPLICADO') setError('email', { message: signUp.error.message });
    else applyFieldErrors(setError, signUp.error, SIGN_UP_FIELDS);
  }, [signUp.error, setError]);

  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: colors.background }]}>
      <StackHeader title="Criar conta" subtitle="Cadastro de cuidador ou familiar" />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
        <AppText muted>Depois do cadastro, você poderá vincular os pacientes sob seus cuidados.</AppText>

        <Card style={styles.card}>
          <AppText variant="heading" accessibilityRole="header">Dados pessoais</AppText>
          <FormTextField control={control} name="name" label="Nome completo" required autoComplete="name" />
          <FormTextField
            control={control}
            name="email"
            label="E-mail"
            required
            keyboardType="email-address"
            autoCapitalize="none"
            hint="Usado para entrar. Cada e-mail só pode ter uma conta (RN01)."
          />
          <FormTextField control={control} name="phone" label="Telefone de contato" mask="phone" keyboardType="phone-pad" placeholder="(61) 99999-9999" />
        </Card>

        <Card style={styles.card}>
          <AppText variant="heading" accessibilityRole="header">Segurança</AppText>
          <FormTextField control={control} name="password" label="Senha" required password autoComplete="new-password" />
          <PasswordStrengthMeter password={password} />
          <FormTextField control={control} name="confirmPassword" label="Confirmar senha" required password />
        </Card>

        <Card style={styles.card}>
          <AppText variant="heading" accessibilityRole="header">Termos e consentimento</AppText>
          <Controller
            control={control}
            name="lgpdConsent"
            render={({ field, fieldState }) => (
              <>
                <Checkbox
                  checked={field.value}
                  onChange={field.onChange}
                  error={!!fieldState.error}
                  accessibilityLabel="Concordo com os Termos de Uso e autorizo o tratamento dos meus dados conforme a LGPD"
                >
                  <AppText>
                    Concordo com os{' '}
                    <AppText color={colors.primary} style={styles.underline} onPress={() => navigation.navigate('Legal', { doc: 'termos' })} accessibilityRole="link">
                      Termos de Uso
                    </AppText>{' '}
                    e autorizo o tratamento dos meus dados pessoais conforme a{' '}
                    <AppText color={colors.primary} style={styles.underline} onPress={() => navigation.navigate('Legal', { doc: 'lgpd' })} accessibilityRole="link">
                      Política LGPD
                    </AppText>{' '}
                    (Lei nº 13.709/2018).
                  </AppText>
                </Checkbox>
                {fieldState.error ? <AppText variant="caption" color={colors.danger}>{fieldState.error.message}</AppText> : null}
              </>
            )}
          />
          <View style={[styles.notice, { backgroundColor: colors.infoSoft }]}>
            <AppText variant="caption" color={colors.primaryDark}>
              Os avisos de dose não confirmada contêm o nome do paciente, o remédio e o horário, e passam pelo serviço de
              notificações do Google (Firebase Cloud Messaging) até chegar ao seu celular.
            </AppText>
          </View>
        </Card>

        {signUp.error && !inlineError ? (
          <View style={[styles.error, { backgroundColor: colors.dangerSoft }]} accessibilityRole="alert">
            <AppText variant="bodyStrong" color={colors.danger}>{signUp.error.message}</AppText>
          </View>
        ) : null}

        <Button
          title="Criar minha conta"
          icon={UserPlus}
          size="lg"
          onPress={onSubmit}
          loading={signUp.loading}
          disabled={!consent}
          accessibilityHint={consent ? undefined : 'Disponível depois de aceitar os termos'}
        />
        <SwitchProfileLink />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: spacing.lg, gap: spacing.lg },
  card: { gap: spacing.md },
  underline: { textDecorationLine: 'underline', fontFamily: 'NunitoSans_700Bold' },
  notice: { borderRadius: radius.md, padding: spacing.md },
  error: { borderRadius: radius.md, padding: spacing.md },
});
