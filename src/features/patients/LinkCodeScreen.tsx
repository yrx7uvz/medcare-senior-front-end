import CheckCircle2 from 'lucide-react-native/icons/circle-check';
import KeyRound from 'lucide-react-native/icons/key-round';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import Smartphone from 'lucide-react-native/icons/smartphone';
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
  const { patientId, justCreated } = route.params;
  const patient = useQuery(['patient', patientId], () => services.patients.get(patientId));
  const active = useQuery(['link-code', patientId], () => services.patients.getActiveLinkCode(patientId));
  const generate = useMutation(services.patients.generateLinkCode);
  const [fresh, setFresh] = useState<LinkCode | null>(null);
  const newCode = async () => {
    const created = await generate.mutate(patientId);
    if (created) setFresh(created);
  };

  // Recém-cadastrado: gera o código automaticamente.
  // As dependências são só [justCreated, active.data] de propósito: incluir newCode/fresh/generate.loading
  // faria o efeito rodar de novo quando a geração falha (fresh continua null e loading volta a false),
  // tentando gerar código em laço. O efeito deve disparar apenas quando o código ativo termina de carregar.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- newCode é assíncrono e protegido pelas condições acima; regra do React Compiler, que o projeto não usa
    if (justCreated && active.data === null && !fresh && !generate.loading) void newCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ver comentário acima: evita laço de geração em caso de falha
  }, [justCreated, active.data]);

  const link = generate.loading ? undefined : fresh ?? active.data;
  const name = patient.data?.name ?? '';

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <StackHeader title={justCreated ? 'Paciente cadastrado' : 'Código de vínculo'} subtitle={name} />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]}>
        {justCreated ? (
          <View style={styles.success} accessibilityLiveRegion="polite">
            <CheckCircle2 color={colors.status.CONFIRMADA_NO_HORARIO.fg} size={28} />
            <AppText variant="heading" style={styles.flex}>
              {name} agora está na sua conta. Só você tem acesso aos dados.
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
            <LinkCodeDisplay link={link} patientName={name} />
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
          <AppText>3. A pessoa cria um PIN de 4 números, guardado só nesse celular.</AppText>
          <AppText variant="caption" muted>
            Por segurança, depois de 5 tentativas erradas em 15 minutos o celular fica bloqueado por um tempo.
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
