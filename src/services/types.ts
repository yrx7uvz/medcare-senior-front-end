import type { DateKey, Dose, Patient, ID, LinkCode, Message, MessageAuthor, Treatment, Medication } from '../types/domain';
import type {
  AdherenceReport,
  AlertView,
  CaregiverSession,
  DailyReport,
  ConversationView,
  DoseView,
  PatientFilter,
  PatientInput,
  PatientPairing,
  PatientProfile,
  HistoryPage,
  HistoryQuery,
  MedicationInfo,
  MedicationInput,
  MedicationView,
  MessagePage,
  PdfFile,
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

/** POST /api/pacientes, POST /api/pacientes/{id}/gerar-codigo, POST /api/vinculo/validar */
export interface PatientService {
  list(): Promise<Patient[]>;
  get(id: ID): Promise<Patient>;
  create(input: PatientInput): Promise<Patient>;
  generateLinkCode(patientId: ID): Promise<LinkCode>;
  getActiveLinkCode(patientId: ID): Promise<LinkCode | null>;
  validateLinkCode(code: string): Promise<PatientPairing>;
  getProfile(patientId: ID): Promise<PatientProfile>;
}

/** /api/medicamentos e /api/medicamentos/{id}/tratamentos */
export interface MedicationService {
  list(filter: PatientFilter): Promise<MedicationView[]>;
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
  listForDay(filter: PatientFilter, day: string): Promise<DoseView[]>;
  /** A API não tem GET de uma dose: `hint` (paciente e dia) diz onde procurar; sem ele, vale a última lista vista. */
  get(id: ID, hint?: { patientId: ID; day: DateKey }): Promise<DoseView>;
  confirm(id: ID): Promise<DoseView>;
  /** Histórico paginado (UC-011). Período invertido: 400 VALIDACAO; período sem registros: página vazia (RN-011). */
  listHistory(query: HistoryQuery): Promise<HistoryPage>;
  listAlerts(): Promise<AlertView[]>;
  getTolerance(): Promise<number>;
  setTolerance(minutes: number): Promise<number>;
}

/**
 * /api/mensagens (UC-010). Na API, quem escreve e quem lê vem do token: `from`/`reader` só servem ao demo.
 */
export interface MessageService {
  /** Cuidador: uma por paciente (inclusive sem mensagens); paciente: a sua única conversa. */
  listConversations(): Promise<ConversationView[]>;
  /** Página da conversa (0 = as mais recentes; as seguintes são mais antigas). */
  listThread(patientId: ID, page?: number): Promise<MessagePage>;
  /** 1 a 500 caracteres; vazio ou maior: 400 VALIDACAO. */
  send(patientId: ID, from: MessageAuthor, text: string): Promise<Message>;
  /** Marca como lidas as mensagens que `reader` recebeu na conversa; devolve quantas mudaram. */
  markRead(patientId: ID, reader: MessageAuthor): Promise<number>;
  /** Total recebido e não lido por quem chama (cuidador: todos os pacientes; paciente: a conversa dele). */
  unreadCount(patientId: ID | 'ALL', reader: MessageAuthor): Promise<number>;
}

/** GET /api/relatorios/diario e GET /api/relatorios/pdf */
export interface ReportService {
  /** Relatório diário de uso dos medicamentos de um paciente (UC-008). */
  getDaily(patientId: ID, day: DateKey): Promise<DailyReport>;
  /** Só o modo demonstração (a API não tem esta consulta; o PDF traz a adesão). */
  getAdherence(patientId: ID, from: string, to: string): Promise<AdherenceReport>;
  /**
   * PDF do histórico de adesão (período de até 12 meses). 400 VALIDACAO (período inválido ou longo demais),
   * 404 (paciente de outra conta) e 422 PERIODO_SEM_REGISTROS chegam como AppError com o código.
   */
  downloadPdf(patientId: ID, from: DateKey, to: DateKey): Promise<PdfFile>;
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
  patients: PatientService;
  medications: MedicationService;
  doses: DoseService;
  messages: MessageService;
  reports: ReportService;
  medicationInfo: MedicationInfoService;
}

export type { Dose };
