import { StyleSheet, View } from 'react-native';
import { initials } from '../../lib/date';
import { useTheme } from '../../theme';
import { AppText } from './AppText';

interface Props {
  name: string;
  color: string;
  size?: number;
  alert?: boolean;
}

export function Avatar({ name, color, size = 32, alert }: Props) {
  const { colors } = useTheme();
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
        <AppText variant="label" color="#FFFFFF" style={{ fontSize: size * 0.38, lineHeight: size * 0.5 }} maxFontSizeMultiplier={1}>
          {initials(name)}
        </AppText>
      </View>
      {alert ? (
        <View
          style={[
            styles.dot,
            { backgroundColor: colors.status.NAO_TOMADA.accent, borderColor: colors.surface, width: size * 0.36, height: size * 0.36, borderRadius: size },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: -2, right: -2, borderWidth: 2 },
});
