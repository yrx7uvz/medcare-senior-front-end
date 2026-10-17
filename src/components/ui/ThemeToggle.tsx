import { Moon, Sun } from 'lucide-react-native';
import { StyleSheet, Switch, View } from 'react-native';
import { useAppStore } from '../../store/appStore';
import { spacing, useTheme } from '../../theme';
import { AppText } from './AppText';

export function ThemeToggle() {
  const { colors } = useTheme();
  const mode = useAppStore((s) => s.themeMode);
  const toggle = useAppStore((s) => s.toggleTheme);
  const Icon = mode === 'dark' ? Moon : Sun;
  return (
    <View style={styles.row}>
      <Icon color={colors.primary} size={22} />
      <View style={styles.texts}>
        <AppText variant="bodyStrong">Tema escuro</AppText>
        <AppText variant="caption" muted>
          {mode === 'dark' ? 'Ativado' : 'Desativado'}
        </AppText>
      </View>
      <Switch
        accessibilityLabel="Tema escuro"
        value={mode === 'dark'}
        onValueChange={toggle}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56 },
  texts: { flex: 1 },
});
