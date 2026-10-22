import { Bell, ChevronRight, FileText, KeyRound, LogOut, ShieldCheck, SlidersHorizontal, Trash2, UserPlus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TabScreenProps } from '../../app/navigation/types';
import { CaregiverScreen } from '../../components/layout/CaregiverScreen';
import { AppSwitch, AppText, Avatar, Button, Card, ConfirmDialog, ErrorState, LoadingSkeleton, TextField, ThemeToggle, type IconComponent } from '../../components/ui';
import { toleranceError } from '../../lib/doseRules';
import { services } from '../../services';
import { useAppStore } from '../../store/appStore';
import { getDemo } from '../../config/demo';
import { IS_DEMO } from '../../config/env';
import { push, type PushPermission } from '../../lib/push';
import { pushRegistration } from '../../lib/pushSession';
import { logoutCaregiver } from '../../lib/session';
import { useMutation, useQuery } from '../../lib/useQuery';
import { spacing, useTheme } from '../../theme';
import { ToleranceSelector } from './ToleranceSelector';

// Prazo de remoção dos dados pessoais: a API apaga na hora (0 dias); o modo demonstração simula até 30 dias
const EXPECTED_REMOVAL_DAYS = IS_DEMO ? 30 : 0;
const removalWhen = (days: number) => (days === 0 ? 'imediatamente' : `em até ${days} dias`);

/** T08 — Configurações do cuidador. */
export function SettingsScreen({ navigation }: TabScreenProps<'Config'>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const session = useAppStore((s) => s.session);
  const setSession = useAppStore((s) => s.setSession);
  const setFlash = useAppStore((s) => s.setFlash);
  const resetUi = useAppStore((s) => s.resetUi);
  const prefs = useAppStore((s) => s.notificationPrefs);
  const setPref = useAppStore((s) => s.setNotificationPref);
  const showToast = useAppStore((s) => s.showToast);

  const tolerance = useQuery(['tolerance'], () => services.doses.getTolerance());
  const elders = useQuery(['elders'], () => services.elders.list());
  const saveTolerance = useMutation(services.doses.setTolerance);
  const deleteAccount = useMutation(services.auth.deleteAccount);
  const [draft, setDraft] = useState<number | null>(null);
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- inicializa o rascunho quando a consulta termina; regra do React Compiler, que o projeto não usa
    if (tolerance.data !== undefined && draft === null) setDraft(tolerance.data);
  }, [tolerance.data, draft]);

  const changed = draft !== null && tolerance.data !== undefined && draft !== tolerance.data;
  // Mesma faixa da API (5 a 120): fora dela não envia
  const draftError = draft !== null ? toleranceError(draft) : null;

  async function doDelete() {
    // Tira o token do aparelho da conta antes de excluí-la (melhor esforço; a exclusão apaga o token de qualquer jeito)
    await pushRegistration.unregister();
    const r = await deleteAccount.mutate();
    if (!r) {
      // A conta continua: o aparelho volta a receber os avisos dela
      void pushRegistration.register();
      return;
    }
    setStep(0);
    setSession(null);
    getDemo()?.resetDemoDb();
    resetUi();
    setFlash(`Conta excluída. Seus dados pessoais e os dos pacientes serão removidos ${removalWhen(r.removalDeadlineDays)}; o histórico de doses fica anonimizado (RN13).`);
  }

  return (
    <CaregiverScreen title="Configurações" subtitle={session?.email}>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <Card style={styles.card}>
          <SectionTitle icon={SlidersHorizontal} title="Tolerância de alerta" />
          <AppText muted>
            Quanto tempo esperar a confirmação antes de avisar você. Padrão: 30 minutos.
          </AppText>
          {tolerance.loading ? (
            <LoadingSkeleton rows={1} />
          ) : tolerance.error ? (
            <ErrorState error={tolerance.error} onRetry={tolerance.reload} />
          ) : draft !== null ? (
            <ToleranceSelector value={draft} onChange={setDraft} />
          ) : null}
          {draftError || saveTolerance.error ? (
            <AppText color={colors.danger} accessibilityRole="alert">
              {/* Validação da API no campo (400 VALIDACAO) ou a mensagem geral */}
              {draftError ?? saveTolerance.error?.fieldErrors?.toleranciaMinutos ?? saveTolerance.error?.message}
            </AppText>
          ) : null}
          <Button
            title={changed ? `Salvar ${draft} minutos` : 'Tolerância salva'}
            disabled={!changed || !!draftError}
            loading={saveTolerance.loading}
            onPress={async () => {
              if (draft === null || toleranceError(draft)) return;
              const v = await saveTolerance.mutate(draft);
              // A escrita atualiza o painel e as doses abertas (nova janela de aviso)
              if (v !== undefined) showToast(`Tolerância ajustada para ${v} minutos. Vale para os próximos avisos.`);
            }}
          />
        </Card>

        <Card style={styles.card}>
          <SectionTitle icon={UserPlus} title="Pacientes" />
          {(elders.data ?? []).map((e) => (
            <View key={e.id} style={styles.elderRow}>
              <Avatar name={e.name} color={e.avatarColor} size={36} />
              <AppText variant="bodyStrong" style={styles.flex}>{e.name}</AppText>
              <Button title="Código" icon={KeyRound} size="sm" variant="secondary" accessibilityLabel={`Gerar código de vínculo para ${e.name}`}
                onPress={() => navigation.navigate('LinkCode', { elderId: e.id })} />
            </View>
          ))}
          <Button title="Cadastrar novo paciente" icon={UserPlus} variant="secondary" onPress={() => navigation.navigate('ElderForm')} />
        </Card>

        <Card style={styles.card}>
          <SectionTitle icon={Bell} title="Notificações" />
          <PrefRow label="Dose não confirmada" hint="Aviso quando passar da tolerância" value={prefs.missedDose} onChange={(v) => setPref('missedDose', v)} />
          {IS_DEMO ? null : <PushStatus />}
          <PrefRow label="Mensagens dos pacientes" value={prefs.messages} onChange={(v) => setPref('messages', v)} />        </Card>

        <Card style={styles.card}>
          <ThemeToggle />
        </Card>

        <Card style={styles.card}>
          <SectionTitle icon={ShieldCheck} title="Privacidade" />
          <LinkRow icon={FileText} label="Termos de Uso" onPress={() => navigation.navigate('Legal', { doc: 'termos' })} />
          <LinkRow icon={ShieldCheck} label="Política LGPD" onPress={() => navigation.navigate('Legal', { doc: 'lgpd' })} />
          <Button title="Excluir minha conta e dados" icon={Trash2} variant="danger" onPress={() => setStep(1)} />
        </Card>

        <Button title="Sair" icon={LogOut} variant="secondary" onPress={() => void logoutCaregiver()} />
      </ScrollView>

      <ConfirmDialog
        visible={step === 1}
        icon={Trash2}
        tone="danger"
        title="Excluir conta e dados?"
        message={`Seus dados pessoais e os dos pacientes vinculados serão removidos ${removalWhen(EXPECTED_REMOVAL_DAYS)}. O histórico de doses já registradas é mantido de forma anonimizada, sem ligação com nenhuma pessoa (RN13). Esta ação não pode ser desfeita.`}
        confirmLabel="Continuar"
        onConfirm={() => {
          setConfirmText('');
          setStep(2);
        }}
        onCancel={() => setStep(0)}
      />
      <ConfirmDialog
        visible={step === 2}
        icon={Trash2}
        tone="danger"
        title="Confirme a exclusão"
        message="Para confirmar, digite EXCLUIR."
        confirmLabel="Excluir definitivamente"
        confirmDisabled={confirmText.trim().toUpperCase() !== 'EXCLUIR'}
        loading={deleteAccount.loading}
        onConfirm={doDelete}
        onCancel={() => setStep(0)}
      >
        <TextField label="Confirmação" value={confirmText} onChangeText={setConfirmText} autoCapitalize="characters" placeholder="EXCLUIR" />
        {deleteAccount.error ? <AppText color={colors.danger}>{deleteAccount.error.message}</AppText> : null}
      </ConfirmDialog>
    </CaregiverScreen>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: IconComponent; title: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.titleRow}>
      <Icon color={colors.primary} size={20} />
      <AppText variant="heading" accessibilityRole="header">{title}</AppText>
    </View>
  );
}

