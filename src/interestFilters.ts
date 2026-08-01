export type InterestSort = 'default' | 'ratio-desc' | 'wants-desc' | 'views-desc';
export type InterestFilter = {
  minWants?: number; maxWants?: number; minViews?: number; maxViews?: number;
  minRatio?: number; maxRatio?: number; sufficientOnly: boolean; sort: InterestSort;
};
export type FilterableMetric = { wants: number; views: number; ratio: number; index: number };

export const defaultInterestFilter: InterestFilter = { sufficientOnly: false, sort: 'default' };

export function matchesInterestFilter(metric: FilterableMetric, filter: InterestFilter) {
  if (filter.minWants !== undefined && metric.wants < filter.minWants) return false;
  if (filter.maxWants !== undefined && metric.wants > filter.maxWants) return false;
  if (filter.minViews !== undefined && metric.views < filter.minViews) return false;
  if (filter.maxViews !== undefined && metric.views > filter.maxViews) return false;
  if (filter.minRatio !== undefined && metric.ratio * 100 < filter.minRatio) return false;
  if (filter.maxRatio !== undefined && metric.ratio * 100 > filter.maxRatio) return false;
  return !filter.sufficientOnly || metric.views >= 100;
}

export function compareInterestMetrics(a: FilterableMetric, b: FilterableMetric, sort: InterestSort) {
  if (sort === 'ratio-desc') return b.ratio - a.ratio;
  if (sort === 'wants-desc') return b.wants - a.wants;
  if (sort === 'views-desc') return b.views - a.views;
  return a.index - b.index;
}

