import { describe, expect, it } from '@jest/globals';
import { parsePastedCode } from '../src/lib/pairingCode';

describe('colar o código de pareamento', () => {
  it('aceita exatamente 6 números, ignorando espaços e hífens', () => {
    expect(parsePastedCode('482913')).toBe('482913');
    expect(parsePastedCode(' 482 913 ')).toBe('482913');
    expect(parsePastedCode('482-913')).toBe('482913');
    expect(parsePastedCode('48 29\n13')).toBe('482913');
  });

  it('recusa o que não é um código de 6 números', () => {
    for (const ruim of ['', '12345', '1234567', '48291a', 'código 482913', '482.913', null, undefined]) {
      expect(parsePastedCode(ruim)).toBeNull();
    }
  });
});
