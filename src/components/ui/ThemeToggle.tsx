import { Moon, Sun } from 'lucide-react-native';
import { useAppStore } from '../../store/appStore';
import { useTheme, useThemeMode } from '../../theme';
import { AppSwitch } from './AppSwitch';

/** Tema escuro do cuidador: a escolha fica guardada no aparelho; sem escolha, vale o tema do sistema. */
export function ThemeToggle() {
  const { colors } = useTheme();
  const mode = useThemeMode();
  const choice = useAppStore((s) => s.themeChoice);
  const toggle = useAppStore((s) => s.toggleTheme);
  const Icon = mode === 'dark' ? Moon : Sun;
  return (
    <AppSwitch
      label="Tema escuro"
      description={choice === null ? 'Seguindo o tema do celular' : undefined}
      icon={<Icon color={colors.primary} size={22} />}
      value={mode === 'dark'}
      onValueChange={() => toggle(mode)}
    />
  );
}
