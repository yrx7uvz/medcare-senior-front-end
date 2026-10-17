import { Nunito_700Bold, Nunito_800ExtraBold, useFonts } from '@expo-google-fonts/nunito';
import { NunitoSans_400Regular, NunitoSans_600SemiBold, NunitoSans_700Bold } from '@expo-google-fonts/nunito-sans';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ProfileSwitcher } from '../components/layout/ProfileSwitcher';
import { Toast } from '../components/layout/Toast';
import { useAppStore } from '../store/appStore';
import { elderDeviceStorage } from '../lib/secureStorage';
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
  const setElderSession = useAppStore((s) => s.setElderSession);

  // Restaura o pareamento do idoso guardado no aparelho (SecureStore).
  useEffect(() => {
    elderDeviceStorage
      .loadSession()
      .then((s) => setElderSession(s ? { elderId: s.elderId } : null))
      .catch(() => setElderSession(null));
  }, [setElderSession]);

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
        <RootNavigator />
        <ProfileSwitcher />
        <Toast />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
