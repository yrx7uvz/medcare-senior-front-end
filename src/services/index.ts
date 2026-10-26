import { httpServices } from '../adapters/http';
import { getDemo } from '../config/demo';
import type { Services } from './types';

/**
 * Ponto único de troca: no modo demonstração (EXPO_PUBLIC_DEMO=true) usa os
 * adapters mock; fora dele, os adapters da API (src/adapters/http).
 */
export const services: Services = getDemo()?.mockServices ?? httpServices;

export * from './errors';
export type { Services, AuthService, PatientService, MedicationService, DoseService, MessageService, ReportService, MedicationInfoService } from './types';
