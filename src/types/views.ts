import type {
  DateKey,
  DateTimeKey,
  DisplayStatus,
  DoseStatus,
  Elder,
  ID,
  Medication,
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
  lowStock: boolean;
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
  leaflet?: string;
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

export type HistoryStatusFilter = 'ALL' | 'CONFIRMED' | 'MISSED' | 'LATE';

export interface HistoryQuery {
  elder: ElderFilter;
  from: DateKey;
  to: DateKey;
  status: HistoryStatusFilter;
}
