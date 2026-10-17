import type { MedicationInfoService } from '../../services/types';
import { MEDICATION_CATALOG, normalize } from '../../mocks/medicationCatalog';
import { simulate } from './simulate';

/** Busca por nome, sem acentos e sem diferenciar maiúsculas. null = não encontrado. */
export const mockMedicationInfoService: MedicationInfoService = {
  lookup: (name) =>
    simulate(() => {
      const q = normalize(name);
      if (q.length < 3) return null;
      return (
        MEDICATION_CATALOG.find((m) => normalize(m.name) === q) ??
        MEDICATION_CATALOG.find((m) => normalize(m.name).startsWith(q) || q.startsWith(normalize(m.name))) ??
        null
      );
    }, 500),
};
