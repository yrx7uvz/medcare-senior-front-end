import type {
  DateKey,
  DateTimeKey,
  DisplayStatus,
  DoseStatus,
  Elder,
  ID,
  Medication,
  Message,
  MedicationType,
  PillShape,
  ScheduleTime,
  Treatment,
} from './domain';

/** 'ALL' = opção "Todos" do ElderSwitcher. */
export type ElderFilter = ID | 'ALL';

export type Confirmability = 'OK' | 'JA_REGISTRADA' | 'MUITO_CEDO' | 'ENCERRADA';

export interface DoseWindow {
  /** 60 min antes do horário (RN14). */
  opensAt: DateTimeKey;
  /** Horário + tolerância: momento do aviso ao cuidador (RN09). */
  alertAt: DateTimeKey;
  /** Horário + 180 min: depois disso vira NAO_TOMADA (RN09). */
  closesAt: DateTimeKey;
}

export interface DoseView {
  id: ID;
  elderId: ID;
  elderName: string;
  medication: Medication;
  treatmentId: ID | null;
  scheduledAt: DateTimeKey;
  confirmedAt?: DateTimeKey;
  storedStatus: DoseStatus;
  status: DisplayStatus;
  timeNote?: string;
  doseQuantity: string;
  route: string;
  window: DoseWindow;
  confirmability: Confirmability;
  toleranceMinutes: number;
}

export interface MedicationView {
  medication: Medication;
  elderName: string;
  treatment?: Treatment;
  activeTreatment: boolean;
  scheduleSummary: string;
}

export interface AlertView {
  doseId: ID;
  elderId: ID;
  elderName: string;
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
  elder: Elder;
  lastMessage?: { text: string; sentAt: DateTimeKey; from: 'CUIDADOR' | 'IDOSO' };
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
  elder: Elder;
  from: DateKey;
  to: DateKey;
  items: AdherenceItem[];
  overallRate: number | null;
  totalDoses: number;
}

/** Totais do relatório diário (UC-008), pelo status gravado das doses. */
export interface DailyReportTotals {
  total: number;
  taken: number;
  late: number;
  missed: number;
  pending: number;
  /** (tomadas + com atraso) / (total - pendentes) * 100, 1 casa; null sem dose encerrada. */
  adherencePercent: number | null;
}

/** GET /api/relatorios/diario?idosoId=&data= (UC-008 / HU06). */
export interface DailyReport {
  elder: { id: ID; name: string };
  day: DateKey;
  totals: DailyReportTotals;
  /** Doses do dia, por horário. */
  doses: DoseView[];
}

export interface PdfResult {
  fileName: string;
  sizeKb: number;
  generatedAt: DateTimeKey;
}

export interface CaregiverSession {
  caregiverId: ID;
  name: string;
  email: string;
  token: string;
}

export interface ElderPairing {
  elderId: ID;
  elderName: string;
  token: string;
}

export interface ElderProfile {
  elder: Elder;
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
  elderId: ID;
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

export interface ElderInput {
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
  elder: ElderFilter;
  /** Só um remédio (precisa de um idoso escolhido). */
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
