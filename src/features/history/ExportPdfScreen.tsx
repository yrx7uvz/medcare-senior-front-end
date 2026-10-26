import { CheckCircle2, FileDown, Users } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootScreenProps } from '../../app/navigation/types';
import { PatientSwitcher } from '../../components/layout/PatientSwitcher';
import { StackHeader } from '../../components/layout/StackHeader';
import { AppText, Avatar, Button, Card, Chip, EmptyState, TextField } from '../../components/ui';
import { services } from '../../services';
import { useAppStore } from '../../store/appStore';
import { addDays, formatDateBR } from '../../lib/date';
import { pdfDownloadFailure, pdfPeriod } from '../../lib/pdfReport';
import { clearPdfTemp, sharePdf } from '../../lib/pdfShare';
import { useMutation, useQuery } from '../../lib/useQuery';
import { useNow } from '../../lib/useNow';
import { radius, spacing, useTheme } from '../../theme';

const CONTENTS = [
  'Nome do paciente e período do relatório',
  'Remédios em uso, com dosagem',
  'Cada dose com data, horário, status e quem confirmou',
  'Taxa de adesão por remédio e geral',
];

/**
 * Relatório em PDF do histórico de adesão: o cuidador escolhe o paciente e o período (até 12 meses, conferido antes de
 * chamar o servidor), o app baixa o arquivo com o token do cuidador e abre o menu de compartilhar do Android (salvar,
 * WhatsApp, e-mail). O arquivo temporário fica no cache privado do app e é apagado depois.
 */
export function ExportPdfScreen({ navigation }: RootScreenProps<'ExportPdf'>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const filter = useAppStore((s) => s.selectedPatientId);
  const setSelected = useAppStore((s) => s.setSelectedPatient);
  const showToast = useAppStore((s) => s.showToast);
  const now = useNow(60_000);
  const [from, setFrom] = useState(formatDateBR(addDays(now, -29)));
  const [to, setTo] = useState(formatDateBR(now));
  const [failure, setFailure] = useState<string | null>(null);
  const patients = useQuery(['patients'], () => services.patients.list());
  const download = useMutation(services.reports.downloadPdf);
  const [sharing, setSharing] = useState(false);

  // PDF que tenha sobrado de um compartilhamento interrompido
  useEffect(() => {
    clearPdfTemp();
  }, []);

  const period = pdfPeriod(from, to);
  const patientId = filter === 'ALL' ? null : filter;
  const busy = download.loading || sharing;

  async function generate() {
    if (!patientId || period.error !== null || busy) return;
    setFailure(null);
    const result = await download.run(patientId, period.from, period.to);
    if (!result.ok) {
      setFailure(pdfDownloadFailure(result.error));
      return;
    }
    setSharing(true);
    try {
      await sharePdf(result.data);
      if (result.data.demo) showToast('PDF de demonstração gerado.', 'info');
    } catch {
      setFailure('Não foi possível abrir o menu de compartilhar. Tente de novo.');
    } finally {
      setSharing(false);
    }
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <StackHeader title="Relatório em PDF" subtitle="Histórico de adesão para a consulta" />
      <PatientSwitcher />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]}>
        {!patientId ? (
          <Card style={styles.card}>
            <EmptyState icon={Users} title="Escolha o paciente" description="O relatório em PDF é feito para um paciente por vez." />
            <View style={styles.chips}>
              {(patients.data ?? []).map((e) => (
                <Chip key={e.id} label={e.name} onPress={() => setSelected(e.id)} leading={<Avatar name={e.name} color={e.avatarColor} size={24} />} />
              ))}
            </View>
          </Card>
        ) : (
          <>
            <Card style={styles.card}>
              <AppText variant="heading" accessibilityRole="header">Período (até 12 meses)</AppText>
              <View style={styles.range}>
                <View style={styles.date}>
                  <TextField label="Data de início" value={from} onChangeText={(v) => { setFrom(v); setFailure(null); }} mask="date" keyboardType="number-pad" />
                </View>
                <View style={styles.date}>
                  <TextField label="Data de fim" value={to} onChangeText={(v) => { setTo(v); setFailure(null); }} mask="date" keyboardType="number-pad" />
                </View>
              </View>
              {period.error !== null ? <AppText variant="caption" color={colors.danger} accessibilityRole="alert">{period.error}</AppText> : null}
            </Card>

            <Card style={styles.card}>
              <AppText variant="heading" accessibilityRole="header">O PDF terá</AppText>
              {CONTENTS.map((c) => (
                <View key={c} style={styles.contentRow}>
                  <CheckCircle2 color={colors.status.CONFIRMADA_NO_HORARIO.fg} size={18} />
                  <AppText style={styles.flex}>{c}</AppText>
                </View>
              ))}
              <AppText variant="caption" muted>
                O arquivo fica guardado só durante o envio e é apagado do celular em seguida.
              </AppText>
            </Card>

            {failure ? (
              <View style={[styles.notice, { backgroundColor: colors.dangerSoft }]} accessibilityRole="alert">
                <AppText color={colors.danger}>{failure}</AppText>
              </View>
            ) : null}

            <Button
              title={download.loading ? 'Gerando PDF…' : 'Baixar e compartilhar PDF'}
              icon={FileDown}
              size="lg"
              loading={busy}
              disabled={period.error !== null || busy}
              onPress={() => void generate()}
            />
            <Button title="Voltar ao histórico" variant="ghost" onPress={() => navigation.goBack()} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: spacing.lg, gap: spacing.lg },
  card: { gap: spacing.md, borderRadius: radius.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  range: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  date: { flexGrow: 1, flexBasis: 140 },
  contentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  notice: { borderRadius: radius.md, padding: spacing.md },
});
