import { Ruler } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import type { MedicationAppearance } from '../../types/domain';
import { hasPhysicalSize, isBottle, sizeComparison } from '../../lib/medicationMeta';
import { spacing, useTheme } from '../../theme';
import { AppText } from './AppText';

/**
 * No Android, 1 dp ≈ 1/160 polegada, então 1 mm ≈ 6,3 dp. A régua usa essa
 * escala para mostrar o comprimento real aproximado do comprimido.
 */
const DP_PER_MM = 160 / 25.4;

interface Props {
  appearance: MedicationAppearance;
  doseQuantity?: string;
  patient?: boolean;
}

export function PillSizeLegend({ appearance, doseQuantity, patient }: Props) {
  const { colors } = useTheme();
  const variant = patient ? 'patientBody' : 'caption';
  const { lengthMm, widthMm, type } = appearance;

  if (!hasPhysicalSize(type)) {
    const text = isBottle(type)
      ? `Líquido${doseQuantity ? `: ${doseQuantity} por dose` : ''}. Use o medidor da embalagem.`
      : `Aplicação${doseQuantity ? `: ${doseQuantity}` : ''}.`;
    return (
      <View style={styles.row} accessible accessibilityLabel={text}>
        <AppText variant={variant} muted align={patient ? 'center' : 'left'}>
          {text}
        </AppText>
      </View>
    );
  }

  if (!lengthMm) {
    return (
      <AppText variant={variant} muted align={patient ? 'center' : 'left'}>
        Tamanho não informado.
      </AppText>
    );
  }

  const comparison = sizeComparison(lengthMm);
  const dims = widthMm && widthMm !== lengthMm ? `${lengthMm} × ${widthMm} mm` : `${lengthMm} mm`;
  const rulerMm = Math.max(20, Math.ceil(lengthMm / 5) * 5);
  const w = rulerMm * DP_PER_MM + 16;
  const h = patient ? 46 : 38;
  const text = `Tamanho real aproximado: ${dims}${comparison ? `, ${comparison}` : ''}.`;

  return (
    <View style={[styles.wrap, patient && styles.center]} accessible accessibilityLabel={text}>
      <View style={[styles.row, patient && styles.center]}>
        <Ruler color={colors.textMuted} size={patient ? 22 : 14} />
        <AppText variant={patient ? 'patientStrong' : 'label'} muted={!patient}>
          Tamanho real aproximado: {dims}
        </AppText>
      </View>
      <Svg width={w} height={h}>
        <Rect x={8} y={6} width={lengthMm * DP_PER_MM} height={10} rx={5} fill={colors.primary} opacity={0.85} />
        <Line x1={8} y1={22} x2={8 + rulerMm * DP_PER_MM} y2={22} stroke={colors.textMuted} strokeWidth={1.2} />
        {Array.from({ length: rulerMm + 1 }, (_, i) => (
          <Line
            key={i}
            x1={8 + i * DP_PER_MM}
            y1={22}
            x2={8 + i * DP_PER_MM}
            y2={i % 5 === 0 ? 30 : 26}
            stroke={colors.textMuted}
            strokeWidth={i % 5 === 0 ? 1.4 : 0.8}
          />
        ))}
        {Array.from({ length: rulerMm / 5 + 1 }, (_, i) => (
          <SvgText key={i} x={8 + i * 5 * DP_PER_MM} y={h - 1} fontSize={patient ? 12 : 9} fill={colors.textMuted} textAnchor="middle">
            {i * 5}
          </SvgText>
        ))}
      </Svg>
      {comparison ? (
        <AppText variant={variant} muted align={patient ? 'center' : 'left'}>
          {comparison.charAt(0).toUpperCase() + comparison.slice(1)}.
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
