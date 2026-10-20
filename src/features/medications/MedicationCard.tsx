import { CalendarClock, Trash2 } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Badge, IconButton, PillVisual } from '../../components/ui';
import { TYPE_LABEL, stockLabel } from '../../lib/medicationMeta';
import type { MedicationView } from '../../types/views';
import { cardShadow, radius, spacing, useTheme } from '../../theme';

interface Props {
  item: MedicationView;
  showElder?: boolean;
  onPress: () => void;
  onRemove: () => void;
}

/** T05 — Item da lista de remédios. */
export function MedicationCard({ item, showElder, onPress, onRemove }: Props) {
  const { colors, mode } = useTheme();
  const m = item.medication;
  const stock = stockLabel(m);
  const line = [m.dosage, TYPE_LABEL[m.type], stock ? `Estoque: ${stock}` : null].filter(Boolean).join(' • ');
  return (
    <View style={[styles.card, cardShadow(mode === 'dark'), { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${m.name}. ${line}. ${item.activeTreatment ? 'Tratamento ativo' : 'Sem tratamento ativo'}. ${item.scheduleSummary}${showElder ? `. Paciente: ${item.elderName}` : ''}`}
        accessibilityHint="Abre para editar o remédio e o tratamento"
        onPress={onPress}
        style={({ pressed }) => [styles.main, { opacity: pressed ? 0.85 : 1 }]}
      >
        <PillVisual appearance={m} size="md" />
        <View style={styles.texts}>
          <AppText variant="heading" numberOfLines={1}>{m.name}</AppText>
          <AppText variant="caption" muted>{line}</AppText>
          <View style={styles.schedule}>
            <CalendarClock color={colors.textMuted} size={14} />
            <AppText variant="caption" muted numberOfLines={1} style={styles.flex}>{item.scheduleSummary}</AppText>
          </View>
          <View style={styles.badges}>
            {item.activeTreatment ? <Badge label="Tratamento ativo" tone="success" /> : <Badge label="Sem tratamento ativo" />}            {showElder ? <Badge label={item.elderName} tone="info" /> : null}
          </View>
        </View>
      </Pressable>
      <IconButton icon={Trash2} color={colors.danger} accessibilityLabel={`Remover ${m.name}`} onPress={onRemove} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, paddingRight: spacing.xs },
  main: { flex: 1, flexDirection: 'row', gap: spacing.md, padding: spacing.md, alignItems: 'center' },
  texts: { flex: 1, gap: 3 },
  schedule: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  flex: { flex: 1 },
});
