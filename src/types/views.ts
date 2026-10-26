import type {
  ConfirmedBy,
  DateKey,
  DateTimeKey,
  DisplayStatus,
  DoseStatus,
  Patient,
  ID,
  Medication,
  Message,
  MedicationType,
  PillShape,
  ScheduleTime,
  Treatment,
} from './domain';

/** 'ALL' = opção "Todos" do PatientSwitcher. */
export type PatientFilter = ID | 'ALL';

export type Confirmability = 'OK' | 'JA_REGISTRADA' | 'MUITO_CEDO' | 'ENCERRADA';

export interface DoseWindow {
  /** 60 min antes do horário: a partir daqui pode confirmar. */
  opensAt: DateTimeKey;
  /** Horário + tolerância: momento do aviso ao cuidador. */
  alertAt: DateTimeKey;
  /** Horário + tolerância + 30 min (limite de confirmação): depois disso vira "Não confirmada". */
  closesAt: DateTimeKey;
}

export interface DoseView {
  id: ID;
  patientId: ID;
  patientName: string;
  medication: Medication;
  treatmentId: ID | null;
  scheduledAt: DateTimeKey;
  confirmedAt?: DateTimeKey;
  /** Quem confirmou (só nas confirmadas; ausente em dados antigos do demo). */
  confirmedBy?: ConfirmedBy;
  storedStatus: DoseStatus;
  status: DisplayStatus;
  timeNote?: string;
  doseQuantity: string;
  route: string;
  window: DoseWindow;
  /** Último instante para confirmar (limiteConfirmacao da API, igual a window.closesAt). */
  confirmUntil: DateTimeKey;
  confirmability: Confirmability;
  toleranceMinutes: number;
}

export interface MedicationView {
  medication: Medication;
  patientName: string;
  treatment?: Treatment;
  activeTreatment: boolean;
  scheduleSummary: string;
}

export interface AlertView {
  doseId: ID;
  patientId: ID;
  patientName: string;
  medicationName: string;
  dosage: string;
  scheduledAt: DateTimeKey;
  status: 'ATRASADA' | 'NAO_TOMADA';
}

/** Uma página da conversa (GET /api/mensagens), da mensagem mais recente para a mais antiga. */
export interface MessagePage {
  items: Message[];
  page: number;
  totalPages: number;
  totalElements: number;
}

export interface ConversationView {
  patient: Patient;
  lastMessage?: { text: string; sentAt: DateTimeKey; from: 'CUIDADOR' | 'PACIENTE' };
  unread: number;
}

export interface AdherenceItem {
  medication: Medication;
  total: number;
  confirmed: number;
  late: number;
  missed: number;
  open: number;
  /** null quando não há doses encerradas no período. */
  rate: number | null;
}

export interface AdherenceReport {
  patient: Patient;
  from: DateKey;
  to: DateKey;
  items: AdherenceItem[];
  overallRate: number | null;
  totalDoses: number;
}

/** Totais do relatório diário (UC-008), pelo status gravado das doses. */
export interface DailyReportTotals {
  total: number;
  onTime: number;
  late: number;
  missed: number;
  pending: number;
  /** (no horário + com atraso) / (total - pendentes) * 100, 1 casa; null sem dose encerrada. */
  adherencePercent: number | null;
}

/** GET /api/relatorios/diario?pacienteId=&data= (UC-008 / HU06). */
export interface DailyReport {
  patient: { id: ID; name: string };
  day: DateKey;
  totals: DailyReportTotals;
  /** Doses do dia, por horário. */
  doses: DoseView[];
}

/** PDF do histórico de adesão baixado do servidor (GET /api/relatorios/pdf), ainda só na memória. */
export interface PdfFile {
  fileName: string;
  bytes: Uint8Array;
  /** Arquivo de exemplo do modo demonstração (sem dado real). */
  demo: boolean;
}

export interface CaregiverSession {
  caregiverId: ID;
  name: string;
  email: string;
  token: string;
}

export interface PatientPairing {
  patientId: ID;
  patientName: string;
  token: string;
}

export interface PatientProfile {
  patient: Patient;
  caregiverFirstName: string;
}

export interface MedicationInfo {
  name: string;
  suggestedDosages: string[];
  type: MedicationType;
  shape?: PillShape;
  primaryColor?: string;
  secondaryColor?: string;
  lengthMm?: number;
  widthMm?: number;
  imprint?: string;
  hasScore?: boolean;
  /** Nome da fonte, exibido ao cuidador. */
  source: string;
}

export interface TreatmentInput {
  startDate: DateKey;
  endDate?: DateKey;
  weekdays: number[];
  times: ScheduleTime[];
  doseQuantity?: string;
}

export interface MedicationInput {
  patientId: ID;
  name: string;
  dosage: string;
  type: MedicationType;
  shape?: PillShape;
  primaryColor?: string;
  secondaryColor?: string;
  lengthMm?: number;
  widthMm?: number;
  imprint?: string;
  hasScore?: boolean;
  stock?: number;
  /** Link da bula (MedicamentoRequestDTO.bulaUrl). */
  bulaUrl?: string;
  appearanceSource: 'MANUAL' | 'EXTERNA';
  treatment: TreatmentInput;
}

export interface PatientInput {
  name: string;
  birthDate: DateKey;
  phone?: string;
}

export interface SignUpInput {
  name: string;
  email: string;
  phone?: string;
  password: string;
  lgpdConsent: boolean;
}

/** Filtro de status do histórico: o status gravado da dose, como a API filtra (GET /api/historico?status=). */
export type HistoryStatusFilter = 'ALL' | DoseStatus;

export interface HistoryQuery {
  patient: PatientFilter;
  /** Só um remédio (precisa de um paciente escolhido). */
  medicationId?: ID;
  from: DateKey;
  to: DateKey;
  status: HistoryStatusFilter;
  /** Página a partir de 0 (padrão 0). */
  page?: number;
  /** Itens por página, 1 a 100 (padrão 20). */
  size?: number;
}

/** Uma página do histórico (UC-011), do registro mais recente para o mais antigo. */
export interface HistoryPage {
  items: DoseView[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
