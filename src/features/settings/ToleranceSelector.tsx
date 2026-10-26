import Minus from 'lucide-react-native/icons/minus';
import Plus from 'lucide-react-native/icons/plus';
import { StyleSheet, View } from 'react-native';
import { AppText, Chip, IconButton } from '../../components/ui';
import { TOLERANCE_MAX, TOLERANCE_MIN, TOLERANCE_STEP, closesAfterMinutes } from '../../lib/doseRules';
import { pad } from '../../lib/date';
import { radius, spacing, useTheme } from '../../theme';

const PRESETS = [15, 30, 45, 60, 90, 120];

const at = (h: number, addMin: number) => {
  const total = h * 60 + addMin;
  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
};

/** Tolerância de 5 a 120 min em passos de 5, com o exemplo do que acontece com uma dose das 08:00. */
export function ToleranceSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { colors } = useTheme();
  const clamp = (v: number) => Math.max(TOLERANCE_MIN, Math.min(TOLERANCE_MAX, v));
  return (
    <View style={styles.wrap}>
      <View style={styles.stepper} accessibilityRole="adjustable" accessibilityLabel="Tolerância de alerta" accessibilityValue={{ text: `${value} minutos` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => onChange(clamp(value + (e.nativeEvent.actionName === 'increment' ? TOLERANCE_STEP : -TOLERANCE_STEP)))}
      >
        <IconButton icon={Minus} accessibilityLabel="Diminuir 5 minutos" background={colors.primarySoft} color={colors.primary} size={52}
          disabled={value <= TOLERANCE_MIN} onPress={() => onChange(clamp(value - TOLERANCE_STEP))} />
        <View style={styles.value}>
          <AppText variant="number" color={colors.primaryDark}>{value}</AppText>
          <AppText variant="label" muted>minutos</AppText>
        </View>
        <IconButton icon={Plus} accessibilityLabel="Aumentar 5 minutos" background={colors.primarySoft} color={colors.primary} size={52}
          disabled={value >= TOLERANCE_MAX} onPress={() => onChange(clamp(value + TOLERANCE_STEP))} />
      </View>
      <View style={styles.chips}>
        {PRESETS.map((p) => (
          <Chip key={p} label={`${p} min`} selected={value === p} onPress={() => onChange(p)} />
        ))}
      </View>
      <View style={[styles.timeline, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        <AppText variant="label">Exemplo: dose das 08:00</AppText>
        <Step color={colors.status.PENDENTE.accent} time="07:00" text="Já pode ser confirmada (1 h antes)." />
        <Step color={colors.status.PENDENTE.accent} time="08:00" text="Horário da dose." />
        <Step color={colors.status.ATRASADA.accent} time={at(8, value)} text="Sem confirmação: você recebe o aviso. A dose continua pendente." />
        <Step color={colors.status.CONFIRMADA_COM_ATRASO.accent} time={`até ${at(8, closesAfterMinutes(value))}`} text="Ainda pode ser confirmada, como “com atraso” (30 min depois do aviso)." />
        <Step color={colors.status.NAO_TOMADA.accent} time={`após ${at(8, closesAfterMinutes(value))}`} text="Passa a “Não confirmada”." />
      </View>
    </View>
  );
}

function Step({ color, time, text }: { color: string; time: string; text: string }) {
  return (
    <View style={styles.step} accessible accessibilityLabel={`${time}: ${text}`}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <AppText variant="bodyStrong" style={styles.time}>{time}</AppText>
      <AppText variant="caption" muted style={styles.flex}>{text}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xl },
  value: { alignItems: 'center', minWidth: 90 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  timeline: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, gap: spacing.sm },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  time: { width: 82 },
  flex: { flex: 1 },
});
