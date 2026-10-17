import { CheckCircle2, KeyRound, RefreshCw, Smartphone } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootScreenProps } from '../../app/navigation/types';
import { StackHeader } from '../../components/layout/StackHeader';
import { AppText, Button, Card, EmptyState, ErrorState, LoadingSkeleton } from '../../components/ui';
import { services } from '../../services';
import { firstName } from '../../lib/date';
import { useMutation, useQuery } from '../../lib/useQuery';
import type { LinkCode } from '../../types/domain';
import { spacing, useTheme } from '../../theme';
import { LinkCodeDisplay } from './LinkCodeDisplay';

/** Exibe o código ativo do paciente ou gera um novo. */
export function LinkCodeScreen({ route, navigation }: RootScreenProps<'LinkCode'>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { elderId, justCreated } = route.params;
  const elder = useQuery(['elder', elderId], () => services.elders.get(elderId));
  const active = useQuery(['link-code', elderId], () => services.elders.getActiveLinkCode(elderId));
  const generate = useMutation(services.elders.generateLinkCode);
  const [fresh, setFresh] = useState<LinkCode | null>(null);
  const newCode = async () => {
    const created = await generate.mutate(elderId);
    if (created) setFresh(created);
  };

  // Recém-cadastrado: gera o código automaticamente.
  useEffect(() => {
    if (justCreated && active.data === null && !fresh && !generate.loading) newCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justCreated, active.data]);

  const link = generate.loading ? undefined : fresh ?? active.data;
  const name = elder.data?.name ?? '';

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <StackHeader title={justCreated ? 'Paciente cadastrado' : 'Código de vínculo'} subtitle={name} />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]}>
        {justCreated ? (
          <View style={styles.success} accessibilityLiveRegion="polite">
            <CheckCircle2 color={colors.status.TOMADA.fg} size={28} />
            <AppText variant="heading" style={styles.flex}>
              {name} foi vinculado(a) à sua conta. Só você tem acesso aos dados (RN04).
            </AppText>
          </View>
        ) : null}

        <Card style={styles.card}>
          <View style={styles.titleRow}>
            <KeyRound color={colors.primary} size={22} />
            <AppText variant="title">Código para o celular de {firstName(name) || 'paciente'}</AppText>
          </View>
          {(active.loading && !fresh) || generate.loading ? (
            <LoadingSkeleton rows={1} />
          ) : active.error ? (
            <ErrorState error={active.error} onRetry={active.reload} />
          ) : link ? (
            <LinkCodeDisplay link={link} elderName={name} />
          ) : (
            <EmptyState
              icon={KeyRound}
              title="Nenhum código ativo"
              description="Gere um código e digite-o no celular do paciente."
            />
          )}
          {generate.error ? <AppText color={colors.danger}>{generate.error.message}</AppText> : null}
          <Button
            title={link ? 'Gerar novo código' : 'Gerar código'}
            icon={RefreshCw}
            variant={link ? 'secondary' : 'primary'}
            loading={generate.loading}
            onPress={newCode}
          />
        </Card>

        <Card tone="alt" style={styles.card}>
          <View style={styles.titleRow}>
            <Smartphone color={colors.primary} size={20} />
            <AppText variant="heading">Como conectar</AppText>
          </View>
          <AppText>1. Abra o MedCare Sênior no celular do paciente.</AppText>
          <AppText>2. Digite os 6 números do código.</AppText>
          <AppText>3. O paciente cria um PIN de 4 números, guardado só no aparelho dele.</AppText>
          <AppText variant="caption" muted>
            Por segurança, depois de 5 tentativas erradas em 15 minutos o celular fica bloqueado por um tempo (RN12).
          </AppText>
        </Card>

        {justCreated ? (
          <Button title="Cadastrar remédio para este paciente" onPress={() => navigation.replace('MedicationForm', undefined)} />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: spacing.lg, gap: spacing.lg },
  card: { gap: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  success: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
