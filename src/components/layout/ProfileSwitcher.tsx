import Wrench from 'lucide-react-native/icons/wrench';
import X from 'lucide-react-native/icons/x';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../../store/appStore';
import { useDevStore } from '../../store/devStore';
import { getDemo } from '../../config/demo';
import { DEMO_START, useClockStore } from '../../lib/clock';
import { formatDateBR, formatTime } from '../../lib/date';
import { patientDeviceStorage } from '../../lib/secureStorage';
import { useNow } from '../../lib/useNow';
import { hitSlopFor, radius, spacing, useTheme } from '../../theme';
import { demoColors } from '../../theme/colors';
import { AppSwitch, AppText, Button, Chip } from '../ui';

/** Botão do menu do protótipo: 40 dp visíveis, área de toque completada até 48 dp. */
const FAB = 40;

const CLOCK_PRESETS: { label: string; h: number; m: number; hint?: string }[] = [
  { label: '07:30', h: 7, m: 30 },
  { label: '13:50', h: 13, m: 50 },
  { label: '14:02', h: 14, m: 2, hint: 'início' },
  { label: '14:40', h: 14, m: 40, hint: 'aviso do Omeprazol' },
  { label: '15:10', h: 15, m: 10, hint: 'dose não confirmada' },
  { label: '19:30', h: 19, m: 30 },
];

/**
 * Menu de desenvolvedor (somente no protótipo): alterna "Visualizar como",
 * controla o relógio simulado e injeta falhas para demonstrar os estados.
 * Renderizado apenas no modo demonstração (ver App.tsx); os mocks vêm de getDemo().
 */
export function ProfileSwitcher() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const viewAs = useAppStore((s) => s.viewAs);
  const setViewAs = useAppStore((s) => s.setViewAs);
  const resetUi = useAppStore((s) => s.resetUi);
  const setPatientSession = useAppStore((s) => s.setPatientSession);
  const showToast = useAppStore((s) => s.showToast);
  const dev = useDevStore();
  const setTime = useClockStore((s) => s.setTime);
  const now = useNow(1000);

  const codes = open ? (getDemo()?.listDemoLinkCodes() ?? []) : [];

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Menu de desenvolvedor do protótipo"
        onPress={() => setOpen(true)}
        hitSlop={hitSlopFor(FAB)}
        style={[
          styles.fab,
          {
            backgroundColor: demoColors.fabBg,
            bottom: viewAs === 'CAREGIVER' ? insets.bottom + 78 : insets.bottom + 120,
          },
        ]}
      >
        <Wrench color={demoColors.fabFg} size={18} />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
          <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.sheetHeader}>
              <View style={styles.flex}>
                <AppText variant="title">Menu do protótipo</AppText>
                <AppText variant="caption" muted>
                  Não faz parte do app final.
                </AppText>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Fechar menu" onPress={() => setOpen(false)} style={styles.close}>
                <X color={colors.text} size={24} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.body}>
              <Section title="Visualizar como">
                <View style={styles.row}>
                  <Chip label="Cuidador" selected={viewAs === 'CAREGIVER'} onPress={() => setViewAs('CAREGIVER')} />
                  <Chip label="Paciente" selected={viewAs === 'PATIENT'} onPress={() => setViewAs('PATIENT')} />
                </View>
              </Section>

              <Section title={`Relógio simulado: ${formatDateBR(now)} ${formatTime(now)}`}>
                <View style={styles.wrap}>
                  {CLOCK_PRESETS.map((p) => (
                    <Chip
                      key={p.label}
                      label={p.hint ? `${p.label} (${p.hint})` : p.label}
                      onPress={() => {
                        const d = new Date(DEMO_START);
                        d.setHours(p.h, p.m, 0, 0);
                        setTime(d);
                        showToast(`Relógio em ${p.label}`, 'info');
                      }}
                    />
                  ))}
                </View>
                <AppText variant="caption" muted>
                  Com a tolerância de 30 min, o Omeprazol das 14:00 gera o aviso às 14:30 e ainda pode ser confirmado até 15:00; às 15:10, sem confirmação, passa a &quot;Não confirmada&quot;.
                </AppText>
              </Section>

              <Section title="Simular falhas">
                <Toggle label="Erro de API (500)" value={dev.simulateError} onChange={(v) => dev.set({ simulateError: v })} />
                <Toggle label="Sem conexão" value={dev.offline} onChange={(v) => dev.set({ offline: v })} />
                <Toggle label="Carregamento lento" value={dev.slow} onChange={(v) => dev.set({ slow: v })} />
              </Section>

              <Section title="Códigos de vínculo">
                {codes.map((c) => {
                  const state = c.used ? 'já usado' : c.expiresAt <= now.getTime() ? 'expirado' : 'válido';
                  return (
                    <AppText key={c.code} variant="body">
                      {c.code} • {c.patientName} • {state}
                    </AppText>
                  );
                })}
              </Section>

              <Section title="Dados">
                <Button
                  title="Restaurar dados de demonstração"
                  variant="secondary"
                  onPress={async () => {
                    getDemo()?.resetDemoData();
                    resetUi();
                    await patientDeviceStorage.clear().catch(() => undefined);
                    setPatientSession(null);
                    setTime(DEMO_START);
                    dev.set({ simulateError: false, offline: false, slow: false });
                    showToast('Dados de demonstração restaurados', 'info');
                    setOpen(false);
                  }}
                />
              </Section>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="heading">{title}</AppText>
      {children}
    </View>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return <AppSwitch label={label} value={value} onValueChange={onChange} />;
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    left: spacing.md,
    width: FAB,
    height: FAB,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.85,
    elevation: 8,
  },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '88%' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, paddingBottom: spacing.sm },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: spacing.lg, gap: spacing.xl, paddingBottom: spacing.lg },
  section: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  toggle: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  flex: { flex: 1 },
});
