import { AppError } from '../../services/errors';
import type { DoseService, MedicationInfoService, MessageService, ReportService } from '../../services/types';

/**
 * Adapters provisórios do modo real (fora do demo): cada operação falha com uma
 * mensagem clara até o adapter HTTP correspondente ser implementado e substituir o stub.
 */
const notIntegrated = (): Promise<never> =>
  Promise.reject(new AppError('HTTP', 501, 'Funcionalidade ainda não integrada com a API', 'NAO_INTEGRADO'));

export const stubDoseService: DoseService = {
  listForDay: notIntegrated,
  get: notIntegrated,
  confirm: notIntegrated,
  listHistory: notIntegrated,
  listAlerts: notIntegrated,
  getTolerance: notIntegrated,
  setTolerance: notIntegrated,
};

export const stubMessageService: MessageService = {
  listConversations: notIntegrated,
  listThread: notIntegrated,
  send: notIntegrated,
  markRead: notIntegrated,
  unreadCount: notIntegrated,
};

export const stubReportService: ReportService = {
  getAdherence: notIntegrated,
  generatePdf: notIntegrated,
};

export const stubMedicationInfoService: MedicationInfoService = {
  lookup: notIntegrated,
};
