import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Ban from 'lucide-react-native/icons/ban';
import Hourglass from 'lucide-react-native/icons/hourglass';
import Info from 'lucide-react-native/icons/info';
import LogOut from 'lucide-react-native/icons/log-out';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import WifiOff from 'lucide-react-native/icons/wifi-off';
import X from 'lucide-react-native/icons/x';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { RootScreenProps } from '../../app/navigation/types';
import { PatientScreen } from '../../components/layout/PatientScreen';
import { AppText, BigActionButton, Card } from '../../components/ui';
import type { IconComponent } from '../../components/ui';
import { services } from '../../services';
import { useAppStore } from '../../store/appStore';
import { getNow } from '../../lib/clock';
import {
  initialLeaveView,
  LEAVE_MESSAGES,
  LEAVE_POLL_MS,
  leaveViewFrom,
  shouldPollLeave,
  waitingTitle,
  type LeaveView,
} from '../../lib/leaveRequest';
import { leavePatientAccount } from '../../lib/session';
import { useQuery } from '../../lib/useQuery';
import { usePolling, useScreenActive } from '../../lib/useScreenActivity';
import { radius, spacing, useTheme } from '../../theme';

/** Erro de serviço (AppError) ou qualquer outra falha, no formato que a regra pura entende. */
const asError = (e: unknown) => (e && typeof e === 'object' ? (e as { kind?: string; status?: number; code?: string }) : {});

/**
 * Saída da conta pelo paciente: explica que o cuidador precisa autorizar, pede, espera (consulta a cada poucos segundos
 * só enquanto esta tela está aberta e o app em primeiro plano) e mostra o resultado. Autorizado: limpa a sessão e
 * volta ao pareamento com a mensagem da autorização.
 */
export function PatientLeaveScreen({ navigation }: RootScreenProps<'PatientLeave'>) {
  const { colors } = useTheme();
  const patientId = useAppStore((s) => s.patientSession?.patientId ?? '');
  const setLeaveRequested = useAppStore((s) => s.setPatientLeaveRequested);
  const profile = useQuery(['patient-profile', patientId], () => services.patients.getProfile(patientId));
  const caregiver = profile.data?.caregiverFirstName ?? 'quem cuida de você';
  const [view, setView] = useState<LeaveView | null>(null);
  const [busy, setBusy] = useState(false);
  const active = useScreenActive();

  const show = useCallback(
    (next: LeaveView) => {
      // Enquanto espera, um 401 da API é a autorização chegando (a mensagem do pareamento diz isso)
      setLeaveRequested(next.kind === 'aguardando' || next.kind === 'saiu');
      setView(next);
      if (next.kind === 'saiu') void leavePatientAccount();
    },
    [setLeaveRequested],
  );

  const check = useCallback(async (first: boolean) => {
    try {
      const request = await services.leaveRequests.current(patientId);
      const next = leaveViewFrom({ request }, getNow().getTime());
      show(first ? initialLeaveView(next) : next);
    } catch (e) {
      show(leaveViewFrom({ error: asError(e) }, getNow().getTime()));
    }
  }, [patientId, show]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- consulta o servidor ao abrir (sistema externo; o estado muda na resposta); regra do React Compiler, que o projeto não usa
    void check(true);
  }, [check]);

  usePolling(() => void check(false), LEAVE_POLL_MS, active && !!view && shouldPollLeave(view));

  async function ask() {
    setBusy(true);
    try {
      const request = await services.leaveRequests.request(patientId);
      show(leaveViewFrom({ request }, getNow().getTime()));
    } catch (e) {
      show(leaveViewFrom({ error: asError(e) }, getNow().getTime()));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      await services.leaveRequests.cancel(patientId);
      await check(false);
    } catch (e) {
      show(leaveViewFrom({ error: asError(e) }, getNow().getTime()));
    } finally {
      setBusy(false);
    }
  }

  const backHome = (
    <BigActionButton title="VOLTAR AO INÍCIO" icon={ArrowLeft} variant="outline" onPress={() => navigation.goBack()} />
  );

  let body: React.ReactNode;
  let footer: React.ReactNode = null;
  if (!view || view.kind === 'saiu') {
    body = (
      <View style={styles.center} accessibilityLiveRegion="polite">
        <ActivityIndicator size="large" color={colors.primary} />
        <AppText variant="patientBody" align="center">
          {view ? 'Saindo da conta…' : 'Carregando…'}
        </AppText>
      </View>
    );
  } else if (view.kind === 'explicar') {
    body = (
      <Notice icon={Info} title="Sair da conta" text={LEAVE_MESSAGES.explanation} detail={`Quando ${caregiver} autorizar, este celular sai da conta. Para voltar, será preciso um código novo.`} />
    );
    footer = (
      <>
        <BigActionButton
          title="PEDIR PARA SAIR"
          icon={LogOut}
          variant="primary"
          loading={busy}
          onPress={() => void ask()}
          accessibilityHint={`Envia o pedido para ${caregiver}`}
        />
        {backHome}
      </>
    );
  } else if (view.kind === 'aguardando') {
    body = (
      <Notice
        icon={Hourglass}
        title={waitingTitle(caregiver)}
        text={`Avisamos ${caregiver}. Assim que autorizar, este celular sai da conta.`}
        detail="Pode deixar esta tela aberta: ela se atualiza sozinha."
      />
    );
    footer = (
      <>
        <BigActionButton title="CANCELAR PEDIDO" icon={X} variant="outline" loading={busy} onPress={() => void cancel()} />
        {backHome}
      </>
    );
  } else if (view.kind === 'erro-rede') {
    body = <Notice icon={WifiOff} title="Sem conexão" text={view.message} />;
    footer = (
      <>
        <BigActionButton title="TENTAR DE NOVO" icon={RefreshCw} variant="primary" onPress={() => void check(false)} />
        {backHome}
      </>
    );
  } else {
    // Recusado, expirado ou cancelado: o paciente continua conectado
    const title = view.kind === 'recusado' ? 'Pedido não autorizado' : view.kind === 'expirado' ? 'Pedido expirado' : 'Pedido cancelado';
    body = <Notice icon={view.kind === 'recusado' ? Ban : Info} title={title} text={view.message} />;
    footer = (
      <>
        {view.kind === 'expirado' ? (
          <BigActionButton title="PEDIR DE NOVO" icon={LogOut} variant="primary" loading={busy} onPress={() => void ask()} />
        ) : null}
        {backHome}
      </>
    );
  }

  return (
    <PatientScreen back footer={footer}>
      {body}
    </PatientScreen>
  );
}

/** Ícone, título e texto do estado atual; anunciado pelo leitor de tela quando muda. */
function Notice({ icon: Icon, title, text, detail }: { icon: IconComponent; title: string; text: string; detail?: string }) {
  const { colors } = useTheme();
  return (
    <Card style={styles.notice}>
      <View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}>
        <Icon color={colors.primary} size={40} />
      </View>
      <View accessible accessibilityRole="alert" accessibilityLiveRegion="polite" accessibilityLabel={`${title}. ${text}`} style={styles.texts}>
        <AppText variant="patientTitle" align="center">
          {title}
        </AppText>
        <AppText variant="patientBody" align="center">
          {text}
        </AppText>
      </View>
      {detail ? (
        <AppText variant="patientBody" muted align="center">
          {detail}
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing.lg, paddingTop: spacing.xxl },
  notice: { alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xl },
  iconCircle: { width: 80, height: 80, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  texts: { gap: spacing.sm },
});
