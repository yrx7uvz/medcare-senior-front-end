import type { Services } from '../../services/types';
import { httpAuthService } from './HttpAuthService';
import { httpElderService } from './HttpElderService';
import { httpMedicationService } from './HttpMedicationService';
import {
  stubDoseService,
  stubMedicationInfoService,
  stubMessageService,
  stubReportService,
} from './stubs';

/**
 * Serviços do modo real (API Spring Boot). Os stubs são trocados aqui, um a um,
 * pelos adapters HTTP à medida que forem implementados.
 */
export const httpServices: Services = {
  auth: httpAuthService,
  elders: httpElderService,
  medications: httpMedicationService,
  doses: stubDoseService,
  messages: stubMessageService,
  reports: stubReportService,
  medicationInfo: stubMedicationInfoService,
};
