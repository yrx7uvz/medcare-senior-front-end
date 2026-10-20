import { describe, expect, it } from '@jest/globals';
import { applyMask } from '../src/lib/masks';

describe('máscaras de digitação', () => {
  it('data DD/MM/AAAA, com no máximo 8 dígitos', () => {
    expect(applyMask('date', '1')).toBe('1');
    expect(applyMask('date', '123')).toBe('12/3');
    expect(applyMask('date', '12031945')).toBe('12/03/1945');
    expect(applyMask('date', '12/03/19459999')).toBe('12/03/1945');
  });

  it('hora HH:MM', () => {
    expect(applyMask('time', '8')).toBe('8');
    expect(applyMask('time', '0830')).toBe('08:30');
    expect(applyMask('time', '08:3099')).toBe('08:30');
  });

  it('telefone fixo e celular com DDD', () => {
    expect(applyMask('phone', '')).toBe('');
    expect(applyMask('phone', '1')).toBe('(1');
    expect(applyMask('phone', '1199')).toBe('(11) 99');
    expect(applyMask('phone', '1133334444')).toBe('(11) 3333-4444');
    expect(applyMask('phone', '11999998888')).toBe('(11) 99999-8888');
    expect(applyMask('phone', '(11) 99999-88889')).toBe('(11) 99999-8888');
  });

  it('só dígitos', () => {
    expect(applyMask('digits', 'a1b2 3')).toBe('123');
  });
});
