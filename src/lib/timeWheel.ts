/**
 * Regras puras do seletor de horário em rolagem (TimeWheelPicker): passos com volta (23 -> 00), posição da rolagem
 * até o item e o valor falado pelo leitor de tela.
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
