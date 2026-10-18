import { DarkTheme, DefaultTheme, NavigationContainer, type Theme as NavTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AppText, Button } from '../../components/ui';
import { LoginScreen } from '../../features/auth/LoginScreen';
import { SignUpScreen } from '../../features/auth/SignUpScreen';
import { DoseDetailScreen } from '../../features/dashboard/DoseDetailScreen';
import { ConfirmDoseScreen } from '../../features/elder/ConfirmDoseScreen';
import { CreatePinScreen } from '../../features/elder/CreatePinScreen';
import { DoseConfirmedScreen } from '../../features/elder/DoseConfirmedScreen';
import { ElderHomeScreen } from '../../features/elder/ElderHomeScreen';
import { ElderMessagesScreen } from '../../features/elder/ElderMessagesScreen';
import { PairingScreen } from '../../features/elder/PairingScreen';
import { PinUnlockScreen } from '../../features/elder/PinUnlockScreen';
import { ElderFormScreen } from '../../features/elders/ElderFormScreen';
import { LinkCodeScreen } from '../../features/elders/LinkCodeScreen';
import { ExportPdfScreen } from '../../features/history/ExportPdfScreen';
import { LegalScreen } from '../../features/legal/LegalScreen';
import { MedicationFormScreen } from '../../features/medications/MedicationFormScreen';
import { ProfileChoiceScreen } from '../../features/profile/ProfileChoiceScreen';
import { bootSession } from '../../lib/session';
import { useAppStore } from '../../store/appStore';
import { elderHighContrastColors, elderColors, useTheme, withElderTheme } from '../../theme';
import { CaregiverTabs } from './CaregiverTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Telas do idoso com o tema dedicado (fontes grandes e alto contraste).
const ElderPairing = withElderTheme(PairingScreen);
const ElderCreatePin = withElderTheme(CreatePinScreen);
const ElderPinUnlock = withElderTheme(PinUnlockScreen);
const ElderHome = withElderTheme(ElderHomeScreen);
const ElderConfirmDose = withElderTheme(ConfirmDoseScreen);
const ElderDoseConfirmed = withElderTheme(DoseConfirmedScreen);
const ElderMessages = withElderTheme(ElderMessagesScreen);
const ProfileChoice = withElderTheme(ProfileChoiceScreen);

function ElderLoading() {
  const bootError = useAppStore((s) => s.bootError);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, backgroundColor: elderColors.background }}>
      {bootError ? (
        <>
          <AppText variant="elderBody" color={elderColors.text} align="center" accessibilityRole="alert">
            {bootError}
          </AppText>
          <Button title="Tentar novamente" size="lg" onPress={() => void bootSession()} />
        </>
      ) : (
        <ActivityIndicator size="large" color={elderColors.primary} />
      )}
    </View>
  );
}

/**
 * Navegação condicional por estado: perfil do aparelho (null = escolher),
 * sessão do cuidador, pareamento e PIN do idoso. Enquanto o boot lê o
 * SecureStore, mostra o carregamento.
 */
export function RootNavigator() {
  const { colors, mode } = useTheme();
  const viewAs = useAppStore((s) => s.viewAs);
  const profileLoaded = useAppStore((s) => s.profileLoaded);
  const session = useAppStore((s) => s.session);
  const elderSession = useAppStore((s) => s.elderSession);
  const elderLoaded = useAppStore((s) => s.elderSessionLoaded);
  const elderUnlocked = useAppStore((s) => s.elderUnlocked);
  const highContrast = useAppStore((s) => s.elderHighContrast);

  const navTheme = useMemo<NavTheme>(() => {
    const base = mode === 'dark' ? DarkTheme : DefaultTheme;
    // Escolha de perfil e carregamento usam o tema do idoso
    const c = viewAs !== 'CAREGIVER' ? (highContrast ? elderHighContrastColors : elderColors) : colors;
    return {
      ...base,
      colors: { ...base.colors, primary: c.primary, background: c.background, card: c.surface, text: c.text, border: c.border, notification: c.danger },
    };
  }, [mode, colors, viewAs, highContrast]);

  const statusLight = viewAs === 'CAREGIVER' || highContrast;

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={statusLight ? 'light' : 'dark'} />
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        {!profileLoaded ? (
          <Stack.Screen name="ElderLoading" component={ElderLoading} />
        ) : viewAs === null ? (
          <Stack.Screen name="ProfileChoice" component={ProfileChoice} />
        ) : viewAs === 'CAREGIVER' ? (
          session ? (
            <Stack.Group>
              <Stack.Screen name="CaregiverTabs" component={CaregiverTabs} />
              <Stack.Screen name="ElderForm" component={ElderFormScreen} />
              <Stack.Screen name="LinkCode" component={LinkCodeScreen} />
              <Stack.Screen name="MedicationForm" component={MedicationFormScreen} />
              <Stack.Screen name="ExportPdf" component={ExportPdfScreen} />
              <Stack.Screen name="DoseDetail" component={DoseDetailScreen} />
            </Stack.Group>
          ) : (
            <Stack.Group>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="SignUp" component={SignUpScreen} />
            </Stack.Group>
          )
        ) : !elderLoaded ? (
          <Stack.Screen name="ElderLoading" component={ElderLoading} />
        ) : !elderSession ? (
          <Stack.Group>
            <Stack.Screen name="ElderPairing" component={ElderPairing} />
            <Stack.Screen name="ElderCreatePin" component={ElderCreatePin} />
          </Stack.Group>
        ) : !elderUnlocked ? (
          <Stack.Screen name="ElderPinUnlock" component={ElderPinUnlock} />
        ) : (
          <Stack.Group>
            <Stack.Screen name="ElderHome" component={ElderHome} />
            <Stack.Screen name="ElderConfirmDose" component={ElderConfirmDose} />
            <Stack.Screen name="ElderDoseConfirmed" component={ElderDoseConfirmed} options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="ElderMessages" component={ElderMessages} />
          </Stack.Group>
        )}
        <Stack.Screen name="Legal" component={LegalScreen} options={{ presentation: 'modal' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
