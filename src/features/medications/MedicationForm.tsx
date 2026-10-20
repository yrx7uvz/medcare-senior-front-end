import { zodResolver } from '@hookform/resolvers/zod';
import { Bandage, CalendarRange, Droplet, FlaskConical, Info, Pill, Save, Syringe, Tablets } from 'lucide-react-native';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { AppText, Avatar, Button, Card, Chip, FormTextField, PillVisual, type IconComponent } from '../../components/ui';
import { DEFAULT_PRIMARY, TYPE_LABEL, describeAppearance, isBottle } from '../../lib/medicationMeta';
import { medicationFormSchema, type MedicationFormValues } from '../../lib/schemas';
import type { AppError } from '../../services/errors';
import { MEDICATION_TYPE_VALUES, type Elder, type MedicationAppearance, type MedicationType } from '../../types/domain';
import { radius, spacing, useTheme } from '../../theme';
import { ColorPicker } from './ColorPicker';
import { ShapePicker } from './ShapePicker';
import { TimeListEditor } from './TimeListEditor';
import { WeekdayChips } from './WeekdayChips';

const TYPE_ICON: Record<MedicationType, IconComponent> = {
  COMPRIMIDO: Tablets,
  CAPSULA: Pill,
  GOTAS: Droplet,
  INJECAO: Syringe,
  XAROPE: FlaskConical,
  ADESIVO: Bandage,
};

const COLOR_LABEL: Record<MedicationType, string> = {
  COMPRIMIDO: 'Cor',
  CAPSULA: 'Cor',
  GOTAS: 'Cor do frasco',
  XAROPE: 'Cor do frasco',
  INJECAO: 'Cor do líquido',
  ADESIVO: 'Cor do adesivo',
};

