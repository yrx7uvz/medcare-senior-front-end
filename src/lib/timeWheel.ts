/**
 * Regras puras do seletor de horário em rolagem (TimeWheelPicker): passos com volta (23 -> 00), posição da rolagem
 * até o item, atalhos, repetição ao segurar os botões, roda do mouse (web) e o valor falado pelo leitor de tela.
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

/** Altura de cada linha: no mínimo 48 dp, crescendo com a fonte ampliada do aparelho. */
export const wheelItemHeight = (fontScale: number) => Math.round(48 * Math.max(1, fontScale));

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

/** Atalhos: horas comuns de remédio e os quartos de hora. */
export const HOUR_SHORTCUTS = [6, 8, 12, 14, 18, 20, 22];
export const MINUTE_SHORTCUTS = [0, 15, 30, 45];

/** Rótulo falado dos atalhos: "Horas: oito", "Minutos: quinze". */
export const hourShortcutLabel = (h: number) => `Horas: ${numberToWords(h, true)}`;
export const minuteShortcutLabel = (m: number) => `Minutos: ${numberToWords(m)}`;

/** Espera antes da primeira repetição ao segurar "+" ou "−", e o mínimo entre passos (cerca de 12 por segundo). */
export const HOLD_FIRST_DELAY_MS = 400;
export const HOLD_MIN_DELAY_MS = 83;

/**
 * Espera até o próximo passo ao segurar o botão: `repeats` é quantos passos repetidos já houve. Começa com 400 ms e
 * acelera 20% a cada passo até o mínimo de 83 ms (cerca de 12 passos por segundo).
 */
export function holdRepeatDelay(repeats: number): number {
  if (repeats <= 0) return HOLD_FIRST_DELAY_MS;
  return Math.max(HOLD_MIN_DELAY_MS, Math.round(250 * 0.8 ** (repeats - 1)));
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
