import { StyleSheet, View } from 'react-native';
import { radius, useTheme } from '../../theme';
import { AppText } from './AppText';
import type { IconComponent } from './icons';

type Tone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

export function Badge({ label, tone = 'neutral', icon: Icon }: { label: string; tone?: Tone; icon?: IconComponent }) {
  const { colors } = useTheme();
  const map: Record<Tone, { bg: string; fg: string }> = {
    info: { bg: colors.primarySoft, fg: colors.primaryDark },
    success: { bg: colors.status.TOMADA.bg, fg: colors.status.TOMADA.fg },
    warning: { bg: colors.warningSoft, fg: colors.warningText },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    neutral: { bg: colors.surfaceAlt, fg: colors.textMuted },
  };
  const c = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      {Icon ? <Icon color={c.fg} size={13} strokeWidth={2.4} /> : null}
      <AppText variant="caption" color={c.fg} style={styles.text}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
  text: { fontFamily: 'NunitoSans_700Bold' },
});