interface Props {
  defaultValues: MedicationFormValues;
  elders: Elder[];
  lockElder: boolean;
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
 * T06 — Formulário de medicamento + tratamento, com prévia ao vivo do PillVisual. Só os campos que a API guarda
 * (MedicamentoRequestDTO e TratamentoRequestDTO): nome, dosagem, tipo, formato (comprimido), cor, estoque, link da
 * bula, dias, horários, início e fim.
 */
export function MedicationForm({
  defaultValues, elders, lockElder, isEdit, submitting, submitError, submitLabel, lockMedicationFields, onSubmit,
}: Props) {
  const { colors } = useTheme();
  const { control, handleSubmit, watch, setValue, formState } = useForm<MedicationFormValues>({
    resolver: zodResolver(medicationFormSchema),
    defaultValues,
  });
  const errors = formState.errors;

  // react-hook-form não é compatível com o React Compiler (só aviso; o projeto não usa o compilador).
  // eslint-disable-next-line react-hooks/incompatible-library
  const [type, shape, primaryColor, name, dosage, elderId] = watch(['type', 'shape', 'primaryColor', 'name', 'dosage', 'elderId']);
  const appearance: MedicationAppearance = { type, shape: type === 'COMPRIMIDO' ? shape : undefined, primaryColor };

  const set = <K extends keyof MedicationFormValues>(k: K, v: MedicationFormValues[K]) =>
    setValue(k, v as never, { shouldDirty: true, shouldValidate: formState.isSubmitted });

  function changeType(t: MedicationType) {
    set('type', t);
    set('primaryColor', DEFAULT_PRIMARY[t]);
  }

  return (
    <View style={styles.wrap}>
      {/* Paciente */}
      <Card style={styles.card}>
        <AppText variant="heading" accessibilityRole="header">Paciente</AppText>
        {lockElder ? (
          <View style={styles.elderRow}>
            {(() => {
              const e = elders.find((x) => x.id === elderId);
              return e ? (
                <>
                  <Avatar name={e.name} color={e.avatarColor} size={32} />
                  <AppText variant="bodyStrong">{e.name}</AppText>
                </>
              ) : null;
            })()}
          </View>
        ) : (
          <Controller
            control={control}
            name="elderId"
            render={({ field, fieldState }) => (
              <View style={styles.gapSm}>
                <View style={styles.chips}>
                  {elders.map((e) => (
                    <Chip
                      key={e.id}
                      label={e.name}
                      selected={field.value === e.id}
                      onPress={() => field.onChange(e.id)}
                      leading={<Avatar name={e.name} color={e.avatarColor} size={24} />}
                    />
                  ))}
                </View>
                {fieldState.error ? <AppText variant="caption" color={colors.danger}>{fieldState.error.message}</AppText> : null}
              </View>
            )}
          />
        )}
      </Card>

      {/* Dados */}
      <Card style={styles.card}>
        <AppText variant="heading" accessibilityRole="header">Dados do medicamento</AppText>
        <FormTextField control={control} name="name" label="Nome do medicamento" required placeholder="Ex.: Metformina" autoCapitalize="words" maxLength={255} />
        <FormTextField control={control} name="dosage" label="Dosagem" required placeholder="Ex.: 850mg" autoCapitalize="none" maxLength={100} />
        <View style={styles.gapSm}>
          <AppText variant="label">Tipo <AppText variant="label" color={colors.danger}>*</AppText></AppText>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {MEDICATION_TYPE_VALUES.map((t) => (
              <Chip key={t} label={TYPE_LABEL[t]} icon={TYPE_ICON[t]} selected={type === t} onPress={() => changeType(t)} />
            ))}
          </View>
        </View>
      </Card>

      {/* Aparência: formato (comprimido) e cor, como a API guarda */}
      <Card style={styles.card}>
        <AppText variant="heading" accessibilityRole="header">Aparência</AppText>
        <View style={[styles.preview, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          <PillVisual appearance={appearance} size="xl" name={name || 'Prévia'} />
          <View style={styles.previewText}>
            <AppText variant="bodyStrong">{name || 'Novo remédio'} {dosage}</AppText>
            <AppText variant="caption" muted>{describeAppearance(appearance)}</AppText>
          </View>
        </View>

        {type === 'COMPRIMIDO' ? (
          <View style={styles.gapSm}>
            <AppText variant="label">Formato</AppText>
            <ShapePicker value={shape} color={primaryColor} onChange={(s) => set('shape', s)} />
          </View>
        ) : null}

        <ColorPicker label={COLOR_LABEL[type]} value={primaryColor} onChange={(c) => set('primaryColor', c)} />
      </Card>

      {/* Estoque e bula */}
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

      {/* Tratamento */}
      <Card style={styles.card}>
        <View style={styles.inline}>
          <CalendarRange color={colors.primary} size={20} />
          <AppText variant="heading" accessibilityRole="header">Esquema posológico</AppText>
        </View>
        <AppText variant="label">Dias da semana</AppText>
        <Controller
          control={control}
          name="weekdays"
          render={({ field, fieldState }) => <WeekdayChips value={field.value} onChange={field.onChange} error={fieldState.error?.message} />}
        />
        <AppText variant="label">Horários</AppText>
        <TimeListEditor control={control} errors={errors} />
        <View style={styles.sizeRow}>
          <View style={styles.flex}>
            {/* A API não deixa mudar o início de um tratamento já criado */}
            <FormTextField
              control={control}
              name="startDate"
              label="Início"
              required
              mask="date"
              keyboardType="number-pad"
              placeholder="DD/MM/AAAA"
              editable={!isEdit}
              hint={isEdit ? 'O início não pode ser alterado' : undefined}
            />
          </View>
          <View style={styles.flex}>
            <FormTextField control={control} name="endDate" label="Fim (opcional)" mask="date" keyboardType="number-pad" placeholder="Contínuo" />
          </View>
        </View>
      </Card>

      <View style={[styles.notice, { backgroundColor: colors.infoSoft }]}>
        <Info color={colors.primaryDark} size={18} />
        <AppText variant="caption" color={colors.primaryDark} style={styles.flex}>
          {isEdit
            ? 'As doses pendentes dos próximos 30 dias serão recriadas com o novo esquema. Doses já registradas não mudam (RN08).'
            : 'Serão geradas as doses dos próximos 30 dias, renovadas automaticamente todo dia.'}
        </AppText>
      </View>

      {lockMedicationFields ? (
        <View style={[styles.notice, { backgroundColor: colors.warningSoft }]} accessibilityRole="alert">
          <Info color={colors.warningText} size={18} />
          <AppText variant="caption" color={colors.warningText} style={styles.flex}>
            Os dados do remédio já estão salvos. Agora só os dias e horários serão enviados; mudanças no nome, na dosagem
            ou na aparência podem ser feitas depois, editando o remédio.
          </AppText>
        </View>
      ) : null}
      {submitError ? (
        <View style={[styles.notice, { backgroundColor: colors.dangerSoft }]} accessibilityRole="alert">
          <View style={[styles.flex, styles.gapSm]}>
            <AppText variant="bodyStrong" color={colors.danger}>{submitError.message}</AppText>
            {/* Validação da API (campos[]): o motivo de cada campo, já em português */}
            {Object.values(submitError.fieldErrors ?? {}).map((message) => (
              <AppText key={message} variant="caption" color={colors.danger}>• {message}</AppText>
            ))}
          </View>
        </View>
      ) : null}
      {formState.isSubmitted && Object.keys(errors).length > 0 ? (
        <AppText variant="caption" color={colors.danger} accessibilityRole="alert">
          Revise os campos destacados antes de salvar.
        </AppText>
      ) : null}

      <Button title={submitLabel ?? 'Salvar medicamento e tratamento'} icon={Save} size="lg" loading={submitting} onPress={handleSubmit(onSubmit)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  card: { gap: spacing.md },
  gapSm: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  elderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  notice: { flexDirection: 'row', gap: spacing.sm, borderRadius: radius.md, padding: spacing.md, alignItems: 'flex-start' },
  preview: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', borderRadius: radius.lg, borderWidth: 1, padding: spacing.md },
  previewText: { flex: 1, gap: spacing.xs },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sizeRow: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
});
