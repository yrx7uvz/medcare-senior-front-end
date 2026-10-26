import type { MedicationInfo } from '../types/views';
import { pillColors } from '../theme/colors';

/**
 * Base de demonstração do MedicationInfoService. Simula uma fonte externa
 * (DailyMed/SPL, base própria ou ANVISA). A aparência real varia por fabricante.
 */
const SOURCE = 'Base de demonstração (simula DailyMed/ANVISA)';

export const MEDICATION_CATALOG: MedicationInfo[] = [
  { name: 'Metformina', suggestedDosages: ['500mg', '850mg', '1g'], type: 'COMPRIMIDO', shape: 'OVAL', primaryColor: pillColors.branco, lengthMm: 19, widthMm: 9, hasScore: true, imprint: '850', source: SOURCE },
  { name: 'Losartana', suggestedDosages: ['25mg', '50mg', '100mg'], type: 'COMPRIMIDO', shape: 'REDONDO', primaryColor: pillColors.branco, lengthMm: 9, widthMm: 9, hasScore: true, imprint: 'L50', source: SOURCE },
  { name: 'Atorvastatina', suggestedDosages: ['10mg', '20mg', '40mg'], type: 'COMPRIMIDO', shape: 'OVAL', primaryColor: pillColors.branco, lengthMm: 11, widthMm: 6, imprint: '20', source: SOURCE },
  { name: 'Omeprazol', suggestedDosages: ['20mg', '40mg'], type: 'CAPSULA', primaryColor: pillColors.roxo, secondaryColor: pillColors.rosa, lengthMm: 17, widthMm: 6, source: SOURCE },
  { name: 'Levotiroxina', suggestedDosages: ['25mcg', '50mcg', '75mcg', '100mcg'], type: 'COMPRIMIDO', shape: 'REDONDO', primaryColor: pillColors.branco, lengthMm: 7, widthMm: 7, hasScore: true, imprint: '50', source: SOURCE },
  { name: 'Anlodipino', suggestedDosages: ['5mg', '10mg'], type: 'COMPRIMIDO', shape: 'REDONDO', primaryColor: pillColors.branco, lengthMm: 8, widthMm: 8, imprint: '5', source: SOURCE },
  { name: 'Sinvastatina', suggestedDosages: ['20mg', '40mg'], type: 'COMPRIMIDO', shape: 'OVAL', primaryColor: pillColors.rosa, lengthMm: 10, widthMm: 6, imprint: 'S20', source: SOURCE },
  { name: 'Hidroclorotiazida', suggestedDosages: ['25mg', '50mg'], type: 'COMPRIMIDO', shape: 'REDONDO', primaryColor: pillColors.amarelo, lengthMm: 7, widthMm: 7, hasScore: true, source: SOURCE },
  { name: 'Ácido acetilsalicílico', suggestedDosages: ['100mg'], type: 'COMPRIMIDO', shape: 'REDONDO', primaryColor: pillColors.branco, lengthMm: 7, widthMm: 7, source: SOURCE },
  { name: 'Clopidogrel', suggestedDosages: ['75mg'], type: 'COMPRIMIDO', shape: 'REDONDO', primaryColor: pillColors.rosa, lengthMm: 9, widthMm: 9, imprint: '75', source: SOURCE },
  { name: 'Donepezila', suggestedDosages: ['5mg', '10mg'], type: 'COMPRIMIDO', shape: 'OBLONGO', primaryColor: pillColors.amarelo, lengthMm: 12, widthMm: 6, imprint: 'D10', source: SOURCE },
  { name: 'Lactulose', suggestedDosages: ['667mg/mL'], type: 'XAROPE', primaryColor: pillColors.ambar, secondaryColor: pillColors.branco, source: SOURCE },
  { name: 'Vitamina D', suggestedDosages: ['200 UI/gota'], type: 'GOTAS', primaryColor: pillColors.ambar, secondaryColor: pillColors.laranja, source: SOURCE },
  { name: 'Insulina NPH', suggestedDosages: ['100 UI/mL'], type: 'INJECAO', primaryColor: pillColors.azulClaro, secondaryColor: pillColors.cinza, source: SOURCE },
  { name: 'Rivastigmina', suggestedDosages: ['4,6mg/24h', '9,5mg/24h'], type: 'ADESIVO', primaryColor: pillColors.creme, lengthMm: 45, widthMm: 45, source: SOURCE },
];

export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
