/**
 * Leitura do payload de um JWT no aparelho, só para saber se ele já expirou
 * (a assinatura é conferida pela API, nunca aqui). Sem biblioteca: base64url → bytes → UTF-8.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function base64UrlToBytes(input: string): number[] | null {
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of input.replace(/=+$/, '')) {
    const value = ALPHABET.indexOf(ch);
    if (value < 0) return null;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return bytes;
}

function utf8Decode(bytes: number[]): string | null {
  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    let code: number;
    let extra: number;
    if (b < 0x80) [code, extra] = [b, 0];
    else if (b >= 0xc0 && b < 0xe0) [code, extra] = [b & 0x1f, 1];
    else if (b >= 0xe0 && b < 0xf0) [code, extra] = [b & 0x0f, 2];
    else if (b >= 0xf0 && b < 0xf8) [code, extra] = [b & 0x07, 3];
    else return null;
    for (let k = 1; k <= extra; k += 1) {
      const next = bytes[i + k];
      if (next === undefined || (next & 0xc0) !== 0x80) return null;
      code = (code << 6) | (next & 0x3f);
    }
    out += String.fromCodePoint(code);
    i += extra + 1;
  }
  return out;
}

/** Payload do JWT como objeto, ou null se o token não for um JWT legível. */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  const bytes = base64UrlToBytes(parts[1]);
  const json = bytes ? utf8Decode(bytes) : null;
  if (json === null) return null;
  try {
    const payload: unknown = JSON.parse(json);
    return payload !== null && typeof payload === 'object' && !Array.isArray(payload) ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Claim "exp" (segundos desde a época), ou null se ausente ou ilegível. */
export function getJwtExp(token: string): number | null {
  const exp = decodeJwtPayload(token)?.exp;
  return typeof exp === 'number' && Number.isFinite(exp) ? exp : null;
}

/** Token ilegível ou sem "exp" conta como inválido (expirado). Usa o relógio real, não o simulado do demo. */
export function isJwtExpired(token: string, nowMs: number = Date.now()): boolean {
  const exp = getJwtExp(token);
  return exp === null || exp * 1000 <= nowMs;
}
