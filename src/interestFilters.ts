export type InterestSort = 'default' | 'score-desc' | 'profit-desc' | 'ratio-desc' | 'wants-desc' | 'views-desc';
export type InterestFilter = {
  minWants?: number; maxWants?: number; minViews?: number; maxViews?: number;
  minRatio?: number; maxRatio?: number; minPrice?: number; maxPrice?: number; minScore?: number;
  publishedAfter?: string; publishedBefore?: string;
  publishedPreset?: 7 | 30 | 90;
  includeKeywords?: string; excludeKeywords?: string;
  sufficientOnly: boolean; blueOceanOnly: boolean; sort: InterestSort;
};
export type FilterableMetric = { title?: string; wants: number; views: number; ratio: number; price: number; score: number; profit: number; publishedAt?: number; blueOcean: boolean; index: number };

export const defaultInterestFilter: InterestFilter = { sufficientOnly: false, blueOceanOnly: false, sort: 'default' };

export function matchesInterestFilter(metric: FilterableMetric, filter: InterestFilter) {
  if (filter.minWants !== undefined && metric.wants < filter.minWants) return false;
  if (filter.maxWants !== undefined && metric.wants > filter.maxWants) return false;
  if (filter.minViews !== undefined && metric.views < filter.minViews) return false;
  if (filter.maxViews !== undefined && metric.views > filter.maxViews) return false;
  if (filter.minRatio !== undefined && metric.ratio * 100 < filter.minRatio) return false;
  if (filter.maxRatio !== undefined && metric.ratio * 100 > filter.maxRatio) return false;
  if (filter.minPrice !== undefined && metric.price < filter.minPrice) return false;
  if (filter.maxPrice !== undefined && metric.price > filter.maxPrice) return false;
  if (filter.minScore !== undefined && metric.score < filter.minScore) return false;
  if (filter.publishedAfter) {
    const after = new Date(`${filter.publishedAfter}T00:00:00`).getTime();
    if (!metric.publishedAt || metric.publishedAt < after) return false;
  }
  if (filter.publishedBefore) {
    const before = new Date(`${filter.publishedBefore}T23:59:59.999`).getTime();
    if (!metric.publishedAt || metric.publishedAt > before) return false;
  }
  const title = (metric.title || '').toLocaleLowerCase();
  const splitKeywords = (value?: string) => (value || '').split(/[,，\n]/).map(item => item.trim().toLocaleLowerCase()).filter(Boolean);
  const includes = splitKeywords(filter.includeKeywords);
  const excludes = splitKeywords(filter.excludeKeywords);
  if (includes.length && !includes.some(keyword => title.includes(keyword))) return false;
  if (excludes.some(keyword => title.includes(keyword))) return false;
  if (filter.blueOceanOnly && !metric.blueOcean) return false;
  return !filter.sufficientOnly || metric.views >= 100;
}

export function compareInterestMetrics(a: FilterableMetric, b: FilterableMetric, sort: InterestSort) {
  if (sort === 'score-desc') return b.score - a.score;
  if (sort === 'profit-desc') return b.profit - a.profit;
  if (sort === 'ratio-desc') return b.ratio - a.ratio;
  if (sort === 'wants-desc') return b.wants - a.wants;
  if (sort === 'views-desc') return b.views - a.views;
  return a.index - b.index;
}