/** FE-26: estado da permissão de notificações neste aparelho, com a ação que cabe. */
function PushStatus() {
  const { colors } = useTheme();
  const [permission, setPermission] = useState<PushPermission | null>(null);
  useEffect(() => {
    let active = true;
    void push.getPermission().then((p) => {
      if (active) setPermission(p);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!push.supported) {
    return (
      <AppText variant="caption" muted>
        Os avisos por notificação funcionam no app Android instalado (não no Expo Go nem no iPhone).
      </AppText>
    );
  }
  if (permission === 'granted') {
    return <AppText variant="caption" color={colors.status.CONFIRMADA_NO_HORARIO.fg}>Avisos ativados neste celular.</AppText>;
  }
  if (permission === 'denied') {
    return (
      <View style={styles.gapSm}>
        <AppText variant="caption" color={colors.warningText}>As notificações estão bloqueadas neste celular. Sem elas, os avisos de dose não aparecem.</AppText>
        <Button title="Abrir configurações do Android" size="sm" variant="secondary" onPress={() => void Linking.openSettings()} />
      </View>
    );
  }
  if (permission === 'undetermined') {
    return <Button title="Ativar avisos de dose" size="sm" variant="secondary" onPress={() => void push.requestPermission().then(setPermission)} />;
  }
  return null;
}

function PrefRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return <AppSwitch label={label} description={hint} value={value} onValueChange={onChange} />;
}

function LinkRow({ icon: Icon, label, onPress }: { icon: IconComponent; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={({ pressed }) => [styles.prefRow, { opacity: pressed ? 0.7 : 1 }]}>
      <Icon color={colors.textMuted} size={18} />
      <AppText style={styles.flex}>{label}</AppText>
      <ChevronRight color={colors.textMuted} size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gapSm: { gap: spacing.sm },
  flex: { flex: 1 },
  body: { padding: spacing.lg, gap: spacing.lg },
  card: { gap: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  elderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  prefRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52 },
});
