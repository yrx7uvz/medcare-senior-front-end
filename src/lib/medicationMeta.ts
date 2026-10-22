import type { Medication, MedicationType, PillShape, Treatment } from '../types/domain';
import { WEEKDAYS_SHORT } from './date';
import { pillColors } from '../theme/colors';

export const TYPE_LABEL: Record<MedicationType, string> = {
  COMPRIMIDO: 'Comprimido',
  CAPSULA: 'Cápsula',
  GOTAS: 'Gotas',
  INJECAO: 'Injeção',
  XAROPE: 'Xarope',
  ADESIVO: 'Adesivo',
};

export const SHAPE_LABEL: Record<PillShape, string> = {
  REDONDO: 'Redondo',
  OVAL: 'Oval',
  OBLONGO: 'Oblongo',
  RETANGULAR: 'Retangular',
  LOSANGO: 'Losango',
  OUTRO: 'Outro',
};

/** Paleta do seletor de cor. Os nomes são lidos pelo leitor de tela. */
export const PILL_COLORS: { value: string; name: string }[] = [
  { value: pillColors.branco, name: 'Branco' },
  { value: pillColors.creme, name: 'Creme' },
  { value: pillColors.amarelo, name: 'Amarelo' },
  { value: pillColors.laranja, name: 'Laranja' },
  { value: pillColors.rosa, name: 'Rosa' },
  { value: pillColors.vermelho, name: 'Vermelho' },
  { value: pillColors.azulClaro, name: 'Azul-claro' },
  { value: pillColors.azul, name: 'Azul' },
  { value: pillColors.verde, name: 'Verde' },
  { value: pillColors.roxo, name: 'Roxo' },
  { value: pillColors.marrom, name: 'Marrom' },
  { value: pillColors.ambar, name: 'Âmbar' },
  { value: pillColors.cinza, name: 'Cinza' },
  { value: pillColors.preto, name: 'Preto' },
];

export function colorName(hex?: string): string {
  if (!hex) return '';
  return PILL_COLORS.find((c) => c.value.toLowerCase() === hex.toLowerCase())?.name.toLowerCase() ?? 'colorido';
}

/** Comprimido e cápsula têm tamanho físico relevante para reconhecimento. */
export const hasPhysicalSize = (t: MedicationType) => t === 'COMPRIMIDO' || t === 'CAPSULA' || t === 'ADESIVO';
export const isBottle = (t: MedicationType) => t === 'GOTAS' || t === 'XAROPE';

export const DEFAULT_PRIMARY: Record<MedicationType, string> = {
  COMPRIMIDO: pillColors.branco,
  CAPSULA: pillColors.azul,
  GOTAS: pillColors.ambar,
  XAROPE: pillColors.ambar,
  INJECAO: pillColors.azulClaro,
  ADESIVO: pillColors.creme,
};

export const DEFAULT_SECONDARY: Record<MedicationType, string> = {
  COMPRIMIDO: pillColors.branco,
  CAPSULA: pillColors.creme,
  GOTAS: pillColors.laranja,
  XAROPE: pillColors.branco,
  INJECAO: pillColors.cinza,
  ADESIVO: pillColors.creme,
};

export function defaultDoseQuantity(t: MedicationType): string {
  switch (t) {
    case 'COMPRIMIDO': return '1 comprimido';
    case 'CAPSULA': return '1 cápsula';
    case 'GOTAS': return '10 gotas';
    case 'INJECAO': return '1 aplicação';
    case 'XAROPE': return '10 mL';
    case 'ADESIVO': return '1 adesivo';
  }
}

export function routeLabel(t: MedicationType): string {
  switch (t) {
    case 'ADESIVO': return 'Uso na pele';
    case 'INJECAO': return 'Injetável';
    default: return 'Via oral';
  }
}

export function stockLabel(m: Pick<Medication, 'type' | 'stock'>): string | null {
  if (m.stock === undefined) return null;
  if (isBottle(m.type)) return `${m.stock} frasco${m.stock === 1 ? '' : 's'}`;
  return `${m.stock} un.`;
}

/** Tratamento ativo (RN06): não removido e sem fim, ou com fim hoje ou depois. */
export function isTreatmentActive(t: Treatment | undefined, todayKey: string): boolean {
  if (!t || t.removedAt) return false;
  return !t.endDate || t.endDate >= todayKey;
}

/**
 * O app mostra UM tratamento por remédio; a API permite vários (do mais antigo para o mais recente).
 * Vale o mais recente ainda ativo; se nenhum estiver, o mais recente.
 */
export function pickCurrentTreatment(treatments: readonly Treatment[], todayKey: string): Treatment | undefined {
  const active = treatments.filter((t) => isTreatmentActive(t, todayKey));
  return active[active.length - 1] ?? treatments[treatments.length - 1];
}

export function weekdaySummary(weekdays: number[]): string {
  if (weekdays.length === 7) return 'Todos os dias';
  if (weekdays.length === 5 && [1, 2, 3, 4, 5].every((d) => weekdays.includes(d))) return 'Segunda a sexta';
  return [...weekdays].sort((a, b) => a - b).map((d) => WEEKDAYS_SHORT[d]).join(', ');
}

export function scheduleSummary(t?: Treatment): string {
  if (!t) return 'Sem tratamento';
  const times = t.times.map((x) => x.time).sort();
  const timesText = times.length > 1 ? `${times.slice(0, -1).join(', ')} e ${times[times.length - 1]}` : times[0] ?? '';
  return `${timesText} • ${weekdaySummary(t.weekdays)}`;
}

/** Comparação de tamanho para leigos (PillSizeLegend). */
export function sizeComparison(lengthMm?: number): string | null {
  if (!lengthMm) return null;
  if (lengthMm <= 6) return 'do tamanho de uma lentilha';
  if (lengthMm <= 9) return 'do tamanho de um grão de feijão';
  if (lengthMm <= 14) return 'do tamanho de um amendoim';
  if (lengthMm <= 20) return 'quase do tamanho de uma moeda de 10 centavos';
  return 'maior que uma moeda de 10 centavos';
}

export function describeAppearance(m: {
  type: MedicationType;
  shape?: PillShape;
  primaryColor?: string;
  secondaryColor?: string;
  lengthMm?: number;
  widthMm?: number;
  hasScore?: boolean;
  imprint?: string;
}): string {
  const parts: string[] = [TYPE_LABEL[m.type]];
  if (m.type === 'COMPRIMIDO' && m.shape) parts.push(SHAPE_LABEL[m.shape].toLowerCase());
  if (m.type === 'CAPSULA' && m.secondaryColor && m.secondaryColor !== m.primaryColor) {
    parts.push(`${colorName(m.primaryColor)} e ${colorName(m.secondaryColor)}`);
  } else if (m.primaryColor) {
    parts.push(colorName(m.primaryColor));
  }
  if (m.lengthMm && hasPhysicalSize(m.type)) {
    parts.push(m.widthMm && m.widthMm !== m.lengthMm ? `cerca de ${m.lengthMm} por ${m.widthMm} milímetros` : `cerca de ${m.lengthMm} milímetros`);
  }
  if (m.hasScore) parts.push('com sulco');
  if (m.imprint) parts.push(`marcação ${m.imprint}`);
  return parts.join(', ');
}
