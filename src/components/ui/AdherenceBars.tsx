import React from 'react';
import { StyleSheet, View } from 'react-native';
import { radius, spacing, useTheme } from '../../theme';
import { AppText } from './AppText';

export interface AdherenceBarItem {
  key: string;
  label: string;
  rate: number | null;
  detail: string;
  leading?: React.ReactNode;
}

/** Barras horizontais de adesão. Faixa e valor sempre escritos, não só cor. */
export function AdherenceBars({ items }: { items: AdherenceBarItem[] }) {
  const { colors } = useTheme();
  const tone = (rate: number) =>
    rate >= 80 ? colors.status.TOMADA : rate >= 70 ? colors.status.PENDENTE : colors.status.NAO_TOMADA;
  const band = (rate: number) => (rate >= 80 ? 'boa' : rate >= 70 ? 'atenção' : 'baixa');

  return (
    <View style={styles.wrap}>
      {items.map((it) => {
        const c = it.rate === null ? null : tone(it.rate);
        return (
          <View
            key={it.key}
            style={styles.item}
            accessible
            accessibilityLabel={`${it.label}: ${it.rate === null ? 'sem doses encerradas' : `${it.rate}% de adesão, ${band(it.rate)}`}. ${it.detail}`}
          >
            <View style={styles.head}>
              {it.leading}
              <AppText variant="bodyStrong" style={styles.label} numberOfLines={1}>
                {it.label}
              </AppText>
              <AppText variant="heading" color={c?.fg ?? colors.textMuted}>
                {it.rate === null ? '—' : `${it.rate}%`}
              </AppText>
            </View>
            <View style={[styles.track, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <View style={[styles.fill, { width: `${it.rate ?? 0}%`, backgroundColor: c?.accent ?? colors.border }]} />
              <View style={[styles.mark, { left: '80%', backgroundColor: colors.textMuted }]} />
            </View>
            <AppText variant="caption" muted>
              {it.detail}
              {it.rate !== null ? ` • adesão ${band(it.rate)}` : ''}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  item: { gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { flex: 1 },
  track: { height: 14, borderRadius: radius.pill, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  fill: { height: '100%', borderRadius: radius.pill },
  mark: { position: 'absolute', top: 0, bottom: 0, width: 2, opacity: 0.6 },
});
