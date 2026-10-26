import { UserPlus } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootScreenProps } from '../../app/navigation/types';
import { StackHeader } from '../../components/layout/StackHeader';
import { EmptyState, ErrorState, LoadingSkeleton } from '../../components/ui';
import { services, TreatmentNotSavedError } from '../../services';
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
  const filter = useAppStore((s) => s.selectedPatientId);
  const showToast = useAppStore((s) => s.showToast);
  const medicationId = route.params?.medicationId;
  const isEdit = !!medicationId;

  const patients = useQuery(['patients'], () => services.patients.list());
  const existing = useQuery(['med', medicationId], () => services.medications.get(medicationId!), { enabled: isEdit });
  // Cadastro em que o medicamento foi salvo e o tratamento não: o próximo envio tenta SÓ o tratamento
  const [orphanId, setOrphanId] = useState<string | null>(null);
  const save = useMutation((v: MedicationFormValues) => {
    const input = toMedicationInput(v);
    if (isEdit) return services.medications.update(medicationId!, input);
    if (orphanId) return services.medications.createTreatment(orphanId, input.treatment);
    return services.medications.create(input);
  });

  const loading = patients.loading || (isEdit && existing.loading);
  const error = patients.error ?? existing.error;
  const defaultPatient = filter !== 'ALL' ? filter : patients.data?.length === 1 ? patients.data[0].id : '';
  const patientName = (id: string) => patients.data?.find((e) => e.id === id)?.name;

  async function onSubmit(v: MedicationFormValues) {
    const result = await save.run(v);
    if (result.ok) {
      showToast(isEdit ? 'Remédio e tratamento atualizados' : 'Remédio salvo e doses geradas');
      navigation.goBack();
    } else if (!isEdit && result.error instanceof TreatmentNotSavedError) {
      setOrphanId(result.error.medicationId);
    }
  }

  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: colors.background }]}>
      <StackHeader
        title={isEdit ? 'Editar remédio' : 'Novo remédio'}
        subtitle={isEdit ? patientName(existing.data?.medication.patientId ?? '') : defaultPatient ? `Para: ${patientName(defaultPatient) ?? ''}` : 'Escolha o paciente'}
      />
      {loading ? (
        <View style={styles.body}><LoadingSkeleton rows={3} /></View>
      ) : error ? (
        <ErrorState error={error} onRetry={() => { patients.reload(); if (isEdit) existing.reload(); }} />
      ) : !patients.data?.length ? (
        <EmptyState icon={UserPlus} title="Cadastre um paciente primeiro" actionLabel="Cadastrar paciente" onAction={() => navigation.replace('PatientForm')} />
      ) : (
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
          <MedicationForm
            key={existing.data?.medication.id ?? 'new'}
            defaultValues={
              isEdit && existing.data
                ? valuesFromMedication(existing.data.medication, existing.data.treatment, now)
                : emptyMedicationValues(defaultPatient, now)
            }
            patients={patients.data}
            lockPatient={isEdit || filter !== 'ALL'}
            isEdit={isEdit}
            submitting={save.loading}
            submitError={save.error}
            submitLabel={orphanId ? 'Tentar salvar os horários de novo' : undefined}
            lockMedicationFields={!!orphanId}
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
