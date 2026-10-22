import { useAppStore } from '../store/appStore';
import { DEFAULT_THEME_PREFS } from './themePrefs';
import { themeStorage } from './secureStorage';

/**
 * Lê a aparência guardada antes da primeira tela (o app mostra só o carregamento da marca até aqui, para nunca piscar o
 * tema claro). Falha de leitura não trava: vale o padrão (tema do sistema, sem alto contraste).
 */
export async function hydrateTheme(): Promise<void> {
  let prefs = DEFAULT_THEME_PREFS;
  try {
    prefs = await themeStorage.load();
  } catch {
    // Mantém o padrão
  }
  useAppStore.getState().setThemePrefs(prefs);
}

/** Grava no aparelho cada troca de tema ou de alto contraste (depois de hidratado). Devolve a função que para. */
export function persistTheme(): () => void {
  return useAppStore.subscribe((s, prev) => {
    if (!s.themeLoaded) return;
    if (s.themeChoice === prev.themeChoice && s.elderHighContrast === prev.elderHighContrast) return;
    void themeStorage.save({ mode: s.themeChoice, elderHighContrast: s.elderHighContrast }).catch(() => undefined);
  });
}
