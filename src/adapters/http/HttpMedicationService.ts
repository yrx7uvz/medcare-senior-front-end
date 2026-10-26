import { apiTimeToHHmm, apiWeekdayToIndex, indexToApiWeekday, saoPauloDateKey } from '../../lib/apiTime';
import { isTreatmentActive, pickCurrentTreatment, scheduleSummary } from '../../lib/medicationMeta';
import { toAppError, TreatmentNotSavedError } from '../../services/errors';
import type { MedicationService } from '../../services/types';
import { MEDICATION_TYPE_VALUES, PILL_SHAPE_VALUES, type Medication, type MedicationType, type PillShape, type Treatment } from '../../types/domain';
import type { PatientFilter, MedicationInput, MedicationView, TreatmentInput } from '../../types/views';
import { endpoints } from './endpoints';
import { toPatient, type PacienteResponse } from './HttpPatientService';
import { request } from './httpClient';
import { fromApiId, toApiId } from './ids';

/** GET/POST/PUT /api/medicamentos (MedicamentoResponseDTO). */
export interface MedicamentoResponse {
  id: number;
  nome: string;
  dosagem: string;
  tipo: string;
  formato: string | null;
  cor: string | null;
  quantidadeEstoque: number | null;
  bulaUrl: string | null;
  pacienteId: number;
}

/** GET/POST /api/medicamentos/{id}/tratamentos e PUT /api/tratamentos/{id} (TratamentoResponseDTO). */
export interface TratamentoResponse {
  id: number;
  medicamentoId: number;
  dataInicio: string;
  dataFim: string | null;
  horarios: string[];
  diasSemana: string[];
}

const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

/** A cor guardada na API é texto livre; o desenho do remédio só usa '#RRGGBB'. Outro texto fica sem cor. */
export const apiColorToHex = (cor: string | null | undefined): string | undefined => (cor && HEX_COLOR_RE.test(cor) ? cor : undefined);

/** Cadastros antigos podem ter tipo em texto livre: para o desenho do remédio, vira COMPRIMIDO. */
const toType = (tipo: string): MedicationType => ((MEDICATION_TYPE_VALUES as readonly string[]).includes(tipo) ? (tipo as MedicationType) : 'COMPRIMIDO');

/** A API guarda o formato como texto; o app usa a lista fixa (REDONDO, OVAL...). Outro texto fica sem formato. */
const toShape = (formato: string | null): PillShape | undefined => {
  const value = formato?.trim().toUpperCase();
  return value && (PILL_SHAPE_VALUES as readonly string[]).includes(value) ? (value as PillShape) : undefined;
};

export function toMedication(dto: MedicamentoResponse): Medication {
  return {
    id: fromApiId(dto.id),
    patientId: fromApiId(dto.pacienteId),
    name: dto.nome,
    dosage: dto.dosagem,
    type: toType(dto.tipo),
    shape: toShape(dto.formato),
    primaryColor: apiColorToHex(dto.cor),
    stock: dto.quantidadeEstoque ?? undefined,
    bulaUrl: dto.bulaUrl ?? undefined,
    appearanceSource: 'MANUAL',
    // A API não devolve a data de cadastro
    createdAt: '',
  };
}

/**
 * Corpo de POST/PUT /api/medicamentos (MedicamentoRequestDTO): só os campos que a API guarda (o formulário do app já
 * não tem outros).
 */
export function toMedicamentoRequest(input: MedicationInput) {
  return {
    nome: input.name.trim(),
    dosagem: input.dosage.trim(),
    tipo: input.type,
    formato: input.type === 'COMPRIMIDO' && input.shape ? input.shape : undefined,
    cor: apiColorToHex(input.primaryColor),
    quantidadeEstoque: input.stock,
    bulaUrl: input.bulaUrl?.trim() || undefined,
    pacienteId: toApiId(input.patientId),
  };
}

export function toTreatment(dto: TratamentoResponse): Treatment {
  const times = dto.horarios
    .map(apiTimeToHHmm)
    .filter((t): t is string => t !== null)
    .sort()
    .map((time) => ({ time }));
  const weekdays = dto.diasSemana
    .map(apiWeekdayToIndex)
    .filter((d): d is number => d !== null)
    .sort((a, b) => a - b);
  return {
    id: fromApiId(dto.id),
    medicationId: fromApiId(dto.medicamentoId),
    startDate: dto.dataInicio,
    endDate: dto.dataFim ?? undefined,
    weekdays,
    times,
  };
}

const schedule = (input: TreatmentInput) => ({
  horarios: [...new Set(input.times.map((t) => t.time))].sort(),
  diasSemana: [...input.weekdays].sort((a, b) => a - b).map(indexToApiWeekday),
});

/** Corpo de POST /api/medicamentos/{id}/tratamentos (TratamentoRequestDTO). */
export const toTratamentoRequest = (input: TreatmentInput) => ({
  dataInicio: input.startDate,
  dataFim: input.endDate,
  ...schedule(input),
});

/** Corpo de PUT /api/tratamentos/{id} (TratamentoEdicaoRequestDTO): a data de início não muda. */
export const toTratamentoEdicaoRequest = (input: TreatmentInput) => ({
  dataFim: input.endDate ?? null,
  ...schedule(input),
});

