import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';

export type CaregiverTabParamList = {
  Painel: undefined;
  Remedios: undefined;
  Historico: undefined;
  Mensagens: undefined;
  Config: undefined;
};

export type RootStackParamList = {
  // Primeira abertura: escolha do perfil do aparelho
  ProfileChoice: undefined;
  // Cuidador (sem sessão)
  // email: preenchido quando a conta acabou de ser criada mas o login automático falhou
  Login: { email?: string } | undefined;
  SignUp: undefined;
  // Cuidador (com sessão)
  CaregiverTabs: NavigatorScreenParams<CaregiverTabParamList> | undefined;
  ElderForm: undefined;
  LinkCode: { elderId: string; justCreated?: boolean };
  MedicationForm: { medicationId?: string } | undefined;
  ExportPdf: undefined;
  // elderId e day (opcionais) dizem onde achar a dose; vêm do push ou do relatório. fromPush: aberta por um aviso
  DoseDetail: { doseId: string; elderId?: string; day?: string; fromPush?: boolean };
  // UC-008: relatório diário de um idoso (idoso e dia opcionais)
  DailyReport: { elderId?: string; day?: string } | undefined;
  // Comum
  Legal: { doc: 'termos' | 'lgpd' };
  // Idoso
  ElderLoading: undefined;
  ElderPairing: undefined;
  ElderCreatePin: { elderId: string; elderName: string; token: string };
  ElderPinUnlock: undefined;
  ElderHome: undefined;
  ElderConfirmDose: { doseId: string };
  ElderDoseConfirmed: { doseId: string };
  ElderMessages: undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

export type TabScreenProps<T extends keyof CaregiverTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<CaregiverTabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

export type RootNavigation = NativeStackNavigationProp<RootStackParamList>;
