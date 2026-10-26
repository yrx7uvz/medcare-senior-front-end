import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, useTheme } from '../../theme';
import { AppText } from '../ui';
import { PatientSwitcher } from './PatientSwitcher';
import { OfflineBanner } from './OfflineBanner';

interface Props {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  /** PatientSwitcher fixo no topo (Painel, Remédios, Histórico, Mensagens, PDF). */
  withPatientSwitcher?: boolean;
  children: React.ReactNode;
}

/** Cabeçalho azul do protótipo + filtro de pacientes fixo + conteúdo. */
export function CaregiverScreen({ title, subtitle, right, withPatientSwitcher, children }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.header, paddingTop: insets.top + spacing.md }]}>
        <View style={styles.titleRow}>
          <View style={styles.flex}>
            <AppText variant="display" color={colors.onHeader} accessibilityRole="header">
              {title}
            </AppText>
            {subtitle ? (
              <AppText variant="body" color={colors.onHeaderMuted}>
                {subtitle}
              </AppText>
            ) : null}
          </View>
          {right}
        </View>
      </View>
      {withPatientSwitcher ? <PatientSwitcher /> : null}
      <OfflineBanner />
      <View style={styles.flex}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
