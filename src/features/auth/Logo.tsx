import { StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { spacing, useTheme } from '../../theme';
import { AppText } from '../../components/ui';
import { logoColors } from '../../theme/colors';

/** Marca: cápsula com cruz de cuidado. */
export function Logo({ light }: { light?: boolean }) {
  const { colors } = useTheme();
  const fg = light ? colors.onHeader : colors.primary;
  return (
    <View style={styles.row} accessible accessibilityLabel="MedCare Sênior">
      <Svg width={44} height={44} viewBox="0 0 44 44">
        <Rect x={2} y={12} width={40} height={20} rx={10} fill={light ? logoColors.light : colors.primary} />
        <Path d="M22 12 H32 a10 10 0 0 1 0 20 H22 Z" fill={light ? logoColors.lightAccent : colors.primaryDark} />
        <Path d="M10 22 h6 M13 19 v6" stroke={light ? colors.primary : logoColors.onPrimary} strokeWidth={2.4} strokeLinecap="round" />
      </Svg>
      <AppText variant="display" color={fg}>
        MedCare <AppText variant="display" color={light ? logoColors.lightAccent : colors.primaryDark}>Sênior</AppText>
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm } });
