import { describe, expect, it } from 'vitest';
import { calculateProfit, scoreTone } from './scoring';

describe('calculateProfit', () => {
  it('includes labor and refund reserve', () => {
    const result = calculateProfit({ price: 49, variable: 4, hours: .15, hourlyRate: 50, refundRate: 5 });
    expect(result.net).toBeCloseTo(35.05);
    expect(result.refundReserve).toBeCloseTo(2.45);
  });
  it('supports zero price without dividing by zero', () => {
    expect(calculateProfit({ price: 0, variable: 0, hours: 0, hourlyRate: 0, refundRate: 0 }).margin).toBe(0);
  });
  it('rejects negative and impossible refund values', () => {
    expect(() => calculateProfit({ price: -1, variable: 0, hours: 0, hourlyRate: 0, refundRate: 0 })).toThrow();
    expect(() => calculateProfit({ price: 1, variable: 0, hours: 0, hourlyRate: 0, refundRate: 101 })).toThrow();
  });
});

describe('scoreTone', () => {
  it('handles score boundaries', () => {
    expect(scoreTone(80)).toBe('positive');
    expect(scoreTone(65)).toBe('caution');
    expect(scoreTone(64)).toBe('negative');
  });
});
