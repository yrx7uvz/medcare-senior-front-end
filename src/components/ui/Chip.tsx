import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { radius, spacing, touch, useTheme } from '../../theme';
import { AppText } from './AppText';
import type { IconComponent } from './icons';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconComponent;
  leading?: React.ReactNode;
  accessibilityLabel?: string;
  disabled?: boolean;
}

export function Chip({ label, selected, onPress, icon: Icon, leading, accessibilityLabel, disabled }: Props) {
  const { colors } = useTheme();
  const fg = selected ? colors.onPrimary : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.inputBorder,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {leading}
      {Icon ? <Icon color={fg} size={16} strokeWidth={2.2} /> : null}
      <AppText variant="label" color={fg}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: touch.min,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
