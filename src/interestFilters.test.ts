import { describe, expect, it } from 'vitest';
import { compareInterestMetrics, defaultInterestFilter, matchesInterestFilter } from './interestFilters';

const metric = { title: 'iPhone 15 Pro 国行', wants: 80, views: 1000, ratio: 0.08, price: 69, score: 78, profit: 50, publishedAt: new Date('2026-07-20T12:00:00').getTime(), blueOcean: true, index: 1 };

describe('interest filters', () => {
  it('supports want and view ranges', () => {
    expect(matchesInterestFilter(metric, { ...defaultInterestFilter, minWants: 50, maxViews: 1200 })).toBe(true);
    expect(matchesInterestFilter(metric, { ...defaultInterestFilter, minWants: 100 })).toBe(false);
  });

  it('supports percentage ranges and sufficient samples', () => {
    expect(matchesInterestFilter(metric, { ...defaultInterestFilter, minRatio: 8 })).toBe(true);
    expect(matchesInterestFilter({ ...metric, views: 50 }, { ...defaultInterestFilter, sufficientOnly: true })).toBe(false);
  });

  it('supports price, opportunity score and blue-ocean filters', () => {
    expect(matchesInterestFilter(metric, { ...defaultInterestFilter, minPrice: 50, maxPrice: 100, minScore: 75, blueOceanOnly: true })).toBe(true);
    expect(matchesInterestFilter(metric, { ...defaultInterestFilter, minPrice: 100 })).toBe(false);
  });

  it('supports inclusive publication date ranges and excludes unknown dates', () => {
    expect(matchesInterestFilter(metric, { ...defaultInterestFilter, publishedAfter: '2026-07-01', publishedBefore: '2026-07-31' })).toBe(true);
    expect(matchesInterestFilter(metric, { ...defaultInterestFilter, publishedAfter: '2026-07-21' })).toBe(false);
    expect(matchesInterestFilter({ ...metric, publishedAt: undefined }, { ...defaultInterestFilter, publishedAfter: '2026-07-01' })).toBe(false);
  });

  it('supports case-insensitive include and exclude keyword rules', () => {
    expect(matchesInterestFilter(metric, { ...defaultInterestFilter, includeKeywords: 'PRO', excludeKeywords: 'max,维修' })).toBe(true);
    expect(matchesInterestFilter(metric, { ...defaultInterestFilter, excludeKeywords: '国行' })).toBe(false);
  });

  it('sorts by the selected metric', () => {
    const high = { ...metric, wants: 20, views: 100, ratio: 0.2, index: 2 };
    expect([metric, high].sort((a, b) => compareInterestMetrics(a, b, 'ratio-desc'))[0]).toBe(high);
  });
});
