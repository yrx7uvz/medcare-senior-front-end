import { Pill, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TabScreenProps } from '../../app/navigation/types';
import { CaregiverScreen } from '../../components/layout/CaregiverScreen';
import { AppText, ConfirmDialog, EmptyState, ErrorState, LoadingSkeleton } from '../../components/ui';
import { services } from '../../services';
import { useAppStore } from '../../store/appStore';
import { firstName } from '../../lib/date';
import { useMutation, useQuery } from '../../lib/useQuery';
import type { MedicationView } from '../../types/views';
import { spacing, useTheme } from '../../theme';
import { MedicationCard } from './MedicationCard';

/** T05 — Remédios do paciente filtrado (ou de todos). Remoção lógica com RN06. */
export function MedicationsScreen({ navigation }: TabScreenProps<'Remedios'>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const filter = useAppStore((s) => s.selectedElderId);
  const showToast = useAppStore((s) => s.showToast);
  const q = useQuery(['meds', filter], () => services.medications.list(filter));
  const elders = useQuery(['elders'], () => services.elders.list());
  const remove = useMutation(services.medications.remove);
  const [target, setTarget] = useState<MedicationView | null>(null);

  const elderName = filter === 'ALL' ? null : elders.data?.find((e) => e.id === filter)?.name;
  const count = q.data?.length ?? 0;

  async function confirmRemove() {
    if (!target) return;
    await remove.mutate(target.medication.id, { confirmed: true });
    setTarget(null);
    showToast(`${target.medication.name} removido. O histórico foi mantido.`);
  }

  return (
    <CaregiverScreen
      title="Remédios"
      subtitle={q.data ? `${elderName ?? 'Todos os pacientes'} • ${count} ${count === 1 ? 'cadastrado' : 'cadastrados'}` : undefined}
      withElderSwitcher
    >
      {q.loading ? (
        <View style={styles.pad}><LoadingSkeleton /></View>
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={q.reload} />
      ) : (
        <FlatList
          data={q.data}
          keyExtractor={(i) => i.medication.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 120 }]}
          ListHeaderComponent={
            count ? (
              <AppText variant="caption" muted>
                Toque em um remédio para editar. Nome, dosagem e tipo são obrigatórios (RN05).
              </AppText>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon={Pill}
              title="Nenhum medicamento cadastrado para este paciente"
              description={elderName ? `Cadastre o primeiro remédio de ${firstName(elderName)}.` : 'Cadastre o primeiro remédio.'}
              actionLabel="Cadastrar remédio"
              onAction={() => navigation.navigate('MedicationForm')}
            />
          }
          renderItem={({ item }) => (
            <MedicationCard
              item={item}
              showElder={filter === 'ALL'}
              onPress={() => navigation.navigate('MedicationForm', { medicationId: item.medication.id })}
              onRemove={() => setTarget(item)}
            />
          )}
        />
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cadastrar remédio"
        onPress={() => navigation.navigate('MedicationForm')}
        style={({ pressed }) => [styles.fab, { backgroundColor: colors.primary, bottom: spacing.lg, opacity: pressed ? 0.85 : 1 }]}
      >
        <Plus color={colors.onPrimary} size={30} strokeWidth={2.6} />
      </Pressable>

      <ConfirmDialog
        visible={!!target}
        icon={Trash2}
        tone="danger"
        title={`Remover ${target?.medication.name ?? ''}?`}
        message={
          target?.activeTreatment
            ? 'Este remédio tem tratamento ativo. Ao remover, as próximas doses deixam de ser lembradas. As doses já registradas continuam no histórico (RN06, RN08).'
            : 'O remédio sai da lista. As doses já registradas continuam no histórico.'
        }
        confirmLabel={target?.activeTreatment ? 'Remover mesmo assim' : 'Remover'}
        loading={remove.loading}
        onConfirm={confirmRemove}
        onCancel={() => setTarget(null)}
      >
        {remove.error ? <AppText color={colors.danger}>{remove.error.message}</AppText> : null}
      </ConfirmDialog>
    </CaregiverScreen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg },
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#0D4F8A',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
});
