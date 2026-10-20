import type { DateKey, Dose, Elder, ID, LinkCode, Message, MessageAuthor, Treatment, Medication } from '../types/domain';
import type {
  AdherenceReport,
  AlertView,
  CaregiverSession,
  DailyReport,
  ConversationView,
  DoseView,
  ElderFilter,
  ElderInput,
  ElderPairing,
  ElderProfile,
  HistoryPage,
  HistoryQuery,
  MedicationInfo,
  MedicationInput,
  MedicationView,
  PdfResult,
  SignUpInput,
  TreatmentInput,
} from '../types/views';

/**
 * Contratos da camada de serviços. Hoje implementados por adapters mock
 * (src/adapters/mock); a troca pela API Spring Boot acontece em
 * src/services/index.ts, sem mexer nas telas.
 */

/** POST /api/cuidadores, POST /api/auth/login, DELETE /api/cuidadores/me */
export interface AuthService {
  login(email: string, password: string): Promise<CaregiverSession>;
  /** Somente protótipo: entra na conta de demonstração sem senha no código. */
  loginDemo(): Promise<CaregiverSession>;
  signUp(input: SignUpInput): Promise<CaregiverSession>;
  deleteAccount(): Promise<{ removalDeadlineDays: number }>;
}

/** POST /api/idosos, POST /api/idosos/{id}/gerar-codigo, POST /api/vinculo/validar */
export interface ElderService {
  list(): Promise<Elder[]>;
  get(id: ID): Promise<Elder>;
  create(input: ElderInput): Promise<Elder>;
  generateLinkCode(elderId: ID): Promise<LinkCode>;
  getActiveLinkCode(elderId: ID): Promise<LinkCode | null>;
  validateLinkCode(code: string): Promise<ElderPairing>;
  getProfile(elderId: ID): Promise<ElderProfile>;
}

/** /api/medicamentos e /api/medicamentos/{id}/tratamentos */
export interface MedicationService {
  list(filter: ElderFilter): Promise<MedicationView[]>;
  get(id: ID): Promise<{ medication: Medication; treatment?: Treatment }>;
  create(input: MedicationInput): Promise<MedicationView>;
  update(id: ID, input: MedicationInput): Promise<MedicationView>;
  /** Só o tratamento, para um medicamento que ficou sem (cadastro em que a 2ª chamada falhou). */
  createTreatment(medicationId: ID, input: TreatmentInput): Promise<MedicationView>;
  /** RN06: com tratamento ativo exige `confirmed: true`, senão 409. */
  remove(id: ID, options: { confirmed: boolean }): Promise<void>;
}

/** Doses do dia, PUT /api/doses/{id}/confirmar, GET /api/historico e /api/configuracoes/tolerancia */
export interface DoseService {
  listForDay(filter: ElderFilter, day: string): Promise<DoseView[]>;
  /** A API não tem GET de uma dose: `hint` (idoso e dia) diz onde procurar; sem ele, vale a última lista vista. */
  get(id: ID, hint?: { elderId: ID; day: DateKey }): Promise<DoseView>;
  confirm(id: ID): Promise<DoseView>;
  /** Histórico paginado (UC-011). Período invertido: 400 VALIDACAO; período sem registros: página vazia (RN-011). */
  listHistory(query: HistoryQuery): Promise<HistoryPage>;
  listAlerts(): Promise<AlertView[]>;
  getTolerance(): Promise<number>;
  setTolerance(minutes: number): Promise<number>;
}

/** POST, GET /api/mensagens */
export interface MessageService {
  listConversations(): Promise<ConversationView[]>;
  listThread(elderId: ID): Promise<Message[]>;
  send(elderId: ID, from: MessageAuthor, text: string): Promise<Message>;
  markRead(elderId: ID, reader: MessageAuthor): Promise<void>;
  unreadCount(elderId: ID | 'ALL', reader: MessageAuthor): Promise<number>;
}

/** GET /api/relatorios/diario e GET /api/relatorios/pdf */
export interface ReportService {
  /** Relatório diário de uso dos medicamentos de um idoso (UC-008). */
  getDaily(elderId: ID, day: DateKey): Promise<DailyReport>;
  getAdherence(elderId: ID, from: string, to: string): Promise<AdherenceReport>;
  generatePdf(elderId: ID, from: string, to: string): Promise<PdfResult>;
}

/**
 * Fonte de aparência do remédio (formato, cor, tamanho, imprint). Interface
 * única para trocar depois por DailyMed/SPL, base própria ou API da ANVISA.
 */
export interface MedicationInfoService {
  lookup(name: string): Promise<MedicationInfo | null>;
}

export interface Services {
  auth: AuthService;
  elders: ElderService;
  medications: MedicationService;
  doses: DoseService;
  messages: MessageService;
  reports: ReportService;
  medicationInfo: MedicationInfoService;
}

export type { Dose };
