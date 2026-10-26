import type { ReportService } from '../../services/types';
import type { DailyReport } from '../../types/views';
import { endpoints } from './endpoints';
import { remember, toDoseView, type DoseResponse } from './HttpDoseService';
import { pdfFileName } from '../../lib/pdfReport';
import { request, requestBinary } from './httpClient';
import { fromApiId, toApiId } from './ids';
import { notIntegrated } from './stubs';

/** GET /api/relatorios/diario (RelatorioDiarioResponseDTO). */
export interface RelatorioDiarioResponse {
  paciente: { id: number; nome: string };
  data: string;
  totais: {
    total: number;
    confirmadasNoHorario: number;
    confirmadasComAtraso: number;
    naoTomadas: number;
    pendentes: number;
    aderenciaPercentual: number | null;
  };
  doses: DoseResponse[];
}

export function toDailyReport(dto: RelatorioDiarioResponse): DailyReport {
  return {
    patient: { id: fromApiId(dto.paciente.id), name: dto.paciente.nome },
    day: dto.data,
    totals: {
      total: dto.totais.total,
      onTime: dto.totais.confirmadasNoHorario,
      late: dto.totais.confirmadasComAtraso,
      missed: dto.totais.naoTomadas,
      pending: dto.totais.pendentes,
      adherencePercent: dto.totais.aderenciaPercentual,
    },
    // As doses do relatório também abrem o detalhe (mesmo dia de origem)
    doses: remember(dto.doses.map(toDoseView)),
  };
}


export const httpReportService: ReportService = {
  async getDaily(patientId, day) {
    return toDailyReport(await request<RelatorioDiarioResponse>('GET', endpoints.dailyReport(String(toApiId(patientId)), day)));
  },
  getAdherence: notIntegrated,

  /** GET /api/relatorios/pdf com o token do cuidador. O nome do arquivo não leva dado pessoal. */
  async downloadPdf(patientId, from, to) {
    const apiId = toApiId(patientId);
    const bytes = await requestBinary(endpoints.pdfReport(String(apiId), from, to), 'application/pdf');
    return { fileName: pdfFileName(apiId, from, to), bytes, demo: false };
  },
};
