import { StyleSheet, View } from 'react-native';
import { AppText, Card, PillVisual } from '../../../components/ui';
import { describeAppearance } from '../../../lib/medicationMeta';
import type { MedicationAppearance, MedicationType, PillShape } from '../../../types/domain';
import { radius, spacing, useTheme } from '../../../theme';
import { ColorPicker } from '../ColorPicker';
import { ShapePicker } from '../ShapePicker';

const COLOR_LABEL: Record<MedicationType, string> = {
  COMPRIMIDO: 'Cor',
  CAPSULA: 'Cor',
  GOTAS: 'Cor do frasco',
  XAROPE: 'Cor do frasco',
  INJECAO: 'Cor do líquido',
  ADESIVO: 'Cor do adesivo',
};

/** Formato (só comprimido) e cor, como a API guarda, com a prévia ao vivo do desenho do remédio. */
export function AppearanceSection({ appearance, shape, color, name, dosage, onShapeChange, onColorChange }: {
  appearance: MedicationAppearance;
  shape: PillShape;
  color: string;
  name: string;
  dosage: string;
  onShapeChange: (s: PillShape) => void;
  onColorChange: (c: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <Card style={styles.card}>
      <AppText variant="heading" accessibilityRole="header">Aparência</AppText>
      <View style={[styles.preview, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        <PillVisual appearance={appearance} size="xl" name={name || 'Prévia'} />
        <View style={styles.previewText}>
          <AppText variant="bodyStrong">{name || 'Novo remédio'} {dosage}</AppText>
          <AppText variant="caption" muted>{describeAppearance(appearance)}</AppText>
        </View>
      </View>
      {appearance.type === 'COMPRIMIDO' ? (
        <View style={styles.gapSm}>
          <AppText variant="label">Formato</AppText>
          <ShapePicker value={shape} color={color} onChange={onShapeChange} />
        </View>
      ) : null}
      <ColorPicker label={COLOR_LABEL[appearance.type]} value={color} onChange={onColorChange} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  gapSm: { gap: spacing.sm },
  preview: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', borderRadius: radius.lg, borderWidth: 1, padding: spacing.md },
  previewText: { flex: 1, gap: spacing.xs },
});
