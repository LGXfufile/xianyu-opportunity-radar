import { describe, expect, it } from 'vitest';
import { buildOpportunities } from './data';

describe('buildOpportunities', () => {
  it('returns industrial opportunities for industrial searches', () => {
    const results = buildOpportunities('工业产品');
    expect(results).toHaveLength(3);
    expect(results.at(0)!.title).toContain('工业设计作品集');
    expect(results.some(item => item.title.includes('合租'))).toBe(false);
  });

  it('does not pretend an unknown direction is validated', () => {
    const results = buildOpportunities('火星露营服务');
    expect(results).toHaveLength(1);
    expect(results.at(0)!.confidence).toBe('低');
    expect(results.at(0)!.warning).toContain('待验证');
  });
});
