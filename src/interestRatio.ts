export type InterestLevel = 'high' | 'medium' | 'low' | 'insufficient';

export type InterestMetric = {
  wants: number;
  views: number;
  rawRatio: number;
  trustedRatio: number;
  level: InterestLevel;
  label: string;
};

export function calculateInterestMetric(wants: number, views: number): InterestMetric {
  if (!Number.isFinite(wants) || !Number.isFinite(views) || wants < 0 || views <= 0) {
    throw new Error('想要数和浏览数必须是有效的非负数');
  }
  const rawRatio = Math.min(wants / views, 1);
  const trustedRatio = Math.min((wants + 5) / (views + 100), 1);
  const level: InterestLevel = views < 100 ? 'insufficient' : trustedRatio >= 0.15 ? 'high' : trustedRatio >= 0.08 ? 'medium' : 'low';
  const label = level === 'high' ? '高关注' : level === 'medium' ? '值得验证' : level === 'low' ? '兴趣偏弱' : '样本不足';
  return { wants, views, rawRatio, trustedRatio, level, label };
}

export function formatPercent(value: number) {
  return `${(value * 100).toFixed(value >= 0.1 ? 1 : 2)}%`;
}

