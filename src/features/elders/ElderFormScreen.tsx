import { zodResolver } from '@hookform/resolvers/zod';
import { Info, UserPlus } from 'lucide-react-native';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootScreenProps } from '../../app/navigation/types';
import { StackHeader } from '../../components/layout/StackHeader';
import { AppText, Button, Card, FormTextField } from '../../components/ui';
import { services } from '../../services';
import { useAppStore } from '../../store/appStore';
import { ageOn, dateBRToKey, toDateKey } from '../../lib/date';
import { elderSchema, type ElderValues } from '../../lib/schemas';
import { useMutation } from '../../lib/useQuery';
import { useNow } from '../../lib/useNow';
import { radius, spacing, useTheme } from '../../theme';

/** T04 — Cadastrar paciente. Aviso (não bloqueio) para menos de 60 anos; RN03. */
export function ElderFormScreen({ navigation }: RootScreenProps<'ElderForm'>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const now = useNow(60_000);
  const setSelected = useAppStore((s) => s.setSelectedElder);
  const { control, handleSubmit, watch, setError } = useForm<ElderValues>({
    resolver: zodResolver(elderSchema),
    defaultValues: { name: '', birthDate: '', phone: '' },
  });
  const create = useMutation(services.elders.create);
  const birth = watch('birthDate');
  const birthKey = dateBRToKey(birth);
  const age = birthKey ? ageOn(birthKey, now) : null;
  const future = birthKey ? birthKey > toDateKey(now) : false;

  const duplicate = create.error?.code === 'IDOSO_DUPLICADO';
  useEffect(() => {
    if (duplicate && create.error) setError('name', { message: create.error.message });
  }, [duplicate, create.error, setError]);

  const onSubmit = handleSubmit(async (v) => {
    const key = dateBRToKey(v.birthDate);
    if (!key || future) {
      setError('birthDate', { message: 'A data de nascimento não pode estar no futuro' });
      return;
    }
    const elder = await create.mutate({ name: v.name, birthDate: key, phone: v.phone || undefined });
    if (elder) {
      setSelected(elder.id);
      navigation.replace('LinkCode', { elderId: elder.id, justCreated: true });
    }
  });

  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: colors.background }]}>
      <StackHeader title="Cadastrar paciente" subtitle="Vinculado ao seu perfil" />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <AppText variant="heading" accessibilityRole="header">Dados do paciente</AppText>
          <FormTextField control={control} name="name" label="Nome completo" required autoCapitalize="words" />
          <FormTextField control={control} name="birthDate" label="Data de nascimento" required mask="date" keyboardType="number-pad" placeholder="DD/MM/AAAA" />
          {age !== null && age >= 0 && age < 60 && !future ? (
            <View style={[styles.warn, { backgroundColor: colors.warningSoft }]} accessibilityLiveRegion="polite">
              <Info color={colors.warningText} size={18} />
              <AppText variant="caption" color={colors.warningText} style={styles.flex}>
                Este paciente tem {age} anos. O app foi pensado para pessoas idosas, mas você pode continuar.
              </AppText>
            </View>
          ) : null}
          <FormTextField control={control} name="phone" label="Telefone de contato" mask="phone" keyboardType="phone-pad" placeholder="(61) 99999-9999" />
        </Card>

        <AppText variant="caption" muted>
          O paciente fica vinculado à sua conta e só você terá acesso aos dados dele (RN04). Não é possível cadastrar duas vezes o
          mesmo nome com a mesma data de nascimento (RN03).
        </AppText>

        {create.error && !duplicate ? (
          <AppText color={colors.danger} accessibilityRole="alert">{create.error.message}</AppText>
        ) : null}

        <Button title="Cadastrar e gerar código de vínculo" icon={UserPlus} size="lg" onPress={onSubmit} loading={create.loading} />
        <Button title="Cancelar" variant="ghost" onPress={() => navigation.goBack()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: spacing.lg, gap: spacing.lg },
  card: { gap: spacing.md },
  warn: { flexDirection: 'row', gap: spacing.sm, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
});
