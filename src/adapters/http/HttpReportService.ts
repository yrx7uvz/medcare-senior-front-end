import type { ReportService } from '../../services/types';
import type { DailyReport } from '../../types/views';
import { endpoints } from './endpoints';
import { remember, toDoseView, type DoseResponse } from './HttpDoseService';
import { request } from './httpClient';
import { fromApiId, toApiId } from './ids';
import { notIntegrated } from './stubs';

/** GET /api/relatorios/diario (RelatorioDiarioResponseDTO). */
export interface RelatorioDiarioResponse {
  idoso: { id: number; nome: string };
  data: string;
  totais: {
    total: number;
    tomadas: number;
    confirmadasComAtraso: number;
    naoTomadas: number;
    pendentes: number;
    aderenciaPercentual: number | null;
  };
  doses: DoseResponse[];
}

export function toDailyReport(dto: RelatorioDiarioResponse): DailyReport {
  return {
    elder: { id: fromApiId(dto.idoso.id), name: dto.idoso.nome },
    day: dto.data,
    totals: {
      total: dto.totais.total,
      taken: dto.totais.tomadas,
      late: dto.totais.confirmadasComAtraso,
      missed: dto.totais.naoTomadas,
      pending: dto.totais.pendentes,
      adherencePercent: dto.totais.aderenciaPercentual,
    },
    // As doses do relatório também abrem o detalhe (mesmo dia de origem)
    doses: remember(dto.doses.map(toDoseView)),
  };
}

/** Relatório diário real (UC-008). */
export const httpReportService: ReportService = {
  async getDaily(elderId, day) {
    return toDailyReport(await request<RelatorioDiarioResponse>('GET', endpoints.dailyReport(String(toApiId(elderId)), day)));
  },
  getAdherence: notIntegrated,
  generatePdf: notIntegrated,
};
