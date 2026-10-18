import { AppError } from '../../services/errors';
import type { MedicationInfoService, MessageService, ReportService } from '../../services/types';

/**
 * Adapters provisórios do modo real (fora do demo): cada operação falha com uma
 * mensagem clara até o adapter HTTP correspondente ser implementado e substituir o stub.
 */
export const notIntegrated = (): Promise<never> =>
  Promise.reject(new AppError('HTTP', 501, 'Funcionalidade ainda não integrada com a API', 'NAO_INTEGRADO'));

export const stubMessageService: MessageService = {
  listConversations: notIntegrated,
  listThread: notIntegrated,
  send: notIntegrated,
  markRead: notIntegrated,
  unreadCount: notIntegrated,
};

export const stubReportService: ReportService = {
  getDaily: notIntegrated,
  getAdherence: notIntegrated,
  generatePdf: notIntegrated,
};

export const stubMedicationInfoService: MedicationInfoService = {
  lookup: notIntegrated,
};
