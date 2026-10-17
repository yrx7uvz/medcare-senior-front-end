import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import type { IconComponent } from './icons';

interface Props {
  icon: IconComponent;
  onPress: () => void;
  accessibilityLabel: string;
  color?: string;
  background?: string;
  size?: number;
  disabled?: boolean;
}

export function IconButton({ icon: Icon, onPress, accessibilityLabel, color, background, size = 48, disabled }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: background ?? 'transparent', opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}
    >
      <Icon color={color ?? colors.text} size={Math.round(size * 0.46)} strokeWidth={2.2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({ btn: { alignItems: 'center', justifyContent: 'center' } });
