import { describe, expect, it } from 'vitest';
import { monitorDelta } from './monitoringClient';

describe('monitorDelta', () => {
  it('calculates changes between the latest two snapshots', () => {
    const base = { itemId: '1', title: '商品', url: 'https://example.com', addedAt: 1, updatedAt: 2, snapshotCount: 2 };
    const latest = { itemId: '1', capturedAt: 2, price: 48, wants: 12, views: 120, ratio: .1, score: 76, netProfit: 30 };
    const previous = { ...latest, capturedAt: 1, price: 50, wants: 9, views: 100, score: 72 };
    expect(monitorDelta({ ...base, latest, previous })).toEqual({ wants: 3, views: 20, price: -2, score: 4 });
  });
});
