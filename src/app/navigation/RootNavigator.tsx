import { CommonActions, DarkTheme, DefaultTheme, NavigationContainer, type Theme as NavTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AppText, Button } from '../../components/ui';
import { LoginScreen } from '../../features/auth/LoginScreen';
import { ForgotPasswordScreen } from '../../features/auth/ForgotPasswordScreen';
import { SignUpScreen } from '../../features/auth/SignUpScreen';
import { VerifyEmailScreen } from '../../features/auth/VerifyEmailScreen';
import { DoseDetailScreen } from '../../features/dashboard/DoseDetailScreen';
import { DailyReportScreen } from '../../features/reports/DailyReportScreen';
import { ConfirmDoseScreen } from '../../features/patient/ConfirmDoseScreen';
import { CreatePinScreen } from '../../features/patient/CreatePinScreen';
import { DoseConfirmedScreen } from '../../features/patient/DoseConfirmedScreen';
import { PatientHomeScreen } from '../../features/patient/PatientHomeScreen';
import { PatientMessagesScreen } from '../../features/patient/PatientMessagesScreen';
import { PatientLeaveScreen } from '../../features/patient/PatientLeaveScreen';
import { PatientSettingsScreen } from '../../features/patient/PatientSettingsScreen';
import { LeaveRequestScreen } from '../../features/dashboard/LeaveRequestScreen';
import { PairingScreen } from '../../features/patient/PairingScreen';
import { PinUnlockScreen } from '../../features/patient/PinUnlockScreen';
import { PatientFormScreen } from '../../features/patients/PatientFormScreen';
import { LinkCodeScreen } from '../../features/patients/LinkCodeScreen';
import { ExportPdfScreen } from '../../features/history/ExportPdfScreen';
import { LegalScreen } from '../../features/legal/LegalScreen';
import { MedicationFormScreen } from '../../features/medications/MedicationFormScreen';
import { ProfileChoiceScreen } from '../../features/profile/ProfileChoiceScreen';
import { decideDoseOpen, decidePatientDoseOpen } from '../../lib/doseOpen';
import { markPatientActivity } from '../../lib/pinSession';
import { bootSession } from '../../lib/session';
import { navigationRef } from './navigationRef';
import { useAppStore } from '../../store/appStore';
import { patientColorsFor, useTheme, useThemeMode, withPatientTheme } from '../../theme';
import { CaregiverTabs } from './CaregiverTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/** Devolve false: só registra o toque (no máximo uma gravação por minuto), quem responde continua sendo o botão. */
const touchCountsAsUse = () => {
  markPatientActivity();
  return false;
};

// Telas do paciente com o tema dedicado (fontes grandes e alto contraste).
const PatientPairing = withPatientTheme(PairingScreen);
const PatientCreatePin = withPatientTheme(CreatePinScreen);
const PatientPinUnlock = withPatientTheme(PinUnlockScreen);
const PatientHome = withPatientTheme(PatientHomeScreen);
const PatientConfirmDose = withPatientTheme(ConfirmDoseScreen);
const PatientDoseConfirmed = withPatientTheme(DoseConfirmedScreen);
const PatientMessages = withPatientTheme(PatientMessagesScreen);
const PatientSettings = withPatientTheme(PatientSettingsScreen);
const PatientLeave = withPatientTheme(PatientLeaveScreen);
const ProfileChoice = withPatientTheme(ProfileChoiceScreen);

function PatientLoading() {
  const bootError = useAppStore((s) => s.bootError);
  const highContrast = useAppStore((s) => s.patientHighContrast);
  const patientColors = patientColorsFor(useThemeMode(), highContrast);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, backgroundColor: patientColors.background }}>
      {bootError ? (
        <>
          <AppText variant="patientBody" color={patientColors.text} align="center" accessibilityRole="alert">
            {bootError}
          </AppText>
          <Button title="Tentar novamente" size="lg" onPress={() => void bootSession()} />
        </>
      ) : (
        <ActivityIndicator size="large" color={patientColors.primary} />
      )}
    </View>
  );
}

/**
 * Navegação condicional por estado: perfil do aparelho (null = escolher),
 * sessão do cuidador, pareamento e PIN do paciente. Enquanto o boot lê o
 * SecureStore, mostra o carregamento.
 */
