import CheckCircle2 from 'lucide-react-native/icons/circle-check';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootScreenProps } from '../../app/navigation/types';
import { StackHeader } from '../../components/layout/StackHeader';
import { Button, EmptyState, ErrorState, LoadingSkeleton } from '../../components/ui';
import { services } from '../../services';
import { useQuery } from '../../lib/useQuery';
import { spacing, useTheme } from '../../theme';
import { LeaveRequestCard } from './LeaveRequestCard';

/**
 * Pedido de saída aberto pelo toque no aviso (app aberto, em segundo plano ou fechado). Se já não estiver pendente
 * (decidido em outro aparelho, cancelado pelo paciente ou vencido), diz isso e leva ao Painel.
 */
export function LeaveRequestScreen({ route, navigation }: RootScreenProps<'LeaveRequest'>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { requestId } = route.params;
  const pending = useQuery(['leave-requests'], () => services.leaveRequests.listPending());
  const request = pending.data?.find((r) => r.id === requestId);
  const toPanel = () => navigation.navigate('CaregiverTabs', { screen: 'Painel' });

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <StackHeader title="Pedido para sair do app" subtitle={request?.patientName} />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]}>
        {pending.loading ? (
          <LoadingSkeleton rows={1} />
        ) : pending.error ? (
          <ErrorState error={pending.error} onRetry={pending.reload} />
        ) : request ? (
          <LeaveRequestCard request={request} onDecided={toPanel} />
        ) : (
          <EmptyState
            icon={CheckCircle2}
            title="Este pedido já não está aguardando"
            description="Ele foi decidido, cancelado pelo paciente ou passou do prazo."
          />
        )}
        <Button title="Ir para o Painel" variant="secondary" onPress={toPanel} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: spacing.lg, gap: spacing.lg },
});
