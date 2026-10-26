import Check from 'lucide-react-native/icons/check';
import Circle from 'lucide-react-native/icons/circle';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../components/ui';
import { passwordChecks, passwordStrength } from '../../lib/password';
import { radius, useTheme } from '../../theme';

/** Medidor de força + checklist da RN02 (texto e ícone, não só cor). */
export function PasswordStrengthMeter({ password }: { password: string }) {
  const { colors } = useTheme();
  const { score, label } = passwordStrength(password);
  const color = score >= 4 ? colors.status.CONFIRMADA_NO_HORARIO.accent : score === 3 ? colors.primary : score > 0 ? colors.status.PENDENTE.accent : colors.border;
  return (
    <View style={styles.wrap} accessible accessibilityLabel={`Força da senha: ${label}`}>
      <View style={styles.bars}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={[styles.bar, { backgroundColor: i <= score ? color : colors.skeleton }]} />
        ))}
      </View>
      <AppText variant="label">Força: {label}</AppText>
      {passwordChecks(password).map((c) => (
        <View key={c.key} style={styles.check}>
          {c.ok ? <Check color={colors.status.CONFIRMADA_NO_HORARIO.fg} size={16} strokeWidth={3} /> : <Circle color={colors.textMuted} size={14} />}
          <AppText variant="caption" color={c.ok ? colors.status.CONFIRMADA_NO_HORARIO.fg : colors.textMuted}>
            {c.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  bars: { flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 6, borderRadius: radius.pill },
  check: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
