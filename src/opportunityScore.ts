export type OpportunityInputs = {
  wants: number;
  views: number;
  trustedRatio: number;
  price: number;
  unitCost: number;
  fulfillmentCost: number;
  reserveRate: number;
  competitionScore?: number;
  accessibilityScore?: number;
};

export type OpportunityResult = {
  score: number;
  verdict: 'blue-ocean' | 'promising' | 'observe' | 'avoid';
  label: string;
  demand: number;
  competition: number;
  accessibility: number;
  gap: number;
  profit: number;
  netProfit: number;
  margin: number;
  blockers: string[];
};

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export function calculateOpportunityScore(input: OpportunityInputs): OpportunityResult {
  const reserve = input.price * clamp(input.reserveRate) / 100;
  const netProfit = input.price - input.unitCost - input.fulfillmentCost - reserve;
  const margin = input.price > 0 ? netProfit / input.price * 100 : 0;

  // 可信想要率承担主要需求信号，想要人数只用于确认绝对需求不是偶然样本。
  const ratioSignal = clamp(input.trustedRatio / 0.15 * 100);
  const volumeSignal = clamp(Math.log10(input.wants + 1) / Math.log10(101) * 100);
  const demand = Math.round(ratioSignal * 0.72 + volumeSignal * 0.28);
  const competition = Math.round(clamp(input.competitionScore ?? 50));
  const accessibility = Math.round(clamp(input.accessibilityScore ?? 50));
  const gap = Math.round(clamp(demand * 0.65 + competition * 0.35));
  const marginSignal = clamp((margin - 20) / 50 * 100);
  const netSignal = clamp(netProfit / 30 * 100);
  const profit = Math.round(marginSignal * 0.6 + netSignal * 0.4);

  const score = Math.round(demand * 0.25 + competition * 0.25 + accessibility * 0.25 + gap * 0.15 + profit * 0.1);
  const blockers: string[] = [];
  if (input.views < 100) blockers.push('浏览样本不足100');
  if (demand < 60) blockers.push('需求强度不足');
  if (competition < 55) blockers.push('竞争偏拥挤');
  if (accessibility < 55) blockers.push('新卖家进入性不足');
  if (margin < 30) blockers.push('预估利润率低于30%');
  if (netProfit < 10) blockers.push('单件净利润低于¥10');

  const blueOcean = score >= 75 && blockers.length === 0;
  const verdict = blueOcean ? 'blue-ocean' : score >= 65 && blockers.length <= 2 ? 'promising' : score >= 50 ? 'observe' : 'avoid';
  const label = blueOcean ? (score >= 82 ? '高置信蓝海候选' : '蓝海候选') : verdict === 'promising' ? '值得小单验证' : verdict === 'observe' ? '继续观察' : '暂不建议';
  return { score, verdict, label, demand, competition, accessibility, gap, profit, netProfit, margin, blockers };
}

export function calculateMarketContext(items: Array<{ wants: number; sellerId?: string }>) {
  if (!items.length) return { competitionScore: 50, uniqueSellerRatio: 0, top10Concentration: 1 };
  const uniqueSellerRatio = new Set(items.map(item => item.sellerId).filter(Boolean)).size / items.length;
  const sorted = [...items].sort((a, b) => b.wants - a.wants);
  const total = sorted.reduce((sum, item) => sum + item.wants, 0);
  const top10Concentration = total > 0 ? sorted.slice(0, 10).reduce((sum, item) => sum + item.wants, 0) / total : 1;
  const sellerSignal = uniqueSellerRatio ? uniqueSellerRatio * 100 : 50;
  const concentrationSignal = clamp((1 - top10Concentration) / 0.65 * 100);
  return {
    competitionScore: Math.round(sellerSignal * 0.45 + concentrationSignal * 0.55),
    uniqueSellerRatio,
    top10Concentration
  };
}