export function RootNavigator() {
  const { colors, mode } = useTheme();
  const viewAs = useAppStore((s) => s.viewAs);
  const profileLoaded = useAppStore((s) => s.profileLoaded);
  const session = useAppStore((s) => s.session);
  const patientSession = useAppStore((s) => s.patientSession);
  const patientLoaded = useAppStore((s) => s.patientSessionLoaded);
  const patientUnlocked = useAppStore((s) => s.patientUnlocked);
  const highContrast = useAppStore((s) => s.patientHighContrast);
  const pendingDoseOpen = useAppStore((s) => s.pendingDoseOpen);
  const pendingLeaveOpen = useAppStore((s) => s.pendingLeaveOpen);
  const pendingPatientDoseOpen = useAppStore((s) => s.pendingPatientDoseOpen);
  const [navReady, setNavReady] = useState(false);

  // Toque num aviso de dose (app fechado, em segundo plano ou aberto em qualquer tela): abre a dose assim que houver
  // sessão de cuidador, com o Painel por baixo (voltar leva ao Painel). Sem sessão, o destino espera o login.
  useEffect(() => {
    if (!navReady || !pendingDoseOpen) return;
    const decision = decideDoseOpen(pendingDoseOpen, { viewAs, hasSession: !!session });
    if (decision.action === 'aguardar-login') return;
    if (decision.action === 'ignorar') {
      useAppStore.getState().setPendingDoseOpen(null);
      return;
    }
    // Depois do render em que as telas do cuidador passam a existir. O destino só sai da fila quando a navegação
    // acontece: limpar antes faria o efeito rodar de novo e cancelar este timer (o toque não levaria a lugar nenhum)
    const id = setTimeout(() => {
      if (!navigationRef.isReady()) return;
      useAppStore.getState().setPendingDoseOpen(null);
      const painel = { name: 'CaregiverTabs' as const, params: { screen: 'Painel' as const } };
      if (decision.action === 'abrir-dose') {
        navigationRef.dispatch(CommonActions.reset({ index: 1, routes: [painel, { name: 'DoseDetail', params: { ...decision.target, fromPush: true } }] }));
      } else {
        navigationRef.dispatch(CommonActions.reset({ index: 0, routes: [painel] }));
        useAppStore.getState().showToast(decision.notice, 'info');
      }
    }, 0);
    return () => clearTimeout(id);
  }, [navReady, viewAs, session, pendingDoseOpen]);

  // Toque num lembrete de dose (local ou do servidor), no perfil do paciente: abre a dose com o início por baixo. Com o
  // PIN pedido (regra de tolerância), o destino espera o desbloqueio: o lembrete nunca contorna o PIN
  useEffect(() => {
    if (!navReady || !pendingPatientDoseOpen) return;
    const decision = decidePatientDoseOpen(pendingPatientDoseOpen, {
      viewAs,
      profileLoaded,
      patientId: patientSession?.patientId ?? null,
      unlocked: patientUnlocked,
    });
    if (decision.action === 'aguardar') return;
    if (decision.action === 'ignorar') {
      useAppStore.getState().setPendingPatientDoseOpen(null);
      return;
    }
    const id = setTimeout(() => {
      if (!navigationRef.isReady()) return;
      useAppStore.getState().setPendingPatientDoseOpen(null);
      navigationRef.dispatch(
        CommonActions.reset({
          index: 1,
          routes: [{ name: 'PatientHome' }, { name: 'PatientConfirmDose', params: { doseId: decision.target.doseId, day: decision.target.day } }],
        }),
      );
    }, 0);
    return () => clearTimeout(id);
  }, [navReady, viewAs, profileLoaded, patientSession, patientUnlocked, pendingPatientDoseOpen]);

  // Toque no aviso de pedido de saída: mesmo caminho da dose (espera o login; perfil do paciente ignora), com o Painel
  // por baixo
  useEffect(() => {
    if (!navReady || !pendingLeaveOpen) return;
    if (viewAs === 'PATIENT') {
      useAppStore.getState().setPendingLeaveOpen(null);
      return;
    }
    if (viewAs !== 'CAREGIVER' || !session) return;
    const id = setTimeout(() => {
      if (!navigationRef.isReady()) return;
      useAppStore.getState().setPendingLeaveOpen(null);
      const painel = { name: 'CaregiverTabs' as const, params: { screen: 'Painel' as const } };
      navigationRef.dispatch(CommonActions.reset({ index: 1, routes: [painel, { name: 'LeaveRequest', params: pendingLeaveOpen }] }));
    }, 0);
    return () => clearTimeout(id);
  }, [navReady, viewAs, session, pendingLeaveOpen]);

  const navTheme = useMemo<NavTheme>(() => {
    const base = mode === 'dark' ? DarkTheme : DefaultTheme;
    // Escolha de perfil e carregamento usam o tema do paciente
    const c = viewAs !== 'CAREGIVER' ? patientColorsFor(mode, highContrast) : colors;
    return {
      ...base,
      colors: { ...base.colors, primary: c.primary, background: c.background, card: c.surface, text: c.text, border: c.border, notification: c.danger },
    };
  }, [mode, colors, viewAs, highContrast]);

  // Cabeçalho do cuidador é escuro nos dois temas; o paciente segue o tema (claro, escuro ou alto contraste)
  const statusLight = viewAs === 'CAREGIVER' || highContrast || mode === 'dark';

  return (
    // Toques no app do paciente contam como uso (para a tolerância do PIN), sem capturar o toque. O fundo acompanha o
    // tema: é o que aparece atrás da barra de navegação do Android (borda a borda) e durante as transições
    <View style={{ flex: 1, backgroundColor: navTheme.colors.background }} onStartShouldSetResponderCapture={touchCountsAsUse}>
      <NavigationContainer ref={navigationRef} theme={navTheme} onReady={() => setNavReady(true)}>
        <StatusBar style={statusLight ? 'light' : 'dark'} />
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          {!profileLoaded ? (
            <Stack.Screen name="PatientLoading" component={PatientLoading} />
          ) : viewAs === null ? (
            <Stack.Screen name="ProfileChoice" component={ProfileChoice} />
          ) : viewAs === 'CAREGIVER' ? (
            session?.emailVerified === false ? (
              // Conta nova: só a confirmação do e-mail (a API não deixa cadastrar pacientes sem ela)
              <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
            ) : session ? (
              <Stack.Group>
                <Stack.Screen name="CaregiverTabs" component={CaregiverTabs} />
                <Stack.Screen name="PatientForm" component={PatientFormScreen} />
                <Stack.Screen name="LinkCode" component={LinkCodeScreen} />
                <Stack.Screen name="MedicationForm" component={MedicationFormScreen} />
                <Stack.Screen name="ExportPdf" component={ExportPdfScreen} />
                <Stack.Screen name="DoseDetail" component={DoseDetailScreen} />
                <Stack.Screen name="DailyReport" component={DailyReportScreen} />
                <Stack.Screen name="LeaveRequest" component={LeaveRequestScreen} />
              </Stack.Group>
            ) : (
              <Stack.Group>
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="SignUp" component={SignUpScreen} />
                <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
              </Stack.Group>
            )
          ) : !patientLoaded ? (
            <Stack.Screen name="PatientLoading" component={PatientLoading} />
          ) : !patientSession ? (
            <Stack.Group>
              <Stack.Screen name="PatientPairing" component={PatientPairing} />
              <Stack.Screen name="PatientCreatePin" component={PatientCreatePin} />
            </Stack.Group>
          ) : !patientUnlocked ? (
            <Stack.Screen name="PatientPinUnlock" component={PatientPinUnlock} />
          ) : (
            <Stack.Group>
              <Stack.Screen name="PatientHome" component={PatientHome} />
              <Stack.Screen name="PatientConfirmDose" component={PatientConfirmDose} />
              <Stack.Screen name="PatientDoseConfirmed" component={PatientDoseConfirmed} options={{ animation: 'fade', gestureEnabled: false }} />
              <Stack.Screen name="PatientMessages" component={PatientMessages} />
              <Stack.Screen name="PatientSettings" component={PatientSettings} />
              <Stack.Screen name="PatientLeave" component={PatientLeave} options={{ gestureEnabled: false }} />
            </Stack.Group>
          )}
          <Stack.Screen name="Legal" component={LegalScreen} options={{ presentation: 'modal' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}
