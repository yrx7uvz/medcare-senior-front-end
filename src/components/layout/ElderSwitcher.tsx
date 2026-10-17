import { useNavigation } from '@react-navigation/native';
import { Plus, Users } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { RootNavigation } from '../../app/navigation/types';
import { services } from '../../services';
import { useAppStore } from '../../store/appStore';
import { firstName } from '../../lib/date';
import { useQuery } from '../../lib/useQuery';
import { minuteStamp, useNow } from '../../lib/useNow';
import { radius, spacing, useTheme } from '../../theme';
import { AppText, Avatar } from '../ui';

/**
 * Filtro de idosos fixo no topo das telas do cuidador. A escolha fica no estado
 * global e persiste entre as abas. Ponto vermelho = dose não confirmada hoje.
 */
export function ElderSwitcher() {
  const { colors } = useTheme();
  const navigation = useNavigation<RootNavigation>();
  const selected = useAppStore((s) => s.selectedElderId);
  const setSelected = useAppStore((s) => s.setSelectedElder);
  const now = useNow();
  const elders = useQuery(['elders'], () => services.elders.list());
  const alerts = useQuery(['alerts'], () => services.doses.listAlerts(), { silentKey: minuteStamp(now) });
  const alertIds = new Set((alerts.data ?? []).map((a) => a.elderId));
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const name = selected === 'ALL' ? 'todos os pacientes' : elders.data?.find((e) => e.id === selected)?.name;
    if (name) AccessibilityInfo.announceForAccessibility(`Exibindo ${name}`);
  }, [selected, elders.data]);

  // Se o idoso selecionado deixou de existir, volta para "Todos".
  useEffect(() => {
    if (selected !== 'ALL' && elders.data && !elders.data.some((e) => e.id === selected)) setSelected('ALL');
  }, [elders.data, selected, setSelected]);

  const items = elders.data ?? [];
  const allAlert = alertIds.size > 0;

  return (
    <View style={[styles.bar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]} accessibilityRole="tablist">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content}>
        <SwitchChip
          label="Todos"
          selected={selected === 'ALL'}
          alert={allAlert}
          onPress={() => setSelected('ALL')}
          leading={
            <View style={[styles.allIcon, { backgroundColor: selected === 'ALL' ? colors.onPrimary : colors.primarySoft }]}>
              <Users color={colors.primary} size={16} />
            </View>
          }
        />
        {elders.loading && !items.length
          ? [0, 1].map((i) => <View key={i} style={[styles.placeholder, { backgroundColor: colors.skeleton }]} />)
          : items.map((e) => (
              <SwitchChip
                key={e.id}
                label={firstName(e.name)}
                fullName={e.name}
                selected={selected === e.id}
                alert={alertIds.has(e.id)}
                onPress={() => setSelected(e.id)}
                leading={<Avatar name={e.name} color={e.avatarColor} size={28} alert={alertIds.has(e.id)} />}
              />
            ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cadastrar novo paciente"
          onPress={() => navigation.navigate('ElderForm')}
          style={({ pressed }) => [styles.chip, styles.newChip, { borderColor: colors.primary, opacity: pressed ? 0.7 : 1 }]}
        >
          <Plus color={colors.primary} size={18} />
          <AppText variant="label" color={colors.primary}>
            Novo
          </AppText>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function SwitchChip({
  label, fullName, selected, alert, onPress, leading,
}: { label: string; fullName?: string; selected: boolean; alert: boolean; onPress: () => void; leading: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={`${fullName ?? label}${alert ? ', tem dose não confirmada' : ''}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.surfaceAlt,
          borderColor: selected ? colors.primary : colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {leading}
      <AppText variant="label" color={selected ? colors.onPrimary : colors.text}>
        {label}
      </AppText>
      {alert && label === 'Todos' ? <View style={[styles.dot, { backgroundColor: colors.status.NAO_TOMADA.accent }]} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { borderBottomWidth: StyleSheet.hairlineWidth },
  content: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm, alignItems: 'center' },
  chip: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: 6,
    paddingRight: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  newChip: { borderStyle: 'dashed', paddingLeft: spacing.md },
  allIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  placeholder: { width: 96, height: 44, borderRadius: radius.pill },
  dot: { width: 9, height: 9, borderRadius: 5 },
});
