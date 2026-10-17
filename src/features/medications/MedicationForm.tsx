import { zodResolver } from '@hookform/resolvers/zod';
import {
  Bandage, CalendarRange, Droplet, FlaskConical, Info, Pill, Save, Search, SearchX, Sparkles, Syringe, Tablets,
} from 'lucide-react-native';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Switch, View } from 'react-native';
import {
  AppText, Avatar, Button, Card, Chip, FormTextField, PillSizeLegend, PillVisual, type IconComponent,
} from '../../components/ui';
import { services } from '../../services';
import { DEFAULT_PRIMARY, DEFAULT_SECONDARY, TYPE_LABEL, describeAppearance, hasPhysicalSize, isBottle } from '../../lib/medicationMeta';
import { medicationFormSchema, parseMm, type MedicationFormValues } from '../../lib/schemas';
import type { AppError } from '../../services/errors';
import { MEDICATION_TYPE_VALUES, type Elder, type MedicationAppearance, type MedicationType } from '../../types/domain';
import type { MedicationInfo } from '../../types/views';
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

type LookupState = { status: 'idle' | 'loading' | 'notfound' | 'error' } | { status: 'found'; info: MedicationInfo };

interface Props {
  defaultValues: MedicationFormValues;
  elders: Elder[];
  lockElder: boolean;
  isEdit: boolean;
  submitting: boolean;
  submitError?: AppError;
  onSubmit: (v: MedicationFormValues) => void;
}

