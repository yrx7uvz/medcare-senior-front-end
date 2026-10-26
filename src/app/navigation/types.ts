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
  PatientForm: undefined;
  LinkCode: { patientId: string; justCreated?: boolean };
  MedicationForm: { medicationId?: string } | undefined;
  ExportPdf: undefined;
  // patientId e day (opcionais) dizem onde achar a dose; vêm do push ou do relatório. fromPush: aberta por um aviso
  DoseDetail: { doseId: string; patientId?: string; day?: string; fromPush?: boolean };
  // UC-008: relatório diário de um paciente (paciente e dia opcionais)
  DailyReport: { patientId?: string; day?: string } | undefined;
  // Comum
  Legal: { doc: 'termos' | 'lgpd' };
  // Paciente
  PatientLoading: undefined;
  PatientPairing: undefined;
  PatientCreatePin: { patientId: string; patientName: string; token: string };
  PatientPinUnlock: undefined;
  PatientHome: undefined;
  PatientConfirmDose: { doseId: string };
  PatientDoseConfirmed: { doseId: string };
  PatientMessages: undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

export type TabScreenProps<T extends keyof CaregiverTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<CaregiverTabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

export type RootNavigation = NativeStackNavigationProp<RootStackParamList>;
