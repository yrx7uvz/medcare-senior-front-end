import { mockAuthService } from '../adapters/mock/MockAuthService';
import { mockDoseService } from '../adapters/mock/MockDoseService';
import { mockElderService } from '../adapters/mock/MockElderService';
import { mockMedicationInfoService } from '../adapters/mock/MockMedicationInfoService';
import { mockMedicationService } from '../adapters/mock/MockMedicationService';
import { mockMessageService } from '../adapters/mock/MockMessageService';
import { mockReportService } from '../adapters/mock/MockReportService';
import type { Services } from './types';

/**
 * Ponto único de troca: para usar a API real, substitua cada adapter mock por
 * um adapter HTTP (ver src/adapters/http) que implemente a mesma interface.
 */
export const services: Services = {
  auth: mockAuthService,
  elders: mockElderService,
  medications: mockMedicationService,
  doses: mockDoseService,
  messages: mockMessageService,
  reports: mockReportService,
  medicationInfo: mockMedicationInfoService,
};

export * from './errors';
export type { Services, AuthService, ElderService, MedicationService, DoseService, MessageService, ReportService, MedicationInfoService } from './types';
