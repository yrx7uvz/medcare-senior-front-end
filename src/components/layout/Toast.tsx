import CheckCircle2 from 'lucide-react-native/icons/circle-check';
import Info from 'lucide-react-native/icons/info';
import XCircle from 'lucide-react-native/icons/circle-x';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../../store/appStore';
import { radius, spacing, useTheme } from '../../theme';
import { AppText } from '../ui';
import { palette } from '../../theme/colors';

export function Toast() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useAppStore((s) => s.toast);
  const hide = useAppStore((s) => s.hideToast);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(hide, 3200);
    return () => clearTimeout(t);
  }, [toast, hide]);

  if (!toast) return null;
  const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'danger' ? XCircle : Info;
  const fg = toast.tone === 'success' ? colors.status.CONFIRMADA_NO_HORARIO.fg : toast.tone === 'danger' ? colors.danger : colors.primaryDark;
  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + spacing.sm }]}>
      <View
        style={[styles.toast, { backgroundColor: colors.surface, borderColor: fg }]}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
      >
        <Icon color={fg} size={20} />
        <AppText variant="bodyStrong" style={styles.text}>
          {toast.message}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    elevation: 6,
    shadowColor: palette.black,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  text: { flexShrink: 1 },
});
