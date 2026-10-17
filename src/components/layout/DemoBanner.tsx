import { FlaskConical } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import { IS_DEMO } from '../../config/env';
import { AppText } from '../ui';

// Cores fixas (independem do tema claro/escuro e do tema do idoso): branco sobre âmbar escuro,
// contraste 10,09:1 (WCAG AA exige 4,5:1).
const BANNER_BG = '#5C3B00';
const BANNER_FG = '#FFFFFF';

/**
 * Faixa "MODO DEMONSTRAÇÃO" no topo de todas as telas, só quando IS_DEMO.
 * A faixa ocupa a área segura superior e as telas abaixo recebem inset superior 0,
 * para não haver espaço duplicado nem botão coberto pela faixa.
 */
export function DemoBanner({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  if (!IS_DEMO) return <>{children}</>;
  return (
    <View style={styles.flex}>
      <View
        style={[styles.bar, { paddingTop: insets.top + 4 }]}
        accessible
        accessibilityRole="text"
        accessibilityLabel="Modo demonstração. Dados fictícios."
      >
        <FlaskConical color={BANNER_FG} size={16} />
        <AppText variant="label" color={BANNER_FG}>
          MODO DEMONSTRAÇÃO — dados fictícios
        </AppText>
      </View>
      <SafeAreaInsetsContext.Provider value={{ ...insets, top: 0 }}>
        <View style={styles.flex}>{children}</View>
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingBottom: 4, paddingHorizontal: 12, backgroundColor: BANNER_BG },
});
