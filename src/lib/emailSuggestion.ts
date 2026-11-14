/**
 * "Você quis dizer ana@gmail.com?": sugestão para os erros de digitação mais comuns no domínio do e-mail (gmial.com,
 * hotmail.con, gmail). Puro e testável. Não bloqueia nada: só oferece a correção; quem confere se o domínio existe é o
 * servidor, e quem prova que o e-mail é da pessoa é o código de confirmação.
 */

/** Domínios mais usados no Brasil, os que valem a sugestão. */
export const COMMON_EMAIL_DOMAINS = [
  'gmail.com',
  'hotmail.com',
  'outlook.com',
  'yahoo.com',
  'yahoo.com.br',
  'icloud.com',
  'live.com',
  'msn.com',
  'hotmail.com.br',
  'outlook.com.br',
  'bol.com.br',
  'uol.com.br',
  'terra.com.br',
  'ig.com.br',
  'globo.com',
  'globomail.com',
] as const;

/** Distância de edição (inserção, remoção, troca e transposição de duas letras vizinhas). */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j += 1) d[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/**
 * E-mail corrigido, ou null se não há o que sugerir (domínio já conhecido, formato que ainda não tem domínio, ou nada
 * parecido o bastante). Só sugere um domínio a até 2 edições de um conhecido (e a 1 edição nos curtos, até 8 letras),
 * e o nome sem domínio ("ana@gmail").
 */
export function suggestEmail(email: string): string | null {
  const value = email.trim().toLowerCase();
  const at = value.lastIndexOf('@');
  if (at <= 0 || at === value.length - 1 || value.indexOf('@') !== at) return null;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if ((COMMON_EMAIL_DOMAINS as readonly string[]).includes(domain)) return null;

  // "ana@gmail" ou "ana@hotmail": o provedor sem o final
  const withoutTld = COMMON_EMAIL_DOMAINS.find((d) => d.split('.')[0] === domain);
  if (withoutTld) return `${local}@${withoutTld}`;

  let best: { domain: string; distance: number } | null = null;
  for (const known of COMMON_EMAIL_DOMAINS) {
    const distance = editDistance(domain, known);
    const limit = known.length <= 8 ? 1 : 2;
    if (distance <= limit && (!best || distance < best.distance)) best = { domain: known, distance };
  }
  return best ? `${local}@${best.domain}` : null;
}
