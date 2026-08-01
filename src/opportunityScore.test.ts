import { describe, expect, it } from 'vitest';
import { calculateMarketContext, calculateOpportunityScore } from './opportunityScore';

describe('calculateOpportunityScore', () => {
  it('requires both a strong score and all blue-ocean gates', () => {
    const result = calculateOpportunityScore({ wants: 80, views: 500, trustedRatio: .14, price: 69, unitCost: 8, fulfillmentCost: 3, reserveRate: 5, competitionScore: 82, accessibilityScore: 78 });
    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.verdict).toBe('blue-ocean');
    expect(result.netProfit).toBeCloseTo(54.55);
  });
  it('does not call a low-price, low-profit item blue ocean', () => {
    const result = calculateOpportunityScore({ wants: 80, views: 500, trustedRatio: .14, price: 5, unitCost: 1, fulfillmentCost: 0, reserveRate: 5, competitionScore: 90, accessibilityScore: 90 });
    expect(result.verdict).not.toBe('blue-ocean');
    expect(result.blockers).toContain('单件净利润低于¥10');
  });
  it('blocks tiny samples even when the ratio is high', () => {
    const result = calculateOpportunityScore({ wants: 8, views: 10, trustedRatio: .12, price: 99, unitCost: 5, fulfillmentCost: 2, reserveRate: 5, competitionScore: 90, accessibilityScore: 90 });
    expect(result.blockers).toContain('浏览样本不足100');
  });
});

describe('calculateMarketContext', () => {
  it('penalizes a market concentrated in the top listings', () => {
    const concentrated = calculateMarketContext([{ wants: 900, sellerId: 'a' }, ...Array.from({ length: 19 }, (_, index) => ({ wants: 5, sellerId: String(index) }))]);
    const distributed = calculateMarketContext(Array.from({ length: 20 }, (_, index) => ({ wants: 50, sellerId: String(index) })));
    expect(distributed.competitionScore).toBeGreaterThan(concentrated.competitionScore);
  });
});
