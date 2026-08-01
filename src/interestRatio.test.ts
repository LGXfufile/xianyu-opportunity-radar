import { describe, expect, it } from 'vitest';
import { calculateInterestMetric, formatPercent } from './interestRatio';

describe('interest ratio', () => {
  it('calculates the raw ratio requested by the user', () => {
    expect(calculateInterestMetric(1, 10).rawRatio).toBe(0.1);
    expect(calculateInterestMetric(8, 10).rawRatio).toBe(0.8);
  });

  it('marks small samples as insufficient', () => {
    expect(calculateInterestMetric(8, 10).level).toBe('insufficient');
  });

  it('classifies a sufficiently sampled result', () => {
    const metric = calculateInterestMetric(259, 2559);
    expect(metric.level).toBe('medium');
    expect(formatPercent(metric.rawRatio)).toBe('10.1%');
  });

  it('rejects missing view samples', () => {
    expect(() => calculateInterestMetric(1, 0)).toThrow();
  });
});

