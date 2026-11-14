import { zodResolver } from '@hookform/resolvers/zod';
import Save from 'lucide-react-native/icons/save';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { AppText, Button, Card, FormTextField } from '../../components/ui';
import { getNow } from '../../lib/clock';
import { applyFieldErrors } from '../../lib/formErrors';
import { DEFAULT_PRIMARY, isBottle } from '../../lib/medicationMeta';
import { medicationFormSchema, type MedicationFormValues } from '../../lib/schemas';
import { appLocalNow } from '../../lib/serverClock';
import { useNow } from '../../lib/useNow';
import type { AppError } from '../../services/errors';
import type { Patient, MedicationAppearance, MedicationType } from '../../types/domain';
import { spacing, useTheme } from '../../theme';
import { AppearanceSection } from './form/AppearanceSection';
import { PatientSection } from './form/PatientSection';
import { FormErrorBox, NoticeBox } from './form/FormErrorBox';
import { MedicationDataSection } from './form/MedicationDataSection';
import { ScheduleSection } from './form/ScheduleSection';
import { scheduleTiming } from './formValues';

/** Campos do tratamento na API (ErroResponse.campos) para os campos do formulário. */
const API_SCHEDULE_FIELDS = { horarios: 'times', dataFim: 'endDate', diasSemana: 'weekdays' };

interface Props {
  defaultValues: MedicationFormValues;
  patients: Patient[];
  lockPatient: boolean;
  isEdit: boolean;
  submitting: boolean;
  submitError?: AppError;
  /** Texto do botão de salvar (padrão: "Salvar medicamento e tratamento"). */
  submitLabel?: string;
  /** O medicamento já foi salvo e só falta o tratamento: os dados do remédio não serão reenviados. */
  lockMedicationFields?: boolean;
  onSubmit: (v: MedicationFormValues) => void;
}

/**
 * Formulário de medicamento + tratamento, com prévia ao vivo do desenho do remédio. Só os campos que a API guarda
 * (MedicamentoRequestDTO e TratamentoRequestDTO): nome, dosagem, tipo, formato (comprimido), cor, estoque, link da
 * bula, dias, horários, início e fim. Cada parte fica num componente de ./form.
 */
export function MedicationForm({
  defaultValues, patients, lockPatient, isEdit, submitting, submitError, submitLabel, lockMedicationFields, onSubmit,
}: Props) {
  const { colors } = useTheme();
  const { control, handleSubmit, watch, setValue, setError, formState } = useForm<MedicationFormValues>({
    resolver: zodResolver(medicationFormSchema),
    defaultValues,
  });
  const errors = formState.errors;
  const now = useNow(30_000);
  // Na edição, só os horários novos passam pela antecedência mínima (os salvos não bloqueiam)
  const savedTimes = isEdit ? defaultValues.times.map((t) => t.time) : [];

  // react-hook-form não é compatível com o React Compiler (só aviso; o projeto não usa o compilador).
  // eslint-disable-next-line react-hooks/incompatible-library
  const [type, shape, primaryColor, name, dosage, patientId] = watch(['type', 'shape', 'primaryColor', 'name', 'dosage', 'patientId']);
  const [startDate, endDate, weekdays, times] = watch(['startDate', 'endDate', 'weekdays', 'times']);
  const appearance: MedicationAppearance = { type, shape: type === 'COMPRIMIDO' ? shape : undefined, primaryColor };
  const timing = scheduleTiming({ startDate, endDate, weekdays, times }, savedTimes, appLocalNow(now));

  // 400 da API com erro por campo (ex.: horário a menos de 5 minutos pelo relógio do servidor): a mensagem vai ao campo
  useEffect(() => {
    applyFieldErrors(setError, submitError, ['times', 'endDate', 'weekdays'], API_SCHEDULE_FIELDS);
  }, [submitError, setError]);

  function submit(v: MedicationFormValues) {
    const { error } = scheduleTiming(v, savedTimes, appLocalNow(getNow()));
    if (error) {
      setError('times', { message: error });
      return;
    }
    onSubmit(v);
  }

  const set = <K extends keyof MedicationFormValues>(k: K, v: MedicationFormValues[K]) =>
    setValue(k, v as never, { shouldDirty: true, shouldValidate: formState.isSubmitted });

  function changeType(t: MedicationType) {
    set('type', t);
    set('primaryColor', DEFAULT_PRIMARY[t]);
  }

  return (
    <View style={styles.wrap}>
      <PatientSection control={control} patients={patients} lockPatient={lockPatient} patientId={patientId} />
      <MedicationDataSection control={control} type={type} onTypeChange={changeType} />
      <AppearanceSection
        appearance={appearance}
        shape={shape}
        color={primaryColor}
        name={name}
        dosage={dosage}
        onShapeChange={(s) => set('shape', s)}
        onColorChange={(c) => set('primaryColor', c)}
      />

      <Card style={styles.card}>
        <AppText variant="heading" accessibilityRole="header">Estoque e bula</AppText>
        <FormTextField control={control} name="stock" label={isBottle(type) ? 'Estoque (frascos)' : 'Estoque (unidades)'} keyboardType="number-pad" />
        <FormTextField
          control={control}
          name="bulaUrl"
          label="Link da bula (opcional)"
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://..."
          hint="Endereço da bula na internet, por exemplo no site da Anvisa."
        />
      </Card>

      <ScheduleSection control={control} isEdit={isEdit} timesNotice={timing.notice} />

      <NoticeBox tone="info">
        {isEdit
          ? 'As doses pendentes dos próximos 30 dias serão recriadas com os novos horários. Doses já registradas não mudam.'
          : 'Serão geradas as doses dos próximos 30 dias, renovadas automaticamente todo dia.'}
      </NoticeBox>

      {lockMedicationFields ? (
        <NoticeBox tone="warning">
          Os dados do remédio já estão salvos. Agora só os dias e horários serão enviados; mudanças no nome, na dosagem ou
          na aparência podem ser feitas depois, editando o remédio.
        </NoticeBox>
      ) : null}
      <FormErrorBox error={submitError} />
      {formState.isSubmitted && Object.keys(errors).length > 0 ? (
        <AppText variant="caption" color={colors.danger} accessibilityRole="alert">
          Revise os campos destacados antes de salvar.
        </AppText>
      ) : null}

      <Button title={submitLabel ?? 'Salvar medicamento e tratamento'} icon={Save} size="lg" loading={submitting} onPress={handleSubmit(submit)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  card: { gap: spacing.md },
});
