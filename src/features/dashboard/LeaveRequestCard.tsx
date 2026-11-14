import Check from 'lucide-react-native/icons/check';
import LogOut from 'lucide-react-native/icons/log-out';
import X from 'lucide-react-native/icons/x';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Button, ConfirmDialog } from '../../components/ui';
import { services } from '../../services';
import { useAppStore } from '../../store/appStore';
import { formatTime } from '../../lib/date';
import { AUTHORIZE_CONFIRM_MESSAGE, pendingCardTitle } from '../../lib/leaveRequest';
import { useMutation } from '../../lib/useQuery';
import type { PendingLeaveRequest } from '../../types/domain';
import { radius, spacing, useTheme } from '../../theme';

interface Props {
  request: PendingLeaveRequest;
  /** Depois de decidir (autorizado ou recusado). */
  onDecided?: () => void;
}

/**
 * Pedido de um paciente para sair da conta, em destaque: Autorizar (com confirmação, porque desconecta o celular dele)
 * ou Recusar. O texto diz o que é; a cor só reforça.
 */
export function LeaveRequestCard({ request, onDecided }: Props) {
  const { colors } = useTheme();
  const showToast = useAppStore((s) => s.showToast);
  const [confirming, setConfirming] = useState(false);
  const approve = useMutation(services.leaveRequests.approve);
  const deny = useMutation(services.leaveRequests.deny);
  const error = approve.error ?? deny.error;
  const title = pendingCardTitle(request.patientName);

  async function onApprove() {
    const result = await approve.run(request.patientId, request.id);
    setConfirming(false);
    if (result.ok) {
      showToast(`${request.patientName} saiu da conta. Para voltar, gere um código novo.`);
      onDecided?.();
    }
  }

  async function onDeny() {
    const result = await deny.run(request.patientId, request.id);
    if (result.ok) {
      showToast(`Pedido recusado. ${request.patientName} continua conectado.`, 'info');
      onDecided?.();
    }
  }

  return (
    <View style={[styles.wrap, { backgroundColor: colors.warningSoft, borderColor: colors.warningText }]}>
      <View style={styles.head} accessible accessibilityRole="header" accessibilityLabel={`${title}, pedido das ${formatTime(new Date(request.createdAt))}`}>
        <LogOut color={colors.warningText} size={24} />
        <View style={styles.flex}>
          <AppText variant="heading" color={colors.warningText}>
            {title}
          </AppText>
          <AppText variant="caption" color={colors.warningText}>
            Pedido às {formatTime(new Date(request.createdAt))}. Só sai com a sua autorização.
          </AppText>
        </View>
      </View>
      {error ? (
        <AppText color={colors.danger} accessibilityRole="alert">
          {error.message}
        </AppText>
      ) : null}
      <View style={styles.actions}>
        <Button title="Autorizar" icon={Check} style={styles.flex} onPress={() => setConfirming(true)} disabled={deny.loading} />
        <Button title="Recusar" icon={X} variant="secondary" style={styles.flex} loading={deny.loading} onPress={() => void onDeny()} />
      </View>
      <ConfirmDialog
        visible={confirming}
        title={`Autorizar a saída de ${request.patientName}?`}
        message={AUTHORIZE_CONFIRM_MESSAGE}
        confirmLabel="Autorizar saída"
        icon={LogOut}
        tone="danger"
        loading={approve.loading}
        onConfirm={() => void onApprove()}
        onCancel={() => setConfirming(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { borderWidth: 2, borderRadius: radius.lg, padding: spacing.md, gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
