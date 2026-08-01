import { describe, expect, it } from 'vitest';
import { compareInterestMetrics, defaultInterestFilter, matchesInterestFilter } from './interestFilters';

const metric = { wants: 80, views: 1000, ratio: 0.08, index: 1 };

describe('interest filters', () => {
  it('supports want and view ranges', () => {
    expect(matchesInterestFilter(metric, { ...defaultInterestFilter, minWants: 50, maxViews: 1200 })).toBe(true);
    expect(matchesInterestFilter(metric, { ...defaultInterestFilter, minWants: 100 })).toBe(false);
  });

  it('supports percentage ranges and sufficient samples', () => {
    expect(matchesInterestFilter(metric, { ...defaultInterestFilter, minRatio: 8 })).toBe(true);
    expect(matchesInterestFilter({ ...metric, views: 50 }, { ...defaultInterestFilter, sufficientOnly: true })).toBe(false);
  });

  it('sorts by the selected metric', () => {
    const high = { wants: 20, views: 100, ratio: 0.2, index: 2 };
    expect([metric, high].sort((a, b) => compareInterestMetrics(a, b, 'ratio-desc'))[0]).toBe(high);
  });
});

