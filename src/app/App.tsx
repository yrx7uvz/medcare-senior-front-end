import { Nunito_700Bold, Nunito_800ExtraBold, useFonts } from '@expo-google-fonts/nunito';
import { NunitoSans_400Regular, NunitoSans_600SemiBold, NunitoSans_700Bold } from '@expo-google-fonts/nunito-sans';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ConfigErrorScreen } from '../components/layout/ConfigErrorScreen';
import { DemoBanner } from '../components/layout/DemoBanner';
import { ProfileSwitcher } from '../components/layout/ProfileSwitcher';
import { Toast } from '../components/layout/Toast';
import { API_CONFIG_PROBLEM, IS_DEMO } from '../config/env';
import { startPush } from '../lib/pushSession';
import { bootSession, registerSessionHandlers } from '../lib/session';
import { hydrateTheme, persistTheme } from '../lib/themeSession';
import { useAppStore } from '../store/appStore';
import { ThemeProvider, bootColors } from '../theme';
import { RootNavigator } from './navigation/RootNavigator';

export default function App() {
  const [fontsLoaded] = useFonts({
    Nunito_700Bold,
    Nunito_800ExtraBold,
    NunitoSans_400Regular,
    NunitoSans_600SemiBold,
    NunitoSans_700Bold,
  });
  const themeLoaded = useAppStore((s) => s.themeLoaded);
  // Aparência guardada (tema e alto contraste) antes de qualquer tela, e gravada a cada troca
  useEffect(() => {
    void hydrateTheme();
    return persistTheme();
  }, []);
  // Boot: liga token e 401 ao cliente HTTP e restaura perfil e sessões do SecureStore.
  useEffect(() => {
    // Build com endereço da API inutilizável: nada de sessão nem push (a tela de configuração aparece abaixo)
    if (API_CONFIG_PROBLEM) return;
    const unsubscribe = registerSessionHandlers();
    void bootSession();
    // Push (só no app Android instalado; no Expo Go, no iOS e no demo não faz nada)
    const stopPush = startPush();
    return () => {
      unsubscribe();
      stopPush();
    };
  }, []);

  // Até as fontes e a aparência carregarem, só a cor da marca (igual nos dois temas: o claro nunca pisca)
  if (!fontsLoaded || !themeLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: bootColors.background }}>
        <ActivityIndicator color={bootColors.spinner} size="large" />
      </View>
    );
  }

  if (API_CONFIG_PROBLEM) {
    return (
      <SafeAreaProvider>
        <ThemeProvider>
          <ConfigErrorScreen problem={API_CONFIG_PROBLEM} />
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <DemoBanner>
          <RootNavigator />
          {IS_DEMO ? <ProfileSwitcher /> : null}
          <Toast />
        </DemoBanner>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
