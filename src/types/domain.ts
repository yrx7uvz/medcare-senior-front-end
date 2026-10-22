/**
 * Modelo de domínio do front-end. Espelha as entidades da API (Cuidador, Idoso,
 * Medicamento, Tratamento, Dose, Mensagem, CodigoVinculo) com os campos extras
 * de aparência do remédio usados pelo PillVisual.
 */
export type ID = string;
/** Data local no formato 'AAAA-MM-DD'. */
export type DateKey = string;
/** Data e hora local no formato 'AAAA-MM-DDTHH:mm'. */
export type DateTimeKey = string;

export interface Caregiver {
  id: ID;
  name: string;
  email: string;
  phone?: string;
  createdAt: DateTimeKey;
  lgpdConsentAt: DateTimeKey;
}

export interface Elder {
  id: ID;
  caregiverId: ID;
  name: string;
  birthDate: DateKey;
  phone?: string;
  avatarColor: string;
}

export const MEDICATION_TYPE_VALUES = ['COMPRIMIDO', 'CAPSULA', 'GOTAS', 'INJECAO', 'XAROPE', 'ADESIVO'] as const;
export type MedicationType = (typeof MEDICATION_TYPE_VALUES)[number];

export const PILL_SHAPE_VALUES = ['REDONDO', 'OVAL', 'OBLONGO', 'RETANGULAR', 'LOSANGO', 'OUTRO'] as const;
export type PillShape = (typeof PILL_SHAPE_VALUES)[number];

/** MANUAL = preenchido pelo cuidador; EXTERNA = veio do MedicationInfoService. */
export type AppearanceSource = 'MANUAL' | 'EXTERNA';

/** Tudo o que o PillVisual precisa para desenhar um remédio. */
export interface MedicationAppearance {
  type: MedicationType;
  shape?: PillShape;
  primaryColor?: string;
  /** Cor da segunda metade (cápsula bicolor) ou da tampa (frascos). */
  secondaryColor?: string;
  lengthMm?: number;
  widthMm?: number;
  imprint?: string;
  hasScore?: boolean;
  photoUrl?: string;
}

export interface Medication extends MedicationAppearance {
  id: ID;
  elderId: ID;
  name: string;
  dosage: string;
  stock?: number;
  /** Texto livre de orientações (só os dados de demonstração). */
  leaflet?: string;
  /** Link da bula (API: bulaUrl). */
  bulaUrl?: string;
  appearanceSource: AppearanceSource;
  createdAt: DateTimeKey;
  /** Remoção lógica (RN06/RN08): preenchido = removido, histórico preservado. */
  removedAt?: DateTimeKey;
}

export interface ScheduleTime {
  /** 'HH:mm' */
  time: string;
  note?: string;
}

export interface Treatment {
  id: ID;
  medicationId: ID;
  startDate: DateKey;
  endDate?: DateKey;
  /** 0 = domingo ... 6 = sábado */
  weekdays: number[];
  times: ScheduleTime[];
  /** Ex.: "1 cápsula", "15 mL", "7 gotas". */
  doseQuantity?: string;
  removedAt?: DateTimeKey;
}

/** Status persistido no backend (coluna dose.status). NAO_TOMADA aparece na tela como "Não confirmada". */
export type DoseStatus = 'PENDENTE' | 'CONFIRMADA_NO_HORARIO' | 'NAO_TOMADA' | 'CONFIRMADA_COM_ATRASO';

/**
 * Status exibido. ATRASADA = ainda PENDENTE no banco, mas além da tolerância:
 * o cuidador já foi avisado e a dose ainda pode ser confirmada com atraso.
 */
export type DisplayStatus = DoseStatus | 'ATRASADA';

/** Quem confirmou a dose (dose.confirmado_por): o idoso, no aparelho dele, ou o cuidador, na tela da dose. */
export type ConfirmedBy = 'IDOSO' | 'CUIDADOR';

/** Dose registrada é imutável: toda mudança gera um novo objeto. */
export interface Dose {
  readonly id: ID;
  readonly elderId: ID;
  readonly medicationId: ID;
  readonly treatmentId: ID | null;
  readonly scheduledAt: DateTimeKey;
  readonly status: DoseStatus;
  readonly confirmedAt?: DateTimeKey;
  /** Só nas doses confirmadas. */
  readonly confirmedBy?: ConfirmedBy;
  readonly timeNote?: string;
}

export type MessageAuthor = 'CUIDADOR' | 'IDOSO';

export interface Message {
  id: ID;
  elderId: ID;
  from: MessageAuthor;
  text: string;
  sentAt: DateTimeKey;
  /** Lida pelo destinatário. */
  read: boolean;
}

export interface LinkCode {
  code: string;
  elderId: ID;
  /** Epoch em ms (relógio do protótipo). */
  expiresAt: number;
  used: boolean;
}
