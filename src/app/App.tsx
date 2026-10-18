import { Nunito_700Bold, Nunito_800ExtraBold, useFonts } from '@expo-google-fonts/nunito';
import { NunitoSans_400Regular, NunitoSans_600SemiBold, NunitoSans_700Bold } from '@expo-google-fonts/nunito-sans';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DemoBanner } from '../components/layout/DemoBanner';
import { ProfileSwitcher } from '../components/layout/ProfileSwitcher';
import { Toast } from '../components/layout/Toast';
import { IS_DEMO } from '../config/env';
import { startPush } from '../lib/pushSession';
import { bootSession, registerSessionHandlers } from '../lib/session';
import { ThemeProvider, palette } from '../theme';
import { RootNavigator } from './navigation/RootNavigator';

export default function App() {
  const [fontsLoaded] = useFonts({
    Nunito_700Bold,
    Nunito_800ExtraBold,
    NunitoSans_400Regular,
    NunitoSans_600SemiBold,
    NunitoSans_700Bold,
  });
  // Boot: liga token e 401 ao cliente HTTP e restaura perfil e sessões do SecureStore.
  useEffect(() => {
    const unsubscribe = registerSessionHandlers();
    void bootSession();
    // Push (só no app Android instalado; no Expo Go, no iOS e no demo não faz nada)
    const stopPush = startPush();
    return () => {
      unsubscribe();
      stopPush();
    };
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary }}>
        <ActivityIndicator color="#FFFFFF" size="large" />
      </View>
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
