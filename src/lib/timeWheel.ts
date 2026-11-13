/**
 * Regras puras do seletor de horário em rolagem (TimeWheelPicker): passos com volta (23 -> 00), lista que dá a volta
 * (linhas repetidas), posição da rolagem até a linha, roda do mouse (web) e o valor falado pelo leitor de tela.
 */

export const HOURS = Array.from({ length: 24 }, (_, i) => i);
export const MINUTES = Array.from({ length: 60 }, (_, i) => i);

export const pad2 = (n: number) => String(n).padStart(2, '0');

/** "HH:mm" para [hora, minuto]; texto fora do formato vira null. */
export function parseHHmm(value: string | null | undefined): [number, number] | null {
  const m = /^(\d{2}):(\d{2})$/.exec(value ?? '');
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h <= 23 && min <= 59 ? [h, min] : null;
}

export const toHHmm = (h: number, m: number) => `${pad2(h)}:${pad2(m)}`;

/** Um passo para cima ou para baixo, dando a volta no fim (23 -> 0 nas horas, 59 -> 0 nos minutos). */
export function stepValue(value: number, delta: number, count: number): number {
  return (((value + delta) % count) + count) % count;
}

/** Item no centro da faixa de destaque para a posição da rolagem (encaixa no mais próximo, dentro da lista). */
export function indexFromOffset(offsetY: number, itemHeight: number, count: number): number {
  const index = Math.round(offsetY / itemHeight);
  return Math.max(0, Math.min(count - 1, index));
}

/** Altura de cada linha: 52 dp (acima do mínimo de 48), crescendo com a fonte ampliada do aparelho. */
export const wheelItemHeight = (fontScale: number) => Math.round(52 * Math.max(1, fontScale));

/**
 * Roda que dá a volta (depois do 23 vem o 00): a lista repete os valores em cerca de 4800 linhas e começa na volta do
 * meio. Com a altura fixa das linhas, só o trecho visível é desenhado; chegar à ponta exigiria milhares de linhas de
 * arraste.
 */
export const WHEEL_ROWS_TARGET = 4800;
export const wheelCycles = (count: number) => Math.ceil(WHEEL_ROWS_TARGET / count);
export const wheelRowCount = (count: number) => wheelCycles(count) * count;

/** Valor mostrado numa linha da roda (também para índices negativos). */
export const valueAtRow = (row: number, count: number) => ((row % count) + count) % count;

/** Linha do valor na volta do meio (onde a roda começa). */
export const startRow = (value: number, count: number) => Math.floor(wheelCycles(count) / 2) * count + valueAtRow(value, count);

/** Linha mais próxima de `fromRow` que mostra `value`: o caminho mais curto, dando a volta (de 23 para 00 anda uma). */
export function nearestRowFor(fromRow: number, value: number, count: number): number {
  const diff = valueAtRow(value - valueAtRow(fromRow, count), count);
  const delta = diff > count / 2 ? diff - count : diff;
  return Math.max(0, Math.min(wheelRowCount(count) - 1, fromRow + delta));
}

const UNIDADES = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze',
  'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta'];

/** Número de 0 a 59 por extenso; `feminino` para "uma" e "duas" (horas). */
export function numberToWords(n: number, feminino = false): string {
  const fem = (texto: string) => (feminino ? texto.replace(/^um$/, 'uma').replace(/^dois$/, 'duas').replace(/ e um$/, ' e uma').replace(/ e dois$/, ' e duas') : texto);
  if (n < 20) return fem(UNIDADES[n]);
  const dezena = DEZENAS[Math.floor(n / 10)];
  const unidade = n % 10;
  return fem(unidade === 0 ? dezena : `${dezena} e ${UNIDADES[unidade]}`);
}

export const spokenHours = (h: number) => `${numberToWords(h, true)} ${h === 1 ? 'hora' : 'horas'}`;
export const spokenMinutes = (m: number) => `${numberToWords(m)} ${m === 1 ? 'minuto' : 'minutos'}`;

/** "oito horas e trinta minutos", "uma hora e um minuto", "oito horas em ponto". */
export function spokenTime(h: number, m: number): string {
  return m === 0 ? `${spokenHours(h)} em ponto` : `${spokenHours(h)} e ${spokenMinutes(m)}`;
}

/** Distância da roda do mouse (em pixels) que vale um passo; um "clique" da roda costuma dar 100. */
export const WHEEL_STEP_PX = 100;

/**
 * Passos da roda do mouse (web): acumula a distância (o trackpad manda muitos eventos pequenos) e devolve os passos
 * inteiros e o que sobrou. Para baixo aumenta, como a lista (o valor maior fica embaixo). `deltaMode` 1 = linhas,
 * 2 = páginas.
 */
export function wheelSteps(accumulated: number, deltaY: number, deltaMode = 0): { steps: number; rest: number } {
  const px = deltaY * (deltaMode === 1 ? 40 : deltaMode === 2 ? 800 : 1);
  const total = accumulated + px;
  const steps = Math.trunc(total / WHEEL_STEP_PX);
  return { steps, rest: total - steps * WHEEL_STEP_PX };
}
