import { HISTORY_PAGE_SIZE, historyPath } from '../../lib/history';
import { defaultDoseQuantity, routeLabel } from '../../lib/medicationMeta';
import { appTodayKey } from '../../lib/serverClock';
import { httpError } from '../../services/errors';
import type { DoseService } from '../../services/types';
import { MEDICATION_TYPE_VALUES, type ConfirmedBy, type DateKey, type DoseStatus, type MedicationType } from '../../types/domain';
import type { AlertView, Confirmability, DoseView, HistoryPage } from '../../types/views';
import { endpoints } from './endpoints';
import { toElder, type IdosoResponse } from './HttpElderService';
import { getViewer, request } from './httpClient';
import { apiColorToHex } from './HttpMedicationService';
import { fromApiId, toApiId } from './ids';

/** GET /api/idosos/{id}/doses, GET /api/idosos/me/doses e PUT /api/doses/{id}/confirmar (DoseResponseDTO). */
export interface DoseResponse {
  id: number;
  idosoId: number;
  idosoNome: string;
  medicamentoId: number;
  medicamentoNome: string;
  dosagem: string;
  tipo: string;
  /** Cor do medicamento como foi cadastrada (texto livre; o app grava '#RRGGBB'), ou null. */
  cor?: string | null;
  tratamentoId: number | null;
  horarioProgramado: string;
  horaConfirmacao: string | null;
  status: DoseStatus;
  /** Quem confirmou (null se a dose não foi confirmada). */
  confirmadoPor?: ConfirmedBy | null;
  statusExibicao: 'PENDENTE' | 'ATRASADA' | 'NAO_TOMADA' | 'CONFIRMADA_NO_HORARIO' | 'CONFIRMADA_COM_ATRASO';
  toleranciaMinutos: number;
  janela: { abreEm: string; avisoEm: string; encerraEm: string };
  /** Último instante para confirmar: horário + tolerância + 30 min (igual a janela.encerraEm). */
  limiteConfirmacao?: string;
  confirmabilidade: Confirmability;
}

/** LocalDateTime da API ('2026-10-18T08:00:00[.123]') para a chave do app ('2026-10-18T08:00'), sem mudar o fuso. */
const toKey = (value: string) => value.slice(0, 16);

const toType = (tipo: string): MedicationType => ((MEDICATION_TYPE_VALUES as readonly string[]).includes(tipo) ? (tipo as MedicationType) : 'COMPRIMIDO');

/**
 * DoseResponseDTO para DoseView. Status de exibição, janela e confirmabilidade vêm do servidor como estão. A cor do
 * remédio vem do servidor (só '#RRGGBB' é desenhada); o formato não vem, e o desenho usa o padrão do tipo.
 */
export function toDoseView(dto: DoseResponse): DoseView {
  const type = toType(dto.tipo);
  const elderId = fromApiId(dto.idosoId);
  return {
    id: fromApiId(dto.id),
    elderId,
    elderName: dto.idosoNome,
    medication: {
      id: fromApiId(dto.medicamentoId),
      elderId,
      name: dto.medicamentoNome,
      dosage: dto.dosagem,
      type,
      primaryColor: apiColorToHex(dto.cor),
      appearanceSource: 'MANUAL',
      createdAt: '',
    },
    treatmentId: dto.tratamentoId === null ? null : fromApiId(dto.tratamentoId),
    scheduledAt: toKey(dto.horarioProgramado),
    confirmedAt: dto.horaConfirmacao ? toKey(dto.horaConfirmacao) : undefined,
    confirmedBy: dto.confirmadoPor ?? undefined,
    storedStatus: dto.status,
    status: dto.statusExibicao,
    doseQuantity: defaultDoseQuantity(type),
    route: routeLabel(type),
    window: { opensAt: toKey(dto.janela.abreEm), alertAt: toKey(dto.janela.avisoEm), closesAt: toKey(dto.janela.encerraEm) },
    // Servidor antigo sem o campo: o limite é o fim da janela, que é o mesmo instante
    confirmUntil: toKey(dto.limiteConfirmacao ?? dto.janela.encerraEm),
    confirmability: dto.confirmabilidade,
    toleranceMinutes: dto.toleranciaMinutos,
  };
}

/**
 * A API não tem GET de uma dose: o detalhe é achado no dia dela. Guardamos de onde veio cada dose já listada
 * (idoso e dia) para buscar o dia de novo e pegar a versão atual.
 */
const doseOrigin = new Map<string, { elderId: string; day: DateKey }>();
export const forgetDoseOrigins = () => doseOrigin.clear();

export function remember(views: DoseView[]) {
  for (const v of views) doseOrigin.set(v.id, { elderId: v.elderId, day: v.scheduledAt.slice(0, 10) });
  return views;
}

