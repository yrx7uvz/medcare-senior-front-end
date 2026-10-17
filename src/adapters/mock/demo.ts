import { getDb, resetDb } from '../../mocks/db';
import type { Services } from '../../services/types';
import type { LinkCode } from '../../types/domain';
import { mockAuthService } from './MockAuthService';
import { mockDoseService } from './MockDoseService';
import { mockElderService, resetPairingAttempts } from './MockElderService';
import { mockMedicationInfoService } from './MockMedicationInfoService';
import { mockMedicationService } from './MockMedicationService';
import { mockMessageService } from './MockMessageService';
import { mockReportService } from './MockReportService';

/**
 * Tudo o que só existe no modo demonstração. Carregado apenas por src/config/demo.ts
 * (require preguiçoso) quando IS_DEMO é verdadeiro: nenhum outro módulo fora de
 * src/adapters/mock importa os mocks diretamente.
 */
export const mockServices: Services = {
  auth: mockAuthService,
  elders: mockElderService,
  medications: mockMedicationService,
  doses: mockDoseService,
  messages: mockMessageService,
  reports: mockReportService,
  medicationInfo: mockMedicationInfoService,
};

/** Volta o "banco" em memória ao seed e zera as tentativas de pareamento. */
export function resetDemoData() {
  resetDb();
  resetPairingAttempts();
}

/** Só os dados do banco em memória (sem tentativas de pareamento), como na exclusão de conta. */
export function resetDemoDb() {
  resetDb();
}

/** Códigos de vínculo de teste, com o nome do paciente, para o menu do protótipo. */
export function listDemoLinkCodes(): (LinkCode & { elderName: string })[] {
  const db = getDb();
  return db.linkCodes.map((c) => ({ ...c, elderName: db.elders.find((e) => e.id === c.elderId)?.name ?? '—' }));
}
