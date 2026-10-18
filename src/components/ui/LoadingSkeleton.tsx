import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';
import { radius, spacing, useTheme } from '../../theme';

function Block({ width, height, round }: { width: number | `${number}%`; height: number; round?: boolean }) {
  const { colors } = useTheme();
  return <View style={{ width, height, borderRadius: round ? height / 2 : radius.sm, backgroundColor: colors.skeleton }} />;
}

/** Skeleton com pulso suave (desligado se o sistema pedir menos movimento). */
export function LoadingSkeleton({ variant = 'list', rows = 4 }: { variant?: 'list' | 'dashboard' | 'elder'; rows?: number }) {
  const { colors } = useTheme();
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.5, duration: 650, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        ]),
      );
      loop.start();
    });
    return () => loop?.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.wrap, { opacity }]} accessible accessibilityLabel="Carregando" accessibilityRole="progressbar">
      {variant === 'dashboard' ? (
        <View style={styles.summary}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
              <Block width={36} height={26} />
              <Block width="80%" height={10} />
            </View>
          ))}
        </View>
      ) : null}
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={[styles.row, { backgroundColor: colors.surface, minHeight: variant === 'elder' ? 96 : 76 }]}>
          <Block width={variant === 'elder' ? 64 : 44} height={variant === 'elder' ? 64 : 44} />
          <View style={styles.lines}>
            <Block width="60%" height={variant === 'elder' ? 20 : 14} />
            <Block width="40%" height={variant === 'elder' ? 16 : 10} />
          </View>
          <Block width={64} height={22} round />
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  summary: { flexDirection: 'row', gap: spacing.sm },
  summaryCard: { flex: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg },
  lines: { flex: 1, gap: spacing.sm },
});