/** T06 — Formulário de medicamento + tratamento, com prévia ao vivo do PillVisual. */
export function MedicationForm({ defaultValues, elders, lockElder, isEdit, submitting, submitError, onSubmit }: Props) {
  const { colors } = useTheme();
  const { control, handleSubmit, watch, setValue, getValues, formState } = useForm<MedicationFormValues>({
    resolver: zodResolver(medicationFormSchema),
    defaultValues,
  });
  const errors = formState.errors;
  const [lookup, setLookup] = useState<LookupState>({ status: 'idle' });

  // react-hook-form não é compatível com o React Compiler (só aviso; o projeto não usa o compilador).
  // eslint-disable-next-line react-hooks/incompatible-library
  const [type, shape, primaryColor, secondaryColor, lengthMm, widthMm, imprint, hasScore, name, dosage, source, elderId] = watch([
    'type', 'shape', 'primaryColor', 'secondaryColor', 'lengthMm', 'widthMm', 'imprint', 'hasScore', 'name', 'dosage', 'appearanceSource', 'elderId',
  ]);
  const length = parseMm(lengthMm);
  const appearance: MedicationAppearance = {
    type,
    shape,
    primaryColor,
    secondaryColor,
    lengthMm: length,
    widthMm: type === 'COMPRIMIDO' && shape === 'REDONDO' ? length : parseMm(widthMm),
    imprint: imprint || undefined,
    hasScore,
  };

  const set = <K extends keyof MedicationFormValues>(k: K, v: MedicationFormValues[K]) =>
    setValue(k, v as never, { shouldDirty: true, shouldValidate: formState.isSubmitted });

  function changeType(t: MedicationType) {
    set('type', t);
    set('primaryColor', DEFAULT_PRIMARY[t]);
    set('secondaryColor', DEFAULT_SECONDARY[t]);
    if (!hasPhysicalSize(t)) {
      set('lengthMm', '');
      set('widthMm', '');
    }
  }

  async function runLookup() {
    const query = getValues('name').trim();
    if (query.length < 3) {
      setLookup({ status: 'notfound' });
      return;
    }
    setLookup({ status: 'loading' });
    try {
      const info = await services.medicationInfo.lookup(query);
      if (!info) {
        setLookup({ status: 'notfound' });
        return;
      }
      set('name', info.name);
      set('type', info.type);
      set('shape', info.shape ?? 'REDONDO');
      set('primaryColor', info.primaryColor ?? DEFAULT_PRIMARY[info.type]);
      set('secondaryColor', info.secondaryColor ?? DEFAULT_SECONDARY[info.type]);
      set('lengthMm', info.lengthMm ? String(info.lengthMm) : '');
      set('widthMm', info.widthMm ? String(info.widthMm) : '');
      set('imprint', info.imprint ?? '');
      set('hasScore', !!info.hasScore);
      set('appearanceSource', 'EXTERNA');
      if (!getValues('dosage') && info.suggestedDosages.length === 1) set('dosage', info.suggestedDosages[0]);
      setLookup({ status: 'found', info });
    } catch {
      setLookup({ status: 'error' });
    }
  }

  const round = type === 'COMPRIMIDO' && shape === 'REDONDO';
  const colorLabels: Record<MedicationType, [string, string | null]> = {
    COMPRIMIDO: ['Cor', null],
    CAPSULA: ['Cor da metade esquerda', 'Cor da metade direita'],
    GOTAS: ['Cor do frasco', 'Cor do conta-gotas'],
    XAROPE: ['Cor do frasco', 'Cor da tampa'],
    INJECAO: ['Cor do líquido', null],
    ADESIVO: ['Cor do adesivo', null],
  };
  const [primaryLabel, secondaryLabel] = colorLabels[type];

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
        <FormTextField control={control} name="name" label="Nome do medicamento" required placeholder="Ex.: Metformina" autoCapitalize="words" />
        <Button
          title="Buscar dados do remédio"
          icon={Search}
          variant="secondary"
          onPress={runLookup}
          loading={lookup.status === 'loading'}
          disabled={name.trim().length < 3}
          accessibilityHint="Preenche formato, cor, tamanho e marcação a partir do nome"
        />
        {lookup.status === 'found' ? (
          <View style={[styles.notice, { backgroundColor: colors.infoSoft }]} accessibilityLiveRegion="polite">
            <Sparkles color={colors.primaryDark} size={18} />
            <View style={styles.flex}>
              <AppText variant="bodyStrong" color={colors.primaryDark}>Dados preenchidos. Confira e ajuste se preciso.</AppText>
              <AppText variant="caption" color={colors.primaryDark}>Fonte: {lookup.info.source}</AppText>
              {lookup.info.suggestedDosages.length > 1 ? (
                <View style={[styles.chips, { marginTop: spacing.sm }]}>
                  {lookup.info.suggestedDosages.map((d) => (
                    <Chip key={d} label={d} selected={dosage === d} onPress={() => set('dosage', d)} accessibilityLabel={`Usar dosagem ${d}`} />
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
        {lookup.status === 'notfound' || lookup.status === 'error' ? (
          <View style={[styles.notice, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderWidth: 1 }]} accessibilityLiveRegion="polite">
            <SearchX color={colors.textMuted} size={20} />
            <View style={styles.flex}>
              <AppText variant="bodyStrong">
                {lookup.status === 'error' ? 'A busca falhou' : `Não encontramos dados para “${name.trim()}”`}
              </AppText>
              <AppText variant="caption" muted>Preencha a aparência manualmente abaixo, olhando a caixa ou o comprimido.</AppText>
            </View>
          </View>
        ) : null}
        <FormTextField control={control} name="dosage" label="Dosagem" required placeholder="Ex.: 850mg" autoCapitalize="none" />
        <View style={styles.gapSm}>
          <AppText variant="label">Tipo <AppText variant="label" color={colors.danger}>*</AppText></AppText>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {MEDICATION_TYPE_VALUES.map((t) => (
              <Chip key={t} label={TYPE_LABEL[t]} icon={TYPE_ICON[t]} selected={type === t} onPress={() => changeType(t)} />
            ))}
          </View>
        </View>
      </Card>

      {/* Aparência */}
      <Card style={styles.card}>
        <AppText variant="heading" accessibilityRole="header">Aparência</AppText>
        <View style={[styles.preview, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          <PillVisual appearance={appearance} size="xl" name={name || 'Prévia'} />
          <View style={styles.previewText}>
            <AppText variant="bodyStrong">{name || 'Novo remédio'} {dosage}</AppText>
            <AppText variant="caption" muted>{describeAppearance(appearance)}</AppText>
            <PillSizeLegend appearance={appearance} />
          </View>
        </View>
        {source === 'EXTERNA' ? (
          <View style={styles.inline}>
            <Info color={colors.warningText} size={16} />
            <AppText variant="caption" color={colors.warningText} style={styles.flex}>
              Aparência pode variar conforme o fabricante.
            </AppText>
          </View>
        ) : null}

        {type === 'COMPRIMIDO' ? (
          <View style={styles.gapSm}>
            <AppText variant="label">Formato</AppText>
            <ShapePicker value={shape} color={primaryColor} onChange={(s) => set('shape', s)} />
          </View>
        ) : null}

        <ColorPicker label={primaryLabel} value={primaryColor} onChange={(c) => set('primaryColor', c)} />
        {secondaryLabel ? <ColorPicker label={secondaryLabel} value={secondaryColor} onChange={(c) => set('secondaryColor', c)} /> : null}

        {hasPhysicalSize(type) ? (
          <View style={styles.sizeRow}>
            <View style={styles.flex}>
              <FormTextField control={control} name="lengthMm" label={round ? 'Diâmetro (mm)' : 'Comprimento (mm)'} keyboardType="decimal-pad" placeholder="Ex.: 12" />
            </View>
            {!round ? (
              <View style={styles.flex}>
                <FormTextField control={control} name="widthMm" label="Largura (mm)" keyboardType="decimal-pad" placeholder="Ex.: 6" />
              </View>
            ) : null}
          </View>
        ) : null}

        {type === 'COMPRIMIDO' || type === 'CAPSULA' ? (
          <FormTextField control={control} name="imprint" label="Marcação no remédio (opcional)" placeholder="Ex.: 850" autoCapitalize="characters" maxLength={12} />
        ) : null}

        {type === 'COMPRIMIDO' ? (
          <Controller
            control={control}
            name="hasScore"
            render={({ field }) => (
              <View style={styles.switchRow}>
                <View style={styles.flex}>
                  <AppText variant="bodyStrong">Tem linha de divisão (sulco)</AppText>
                  <AppText variant="caption" muted>O risco no meio que permite partir o comprimido.</AppText>
                </View>
                <Switch
                  accessibilityLabel="Tem linha de divisão"
                  value={field.value}
                  onValueChange={field.onChange}
                  trackColor={{ true: colors.primary, false: colors.border }}
                />
              </View>
            )}
          />
        ) : null}
      </Card>

      {/* Estoque e bula */}
      <Card style={styles.card}>
        <AppText variant="heading" accessibilityRole="header">Estoque e orientações</AppText>
        <View style={styles.sizeRow}>
          <View style={styles.flex}>
            <FormTextField control={control} name="stock" label={isBottle(type) ? 'Estoque (frascos)' : 'Estoque (unidades)'} keyboardType="number-pad" />
          </View>
          <View style={styles.flex}>
            <FormTextField control={control} name="doseQuantity" label="Quantidade por dose" placeholder={type === 'XAROPE' ? 'Ex.: 15 mL' : type === 'GOTAS' ? 'Ex.: 7 gotas' : 'Ex.: 1 comprimido'} />
          </View>
        </View>
        <FormTextField control={control} name="leaflet" label="Bula / observações" multiline placeholder="Ex.: tomar com alimento. Evitar álcool." />
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
            <FormTextField control={control} name="startDate" label="Início" required mask="date" keyboardType="number-pad" placeholder="DD/MM/AAAA" />
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

      {submitError ? (
        <View style={[styles.notice, { backgroundColor: colors.dangerSoft }]} accessibilityRole="alert">
          <AppText variant="bodyStrong" color={colors.danger}>{submitError.message}</AppText>
        </View>
      ) : null}
      {formState.isSubmitted && Object.keys(errors).length > 0 ? (
        <AppText variant="caption" color={colors.danger} accessibilityRole="alert">
          Revise os campos destacados antes de salvar.
        </AppText>
      ) : null}

      <Button title="Salvar medicamento e tratamento" icon={Save} size="lg" loading={submitting} onPress={handleSubmit(onSubmit)} />
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
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56 },
  flex: { flex: 1 },
});
