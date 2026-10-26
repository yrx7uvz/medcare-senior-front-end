import { useNavigation } from '@react-navigation/native';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Contrast from 'lucide-react-native/icons/contrast';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../../store/appStore';
import { radius, spacing, touch, useTheme } from '../../theme';
import { AppText } from '../ui';
import { OfflineBanner } from './OfflineBanner';

interface Props {
  children: React.ReactNode;
  back?: boolean;
  scroll?: boolean;
  /** Conteúdo fixo no rodapé (botões principais). */
  footer?: React.ReactNode;
}

/** Moldura das telas do paciente: sem menus, voltar grande e alto contraste. */
export function PatientScreen({ children, back, scroll = true, footer }: Props) {
  const { colors, highContrast } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const toggleContrast = useAppStore((s) => s.togglePatientHighContrast);

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      {back ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.headerBtn, { borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 }]}
        >
          <ArrowLeft color={colors.text} size={28} strokeWidth={2.6} />
          <AppText variant="patientStrong">Voltar</AppText>
        </Pressable>
      ) : (
        <View />
      )}
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: highContrast }}
        accessibilityLabel="Alto contraste"
        onPress={toggleContrast}
        style={({ pressed }) => [
          styles.headerBtn,
          styles.round,
          { borderColor: colors.border, backgroundColor: highContrast ? colors.primary : colors.surface, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Contrast color={highContrast ? colors.onPrimary : colors.text} size={28} strokeWidth={2.4} />
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {header}
      <OfflineBanner />
      {scroll ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: footer ? spacing.lg : insets.bottom + spacing.xxl }]}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex]}>{children}</View>
      )}
      {footer ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg, borderTopColor: colors.border, backgroundColor: colors.background }]}>
          {footer}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  headerBtn: {
    minHeight: touch.patient,
    minWidth: touch.patient,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 2,
  },
  round: { paddingHorizontal: 0 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
});
