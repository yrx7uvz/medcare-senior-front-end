import Moon from 'lucide-react-native/icons/moon';
import Smartphone from 'lucide-react-native/icons/smartphone';
import Sun from 'lucide-react-native/icons/sun';
import { StyleSheet, View } from 'react-native';
import { THEME_CHOICES, type ThemeChoice } from '../../lib/themePrefs';
import { useAppStore } from '../../store/appStore';
import { spacing, useTheme } from '../../theme';
import { AppText } from './AppText';
import type { IconComponent } from './icons';
import { OptionList } from './OptionList';

const ICONS: Record<ThemeChoice, IconComponent> = { AUTO: Smartphone, light: Sun, dark: Moon };

/**
 * Tema do app (Automático / Claro / Escuro), o mesmo nas Configurações do cuidador e nos Ajustes do paciente. A escolha
 * fica guardada no aparelho e vale para as duas visões; Automático segue o tema do celular. O alto contraste do
 * paciente é separado.
 */
export function ThemeToggle() {
  const { colors, patient } = useTheme();
  const choice = useAppStore((s) => s.themeChoice);
  const setChoice = useAppStore((s) => s.setThemeChoice);
  const Icon = ICONS[choice ?? 'AUTO'];
  return (
    <View style={styles.wrap}>
      <View style={styles.title}>
        <Icon color={colors.primary} size={patient ? 28 : 22} />
        <AppText variant={patient ? 'patientStrong' : 'bodyStrong'}>Tema</AppText>
      </View>
      <OptionList
        label="Tema"
        options={THEME_CHOICES.map((o) => ({ ...o, icon: ICONS[o.value] }))}
        value={choice ?? 'AUTO'}
        onChange={(v) => setChoice(v === 'AUTO' ? null : v)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  title: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
