import type { Dose, Elder, LinkCode, Medication, Message, Treatment } from '../types/domain';
import { DEMO_START, DEMO_TODAY_KEY } from '../lib/clock';
import { parseDateTime } from '../lib/date';
import { DEFAULT_TOLERANCE_MIN } from '../lib/doseRules';
import { GENERATION_WINDOW_DAYS, doseId, generateDoses } from '../lib/doseGenerator';
import { buildHistory } from './history';
import { avatarColors, pillColors } from '../theme/colors';

export interface CaregiverAccount {
  id: string;
  name: string;
  email: string;
  phone?: string;
  createdAt: string;
  lgpdConsentAt: string;
  /** Hash mock (o backend usa BCrypt). null = conta de demonstração, sem senha. */
  passwordHash: string | null;
}

export interface MockDb {
  accounts: CaregiverAccount[];
  activeCaregiverId: string;
  elders: Elder[];
  medications: Medication[];
  treatments: Treatment[];
  doses: Dose[];
  messages: Message[];
  linkCodes: LinkCode[];
  toleranceMinutes: number;
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const H = 3_600_000;

/** Status de hoje (05/06/2026) até 14:02. As demais doses de hoje ficam pendentes. */
const TODAY_REGISTERED: Record<string, Pick<Dose, 'status' | 'confirmedAt' | 'confirmedBy'>> = {
  [doseId('t-metformina', `${DEMO_TODAY_KEY}T08:00`)]: { status: 'CONFIRMADA_NO_HORARIO', confirmedAt: `${DEMO_TODAY_KEY}T08:04`, confirmedBy: 'IDOSO' },
  [doseId('t-losartana', `${DEMO_TODAY_KEY}T08:00`)]: { status: 'CONFIRMADA_NO_HORARIO', confirmedAt: `${DEMO_TODAY_KEY}T08:05`, confirmedBy: 'CUIDADOR' },
  [doseId('t-levotiroxina', `${DEMO_TODAY_KEY}T06:00`)]: { status: 'CONFIRMADA_COM_ATRASO', confirmedAt: `${DEMO_TODAY_KEY}T06:48`, confirmedBy: 'IDOSO' },
};

export function createSeedDb(): MockDb {
  const elders: Elder[] = [
    { id: 'e-jose', caregiverId: 'c-maria', name: 'José Ferreira', birthDate: '1948-03-12', phone: '(61) 98765-1020', avatarColor: avatarColors[0] },
    { id: 'e-helena', caregiverId: 'c-maria', name: 'Helena Souza', birthDate: '1951-08-22', avatarColor: avatarColors[1] },
  ];

  const medications: Medication[] = [
    {
      id: 'm-metformina', elderId: 'e-jose', name: 'Metformina', dosage: '850mg', type: 'COMPRIMIDO', shape: 'OVAL',
      primaryColor: pillColors.branco, lengthMm: 19, widthMm: 9, hasScore: true, imprint: '850', stock: 28,
      leaflet: 'Tomar junto com as refeições. Evitar bebida alcoólica.', appearanceSource: 'EXTERNA', createdAt: '2026-05-11T09:00',
    },
    {
      id: 'm-losartana', elderId: 'e-jose', name: 'Losartana', dosage: '50mg', type: 'COMPRIMIDO', shape: 'REDONDO',
      primaryColor: pillColors.branco, lengthMm: 9, widthMm: 9, hasScore: true, imprint: 'L50', stock: 30,
      // Foto inexistente de propósito: demonstra o fallback para o desenho SVG.
      photoUrl: 'https://fotos.medcare.invalid/losartana-50mg.jpg',
      appearanceSource: 'MANUAL', createdAt: '2026-05-11T09:05',
    },
    {
      id: 'm-atorvastatina', elderId: 'e-jose', name: 'Atorvastatina', dosage: '20mg', type: 'COMPRIMIDO', shape: 'OVAL',
      primaryColor: pillColors.branco, lengthMm: 11, widthMm: 6, imprint: '20', stock: 4,
      appearanceSource: 'EXTERNA', createdAt: '2026-05-16T10:00',
    },
    {
      id: 'm-omeprazol', elderId: 'e-jose', name: 'Omeprazol', dosage: '20mg', type: 'CAPSULA',
      primaryColor: pillColors.roxo, secondaryColor: pillColors.rosa, lengthMm: 17, widthMm: 6, stock: 14,
      leaflet: 'Engolir a cápsula inteira, com um copo de água.', appearanceSource: 'MANUAL', createdAt: '2026-05-26T08:00',
    },
    {
      id: 'm-levotiroxina', elderId: 'e-helena', name: 'Levotiroxina', dosage: '50mcg', type: 'COMPRIMIDO', shape: 'REDONDO',
      primaryColor: pillColors.branco, lengthMm: 7, widthMm: 7, hasScore: true, imprint: '50', stock: 40,
      leaflet: 'Tomar em jejum, 30 minutos antes do café.', appearanceSource: 'EXTERNA', createdAt: '2026-05-11T09:30',
    },
    {
      // Sem tamanho informado: demonstra a legenda "Tamanho não informado".
      id: 'm-lactulose', elderId: 'e-helena', name: 'Lactulose', dosage: '667mg/mL', type: 'XAROPE',
      primaryColor: pillColors.ambar, secondaryColor: pillColors.branco, stock: 2, appearanceSource: 'MANUAL', createdAt: '2026-05-21T18:00',
    },
    {
      id: 'm-vitaminad', elderId: 'e-helena', name: 'Vitamina D', dosage: '200 UI/gota', type: 'GOTAS',
      primaryColor: pillColors.ambar, secondaryColor: pillColors.laranja, stock: 2, appearanceSource: 'MANUAL', createdAt: '2026-05-08T09:00',
    },
  ];

  const treatments: Treatment[] = [
    { id: 't-metformina', medicationId: 'm-metformina', startDate: '2026-05-11', weekdays: ALL_DAYS, doseQuantity: '1 comprimido',
      times: [{ time: '08:00', note: 'Após o café da manhã' }, { time: '20:00', note: 'Após o jantar' }] },
    { id: 't-losartana', medicationId: 'm-losartana', startDate: '2026-05-11', weekdays: ALL_DAYS, doseQuantity: '1 comprimido',
      times: [{ time: '08:00' }] },
    { id: 't-atorvastatina', medicationId: 'm-atorvastatina', startDate: '2026-05-16', weekdays: ALL_DAYS, doseQuantity: '1 comprimido',
      times: [{ time: '12:00', note: 'Após o almoço' }] },
    { id: 't-omeprazol', medicationId: 'm-omeprazol', startDate: '2026-05-26', endDate: '2026-07-26', weekdays: ALL_DAYS, doseQuantity: '1 cápsula',
      times: [{ time: '14:00' }] },
    { id: 't-levotiroxina', medicationId: 'm-levotiroxina', startDate: '2026-05-11', weekdays: ALL_DAYS, doseQuantity: '1 comprimido',
      times: [{ time: '06:00', note: 'Em jejum' }] },
    { id: 't-lactulose', medicationId: 'm-lactulose', startDate: '2026-05-21', weekdays: ALL_DAYS, doseQuantity: '15 mL',
      times: [{ time: '21:00' }] },
    { id: 't-vitaminad', medicationId: 'm-vitaminad', startDate: '2026-05-08', weekdays: [0], doseQuantity: '7 gotas',
      times: [{ time: '09:00', note: 'Com o café da manhã' }] },
  ];

  const today = parseDateTime(DEMO_TODAY_KEY);
  const doses: Dose[] = [];
  for (const t of treatments) {
    const med = medications.find((m) => m.id === t.medicationId)!;
    doses.push(...buildHistory(t, med, today));
    for (const d of generateDoses(t, med, today, GENERATION_WINDOW_DAYS)) {
      const registered = TODAY_REGISTERED[d.id];
      doses.push(registered ? { ...d, ...registered } : d);
    }
  }

  const messages: Message[] = [
    { id: 'msg-1', elderId: 'e-jose', from: 'CUIDADOR', text: 'Bom dia, seu José! Lembre do remédio do almoço, tá?', sentAt: '2026-06-05T07:40', read: true },
    { id: 'msg-2', elderId: 'e-jose', from: 'IDOSO', text: 'Bom dia, Maria. Pode deixar.', sentAt: '2026-06-05T08:06', read: true },
    { id: 'msg-3', elderId: 'e-jose', from: 'CUIDADOR', text: 'O remédio das 12:00 ainda não foi confirmado. Está tudo bem?', sentAt: '2026-06-05T12:40', read: false },
    { id: 'msg-4', elderId: 'e-helena', from: 'CUIDADOR', text: 'Dona Helena, comprei mais Lactulose. Levo amanhã cedo.', sentAt: '2026-06-04T19:02', read: true },
    { id: 'msg-5', elderId: 'e-helena', from: 'IDOSO', text: 'Obrigada, minha filha!', sentAt: '2026-06-04T19:20', read: false },
  ];

  const base = DEMO_START.getTime();
  const linkCodes: LinkCode[] = [
    { code: '482913', elderId: 'e-jose', expiresAt: base + 20 * H, used: false },
    { code: '305718', elderId: 'e-helena', expiresAt: base + 9 * H, used: false },
    { code: '111111', elderId: 'e-jose', expiresAt: base - 2 * H, used: false }, // expirado
    { code: '222222', elderId: 'e-helena', expiresAt: base + 12 * H, used: true }, // já usado
  ];

  return {
    accounts: [
      { id: 'c-maria', name: 'Maria Oliveira', email: 'maria@medcare.demo', phone: '(61) 99876-5432',
        createdAt: '2026-04-20T10:12', lgpdConsentAt: '2026-04-20T10:12', passwordHash: null },
    ],
    activeCaregiverId: 'c-maria',
    elders,
    medications,
    treatments,
    doses,
    messages,
    linkCodes,
    toleranceMinutes: DEFAULT_TOLERANCE_MIN,
  };
}
