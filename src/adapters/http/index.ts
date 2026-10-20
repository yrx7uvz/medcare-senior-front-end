import type { Services } from '../../services/types';
import { httpAuthService } from './HttpAuthService';
import { httpDoseService } from './HttpDoseService';
import { httpElderService } from './HttpElderService';
import { httpMedicationService } from './HttpMedicationService';
import { httpReportService } from './HttpReportService';
import {
  stubMedicationInfoService,
  stubMessageService,
} from './stubs';

/**
 * Serviços do modo real (API Spring Boot). Os stubs são trocados aqui, um a um,
 * pelos adapters HTTP à medida que forem implementados.
 */
export const httpServices: Services = {
  auth: httpAuthService,
  elders: httpElderService,
  medications: httpMedicationService,
  doses: httpDoseService,
  messages: stubMessageService,
  reports: httpReportService,
  medicationInfo: stubMedicationInfoService,
};
