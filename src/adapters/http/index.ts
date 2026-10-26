import type { Services } from '../../services/types';
import { httpAuthService } from './HttpAuthService';
import { httpDoseService } from './HttpDoseService';
import { httpPatientService } from './HttpPatientService';
import { httpMedicationService } from './HttpMedicationService';
import { httpMessageService } from './HttpMessageService';
import { httpReportService } from './HttpReportService';
import { stubMedicationInfoService } from './stubs';

/**
 * Serviços do modo real (API Spring Boot). Os stubs são trocados aqui, um a um,
 * pelos adapters HTTP à medida que forem implementados.
 */
export const httpServices: Services = {
  auth: httpAuthService,
  patients: httpPatientService,
  medications: httpMedicationService,
  doses: httpDoseService,
  messages: httpMessageService,
  reports: httpReportService,
  medicationInfo: stubMedicationInfoService,
};
