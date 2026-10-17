import { UserPlus } from 'lucide-react-native';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootScreenProps } from '../../app/navigation/types';
import { StackHeader } from '../../components/layout/StackHeader';
import { EmptyState, ErrorState, LoadingSkeleton } from '../../components/ui';
import { services } from '../../services';
import { useAppStore } from '../../store/appStore';
import type { MedicationFormValues } from '../../lib/schemas';
import { useMutation, useQuery } from '../../lib/useQuery';
import { useNow } from '../../lib/useNow';
import { spacing, useTheme } from '../../theme';
import { emptyMedicationValues, toMedicationInput, valuesFromMedication } from './formValues';
import { MedicationForm } from './MedicationForm';

export function MedicationFormScreen({ route, navigation }: RootScreenProps<'MedicationForm'>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const now = useNow(60_000);
  const filter = useAppStore((s) => s.selectedElderId);
  const showToast = useAppStore((s) => s.showToast);
  const medicationId = route.params?.medicationId;
  const isEdit = !!medicationId;

  const elders = useQuery(['elders'], () => services.elders.list());
  const existing = useQuery(['med', medicationId], () => services.medications.get(medicationId!), { enabled: isEdit });
  const save = useMutation((v: MedicationFormValues) =>
    isEdit ? services.medications.update(medicationId!, toMedicationInput(v)) : services.medications.create(toMedicationInput(v)),
  );

  const loading = elders.loading || (isEdit && existing.loading);
  const error = elders.error ?? existing.error;
  const defaultElder = filter !== 'ALL' ? filter : elders.data?.length === 1 ? elders.data[0].id : '';
  const elderName = (id: string) => elders.data?.find((e) => e.id === id)?.name;

  async function onSubmit(v: MedicationFormValues) {
    const result = await save.mutate(v);
    if (result) {
      showToast(isEdit ? 'Remédio e tratamento atualizados' : 'Remédio salvo e doses geradas');
      navigation.goBack();
    }
  }

  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: colors.background }]}>
      <StackHeader
        title={isEdit ? 'Editar remédio' : 'Novo remédio'}
        subtitle={isEdit ? elderName(existing.data?.medication.elderId ?? '') : defaultElder ? `Para: ${elderName(defaultElder) ?? ''}` : 'Escolha o paciente'}
      />
      {loading ? (
        <View style={styles.body}><LoadingSkeleton rows={3} /></View>
      ) : error ? (
        <ErrorState error={error} onRetry={() => { elders.reload(); if (isEdit) existing.reload(); }} />
      ) : !elders.data?.length ? (
        <EmptyState icon={UserPlus} title="Cadastre um paciente primeiro" actionLabel="Cadastrar paciente" onAction={() => navigation.replace('ElderForm')} />
      ) : (
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
          <MedicationForm
            key={existing.data?.medication.id ?? 'new'}
            defaultValues={
              isEdit && existing.data
                ? valuesFromMedication(existing.data.medication, existing.data.treatment, now)
                : emptyMedicationValues(defaultElder, now)
            }
            elders={elders.data}
            lockElder={isEdit || filter !== 'ALL'}
            isEdit={isEdit}
            submitting={save.loading}
            submitError={save.error}
            onSubmit={onSubmit}
          />
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: spacing.lg },
});
