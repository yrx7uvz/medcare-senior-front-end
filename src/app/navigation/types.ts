import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DoseView } from '../../types/views';

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
  // Pedido de um paciente para sair da conta, aberto pelo toque no aviso
  LeaveRequest: { patientId: string; requestId: string };
  // Comum
  Legal: { doc: 'termos' | 'lgpd' };
  // Paciente
  PatientLoading: undefined;
  PatientPairing: undefined;
  PatientCreatePin: { patientId: string; patientName: string; token: string };
  PatientPinUnlock: undefined;
  PatientHome: undefined;
  // preview: a dose como estava na lista do início, para a tela abrir sem esperar a busca (sem salto)
  // day: dia da dose (AAAA-MM-DD), quando a tela é aberta pelo toque num lembrete (sem a lista do início carregada)
  PatientConfirmDose: { doseId: string; preview?: DoseView; day?: string };
  // preview: a dose devolvida pela confirmação (a tela abre já com ela)
  PatientDoseConfirmed: { doseId: string; preview?: DoseView };
  PatientMessages: undefined;
  PatientSettings: undefined;
  // Saída da conta com autorização do cuidador (explicação, espera e resultado)
  PatientLeave: undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

export type TabScreenProps<T extends keyof CaregiverTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<CaregiverTabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

export type RootNavigation = NativeStackNavigationProp<RootStackParamList>;
