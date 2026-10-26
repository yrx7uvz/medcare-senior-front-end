import Check from 'lucide-react-native/icons/check';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { radius, spacing, useTheme } from '../../theme';

interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
  accessibilityLabel: string;
  error?: boolean;
}

export function Checkbox({ checked, onChange, children, accessibilityLabel, error }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      onPress={() => onChange(!checked)}
      style={styles.row}
    >
      <View
        style={[
          styles.box,
          {
            borderColor: error ? colors.danger : checked ? colors.primary : colors.textMuted,
            backgroundColor: checked ? colors.primary : colors.inputBackground,
          },
        ]}
      >
        {checked ? <Check color={colors.onPrimary} size={18} strokeWidth={3} /> : null}
      </View>
      <View style={styles.label}>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', minHeight: 48, paddingVertical: spacing.xs },
  box: { width: 26, height: 26, borderRadius: radius.sm - 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  label: { flex: 1 },
});