const todayKey = () => saoPauloDateKey(Date.now());

function toView(medication: Medication, treatments: Treatment[], patientName: string): MedicationView {
  const treatment = pickCurrentTreatment(treatments, todayKey());
  return {
    medication,
    patientName,
    treatment,
    activeTreatment: isTreatmentActive(treatment, todayKey()),
    scheduleSummary: scheduleSummary(treatment),
  };
}

async function fetchTreatments(medicationId: string): Promise<Treatment[]> {
  const dtos = await request<TratamentoResponse[]>('GET', endpoints.treatments(String(toApiId(medicationId))));
  return dtos.map(toTreatment);
}

async function fetchMedication(id: string): Promise<Medication> {
  return toMedication(await request<MedicamentoResponse>('GET', endpoints.medication(String(toApiId(id)))));
}

/** Remédios de um paciente, cada um com os tratamentos (uma chamada por remédio, em paralelo). */
async function listOfPatient(patientId: string, patientName: string): Promise<MedicationView[]> {
  const dtos = await request<MedicamentoResponse[]>('GET', endpoints.medicationsOfPatient(String(toApiId(patientId))));
  return Promise.all(
    dtos.map(async (dto) => {
      const medication = toMedication(dto);
      return toView(medication, await fetchTreatments(medication.id), patientName);
    }),
  );
}

const byPatientThenName = (a: MedicationView, b: MedicationView) => a.patientName.localeCompare(b.patientName) || a.medication.name.localeCompare(b.medication.name);

/**
 * Medicamentos e tratamentos na API. Cadastro em duas chamadas (medicamento, depois tratamento):
 * se só a primeira der certo, lança TreatmentNotSavedError com o id do medicamento, para a tela
 * avisar e tentar de novo só o tratamento (createTreatment). IDs sempre opacos (toApiId/fromApiId).
 */
export const httpMedicationService: MedicationService = {
  /**
   * "Todos" (ALL): a API lista por paciente (pacienteId obrigatório), então busca os pacientes do cuidador e
   * os remédios de cada um em paralelo.
   */
  async list(filter: PatientFilter) {
    const patients =
      filter === 'ALL'
        ? (await request<PacienteResponse[]>('GET', endpoints.patients)).map(toPatient)
        : [toPatient(await request<PacienteResponse>('GET', endpoints.patient(String(toApiId(filter)))))];
    const lists = await Promise.all(patients.map((e) => listOfPatient(e.id, e.name)));
    return lists.flat().sort(byPatientThenName);
  },

  async get(id) {
    const [medication, treatments] = await Promise.all([fetchMedication(id), fetchTreatments(id)]);
    return { medication, treatment: pickCurrentTreatment(treatments, todayKey()) };
  },

  async create(input) {
    const medication = toMedication(await request<MedicamentoResponse>('POST', endpoints.medications, toMedicamentoRequest(input)));
    let treatment: Treatment;
    try {
      treatment = toTreatment(await request<TratamentoResponse>('POST', endpoints.treatments(String(toApiId(medication.id))), toTratamentoRequest(input.treatment)));
    } catch (e) {
      throw new TreatmentNotSavedError(medication.id, toAppError(e));
    }
    // O nome do paciente não vem nas respostas; as listas recarregam depois da escrita
    return toView(medication, [treatment], '');
  },

  async createTreatment(medicationId, input) {
    const medication = await fetchMedication(medicationId);
    const treatment = toTreatment(await request<TratamentoResponse>('POST', endpoints.treatments(String(toApiId(medicationId))), toTratamentoRequest(input)));
    return toView(medication, [treatment], '');
  },

  /**
   * PUT do medicamento e, depois, do tratamento vigente (ou POST, se o remédio ficou sem). Se só o
   * medicamento for salvo, lança TreatmentNotSavedError: repetir a edição é seguro (PUT idempotente).
   */
  async update(id, input) {
    const medication = toMedication(await request<MedicamentoResponse>('PUT', endpoints.medication(String(toApiId(id))), toMedicamentoRequest(input)));
    let treatment: Treatment;
    try {
      const current = pickCurrentTreatment(await fetchTreatments(id), todayKey());
      const dto = current
        ? await request<TratamentoResponse>('PUT', endpoints.treatment(String(toApiId(current.id))), toTratamentoEdicaoRequest(input.treatment))
        : await request<TratamentoResponse>('POST', endpoints.treatments(String(toApiId(id))), toTratamentoRequest(input.treatment));
      treatment = toTreatment(dto);
    } catch (e) {
      throw new TreatmentNotSavedError(medication.id, toAppError(e));
    }
    return toView(medication, [treatment], '');
  },

  /**
   * RN06: DELETE ?forcarRemocao=false primeiro; com tratamento ativo a API responde 409
   * TRATAMENTO_ATIVO e a tela pede a confirmação forçada (forcarRemocao=true).
   */
  async remove(id, { confirmed }) {
    await request<void>('DELETE', endpoints.removeMedication(String(toApiId(id)), confirmed));
  },
};
