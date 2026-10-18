import { zodResolver } from '@hookform/resolvers/zod';
import { LogIn, ShieldCheck, UserRoundCheck } from 'lucide-react-native';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootScreenProps } from '../../app/navigation/types';
import { AppText, Button, Card, FormTextField } from '../../components/ui';
import { OfflineBanner } from '../../components/layout/OfflineBanner';
import { SwitchProfileLink } from '../../components/layout/SwitchProfileLink';
import { IS_DEMO } from '../../config/env';
import { services } from '../../services';
import { useAppStore } from '../../store/appStore';
import { loginSchema, type LoginValues } from '../../lib/schemas';
import { useMutation } from '../../lib/useQuery';
import { radius, spacing, useTheme } from '../../theme';
import { Logo } from './Logo';

/** T01 — Login do cuidador. Erro idêntico para e-mail inexistente e senha incorreta. */
export function LoginScreen({ navigation, route }: RootScreenProps<'Login'>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const setSession = useAppStore((s) => s.setSession);
  const flash = useAppStore((s) => s.flash);
  const setFlash = useAppStore((s) => s.setFlash);
  const [forgot, setForgot] = useState(false);
  const { control, handleSubmit } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: route.params?.email ?? '', password: '' } });
  const login = useMutation(services.auth.login);
  const demo = useMutation(services.auth.loginDemo);

  const onSubmit = handleSubmit(async (v) => {
    setFlash(null);
    const session = await login.mutate(v.email, v.password);
    if (session) setSession(session);
  });

  const error = login.error ?? demo.error;

  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: colors.background }]} behavior={undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }} keyboardShouldPersistTaps="handled">
        <View style={[styles.hero, { backgroundColor: colors.header, paddingTop: insets.top + spacing.xxl }]}>
          <Logo light />
          <AppText variant="body" color={colors.onHeaderMuted}>
            Controle de medicamentos para pacientes
          </AppText>
        </View>
        <OfflineBanner />

        <View style={styles.body}>
          {flash ? (
            <Card tone="alt" style={styles.flash}>
              <AppText>{flash}</AppText>
            </Card>
          ) : null}

          <Card style={styles.card}>
            <AppText variant="title" accessibilityRole="header">
              Entrar na conta
            </AppText>
            <FormTextField control={control} name="email" label="E-mail" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
            <FormTextField control={control} name="password" label="Senha" password autoComplete="password" textContentType="password" onSubmitEditing={onSubmit} />
            <Pressable accessibilityRole="link" onPress={() => setForgot((f) => !f)} style={styles.link} hitSlop={8}>
              <AppText variant="label" color={colors.primary}>
                Esqueci a senha
              </AppText>
            </Pressable>
            {forgot ? (
              <AppText variant="caption" muted>
                {IS_DEMO
                  ? 'A recuperação de senha por e-mail entra junto com a API. Neste protótipo, use a conta de demonstração.'
                  : 'A recuperação de senha por e-mail ainda não está disponível.'}
              </AppText>
            ) : null}
            {error ? (
              <View style={[styles.error, { backgroundColor: colors.dangerSoft }]} accessibilityRole="alert">
                <AppText variant="bodyStrong" color={colors.danger}>
                  {error.message}
                </AppText>
              </View>
            ) : null}
            <Button title="Entrar" icon={LogIn} onPress={onSubmit} loading={login.loading} size="lg" />
          </Card>

          {IS_DEMO ? (
            <Button
              title="Usar conta de demonstração (Maria)"
              variant="secondary"
              icon={UserRoundCheck}
              loading={demo.loading}
              onPress={async () => {
                setFlash(null);
                const s = await demo.mutate();
                if (s) setSession(s);
              }}
            />
          ) : null}

          <View style={styles.signup}>
            <AppText muted>Primeira vez?</AppText>
            <Pressable accessibilityRole="link" onPress={() => navigation.navigate('SignUp')} hitSlop={10} style={styles.link}>
              <AppText variant="bodyStrong" color={colors.primary}>
                Criar conta de cuidador
              </AppText>
            </Pressable>
          </View>

          <SwitchProfileLink />

          <View style={[styles.lgpd, { borderColor: colors.border }]}>
            <ShieldCheck color={colors.status.TOMADA.fg} size={18} />
            <AppText variant="caption" muted>
              Dados protegidos conforme a LGPD
            </AppText>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl + spacing.xl, gap: spacing.sm, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl },
  body: { paddingHorizontal: spacing.lg, gap: spacing.lg, marginTop: -spacing.xxl },
  card: { gap: spacing.md },
  flash: { marginBottom: -spacing.sm },
  link: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
  error: { borderRadius: radius.md, padding: spacing.md },
  signup: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  lgpd: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
});
