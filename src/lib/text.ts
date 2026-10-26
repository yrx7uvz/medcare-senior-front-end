/** Tira as repetições de `caractere` do fim, sem expressão regular (sem custo de retrocesso em entradas longas). */
export function semFinal(texto: string, caractere: string): string {
  let fim = texto.length;
  while (fim > 0 && texto[fim - 1] === caractere) fim -= 1;
  return texto.slice(0, fim);
}
