import Circle from 'lucide-react-native/icons/circle';
import CircleDot from 'lucide-react-native/icons/circle-dot';
import { Pressable, StyleSheet, View } from 'react-native';
import { radius, spacing, touch, useTheme } from '../../theme';
import { AppText } from './AppText';
import type { IconComponent } from './icons';

export interface Option<T extends string> {
  value: T;
  label: string;
  icon?: IconComponent;
}

interface Props<T extends string> {
  /** Nome do grupo para o leitor de tela (ex.: "Tema"). */
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}

/**
 * Escolha única em lista (botões de opção): cada linha é um alvo inteiro (48 dp; 64 dp nas telas do paciente), o
 * leitor de tela anuncia "opção, marcada" e a marcação aparece na borda, no fundo e no ícone, não só na cor.
 */
export function OptionList<T extends string>({ label, options, value, onChange, disabled }: Props<T>) {
  const { colors, patient } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.list}>
      {options.map((o) => {
        const checked = o.value === value;
        const Mark = checked ? CircleDot : Circle;
        const Icon = o.icon;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ checked, disabled: !!disabled }}
            disabled={disabled}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => [
              styles.row,
              {
                minHeight: patient ? touch.patient : touch.min,
                borderColor: checked ? colors.primary : colors.inputBorder,
                backgroundColor: checked ? colors.primarySoft : colors.surface,
                opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
              },
            ]}
          >
            {Icon ? <Icon color={checked ? colors.primary : colors.text} size={patient ? 26 : 20} /> : null}
            <AppText variant={patient ? 'patientBody' : 'bodyStrong'} style={styles.flex}>
              {o.label}
            </AppText>
            <Mark color={checked ? colors.primary : colors.textMuted} size={patient ? 28 : 22} strokeWidth={2.4} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 2,
  },
  flex: { flex: 1 },
});
