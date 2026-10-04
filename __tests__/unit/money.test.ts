import { describe, it, expect } from 'vitest';
import { toPaise, fromPaise, roundHalfUp } from '@/lib/money';

describe('money', () => {
  it('converts rupees to integer paise without float drift', () => {
    expect(toPaise(0.1 + 0.2)).toBe(30);
    expect(toPaise(1234.56)).toBe(123456);
    expect(toPaise(1.005)).toBe(101);
    expect(toPaise(-1.005)).toBe(-101);
    expect(toPaise(-0.001)).toBe(0);
  });
  it('round-trips and rejects unsafe values', () => {
    expect(fromPaise(123456)).toBe(1234.56);
    expect(() => toPaise(Number.NaN)).toThrow('INVALID_MONEY');
    expect(() => fromPaise(1.5)).toThrow('INVALID_PAISE');
  });
  it('rounds half up', () => {
    expect(roundHalfUp(5, 2)).toBe(3);
    expect(roundHalfUp(4, 3)).toBe(1);
  });
});