/** GET /api/historico (HistoricoResponseDTO). */
export interface HistoricoResponse {
  conteudo: DoseResponse[];
  pagina: number;
  tamanho: number;
  totalElementos: number;
  totalPaginas: number;
}

export function toHistoryPage(dto: HistoricoResponse): HistoryPage {
  return {
    items: remember(dto.conteudo.map(toDoseView)),
    page: dto.pagina,
    size: dto.tamanho,
    totalElements: dto.totalElementos,
    totalPages: dto.totalPaginas,
  };
}

const byTime = (a: DoseView, b: DoseView) => a.scheduledAt.localeCompare(b.scheduledAt) || a.elderName.localeCompare(b.elderName);

/** Doses de um idoso num dia: o cuidador usa a rota do idoso; o idoso, a rota "me" (o idoso vem do token). */
async function listOfElder(elderId: string, day: DateKey): Promise<DoseView[]> {
  const path = getViewer() === 'ELDER' ? endpoints.myDoses(day) : endpoints.elderDoses(String(toApiId(elderId)), day);
  return remember((await request<DoseResponse[]>('GET', path)).map(toDoseView));
}

async function listForDay(filter: string, day: DateKey): Promise<DoseView[]> {
  if (filter !== 'ALL') return (await listOfElder(filter, day)).sort(byTime);
  // "Todos" (só cuidador): a API lista por idoso
  const elders = (await request<IdosoResponse[]>('GET', endpoints.elders)).map(toElder);
  const lists = await Promise.all(elders.map((e) => listOfElder(e.id, day)));
  return lists.flat().sort(byTime);
}

/**
 * Doses reais na API. Confirmar (PUT /api/doses/{id}/confirmar) vale para o idoso (a própria dose) e para o cuidador
 * (dose de um idoso dele): o servidor sabe quem é pelo token e grava confirmadoPor. Os erros 409 DOSE_JA_REGISTRADA,
 * DOSE_MUITO_CEDO e DOSE_ENCERRADA chegam como AppError com o código e a mensagem clara.
 */
export const httpDoseService: DoseService = {
  listForDay,

  async get(id, hint) {
    const origin = hint ?? doseOrigin.get(id);
    if (!origin) throw httpError(404, 'Não encontramos esta dose. Volte e abra de novo pela lista.', 'RECURSO_NAO_ENCONTRADO');
    const dose = (await listOfElder(origin.elderId, origin.day)).find((d) => d.id === id);
    if (!dose) throw httpError(404, 'Não encontramos esta dose. Ela pode ter sido removida.', 'RECURSO_NAO_ENCONTRADO');
    return dose;
  },

  async confirm(id) {
    const view = toDoseView(await request<DoseResponse>('PUT', endpoints.confirmDose(String(toApiId(id)))));
    remember([view]);
    return view;
  },

  /** Alertas do dia vindos do servidor: doses ainda PENDENTES que ele já mostra como ATRASADA ou NAO_TOMADA. */
  async listAlerts() {
    const doses = await listForDay('ALL', appTodayKey(new Date()));
    return doses
      .filter((d) => d.storedStatus === 'PENDENTE' && (d.status === 'ATRASADA' || d.status === 'NAO_TOMADA'))
      .map<AlertView>((d) => ({
        doseId: d.id,
        elderId: d.elderId,
        elderName: d.elderName,
        medicationName: d.medication.name,
        dosage: d.medication.dosage,
        scheduledAt: d.scheduledAt,
        status: d.status as AlertView['status'],
      }));
  },

  /**
   * GET /api/historico (só cuidador): idoso "Todos" não manda idosoId (a API restringe aos idosos do cuidador).
   * Período invertido chega como 400 VALIDACAO com a mensagem da API; idoso alheio, 404.
   */
  async listHistory(query) {
    const path = historyPath(endpoints.history, {
      elderApiId: query.elder === 'ALL' ? undefined : toApiId(query.elder),
      medicationApiId: query.medicationId ? toApiId(query.medicationId) : undefined,
      from: query.from,
      to: query.to,
      status: query.status,
      page: query.page ?? 0,
      size: query.size ?? HISTORY_PAGE_SIZE,
    });
    return toHistoryPage(await request<HistoricoResponse>('GET', path));
  },

  /** GET /api/configuracoes/tolerancia: a do cuidador ou, sem configuração, a padrão. */
  async getTolerance() {
    return (await request<{ toleranciaMinutos: number }>('GET', endpoints.tolerance)).toleranciaMinutos;
  },

  /** PUT /api/configuracoes/tolerancia (5 a 120). Fora da faixa, a API responde 400 VALIDACAO no campo. */
  async setTolerance(minutes) {
    return (await request<{ toleranciaMinutos: number }>('PUT', endpoints.tolerance, { toleranciaMinutos: minutes })).toleranciaMinutos;
  },
};
