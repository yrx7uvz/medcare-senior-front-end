import Bandage from 'lucide-react-native/icons/bandage';
import Droplet from 'lucide-react-native/icons/droplet';
import FlaskConical from 'lucide-react-native/icons/flask-conical';
import Pill from 'lucide-react-native/icons/pill';
import Syringe from 'lucide-react-native/icons/syringe';
import Tablets from 'lucide-react-native/icons/tablets';
import type { Control } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { AppText, Card, Chip, FormTextField, type IconComponent } from '../../../components/ui';
import { TYPE_LABEL } from '../../../lib/medicationMeta';
import type { MedicationFormValues } from '../../../lib/schemas';
import { MEDICATION_TYPE_VALUES, type MedicationType } from '../../../types/domain';
import { spacing, useTheme } from '../../../theme';

const TYPE_ICON: Record<MedicationType, IconComponent> = {
  COMPRIMIDO: Tablets,
  CAPSULA: Pill,
  GOTAS: Droplet,
  INJECAO: Syringe,
  XAROPE: FlaskConical,
  ADESIVO: Bandage,
};

/** Nome, dosagem e tipo (obrigatórios). */
export function MedicationDataSection({ control, type, onTypeChange }: {
  control: Control<MedicationFormValues>;
  type: MedicationType;
  onTypeChange: (t: MedicationType) => void;
}) {
  const { colors } = useTheme();
  return (
    <Card style={styles.card}>
      <AppText variant="heading" accessibilityRole="header">Dados do medicamento</AppText>
      <FormTextField control={control} name="name" label="Nome do medicamento" required placeholder="Ex.: Metformina" autoCapitalize="words" maxLength={255} />
      <FormTextField control={control} name="dosage" label="Dosagem" required placeholder="Ex.: 850mg" autoCapitalize="none" maxLength={100} />
      <View style={styles.gapSm}>
        <AppText variant="label">Tipo <AppText variant="label" color={colors.danger}>*</AppText></AppText>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {MEDICATION_TYPE_VALUES.map((t) => (
            <Chip key={t} label={TYPE_LABEL[t]} icon={TYPE_ICON[t]} selected={type === t} onPress={() => onTypeChange(t)} />
          ))}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  gapSm: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
