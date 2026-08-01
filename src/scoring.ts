export type ProfitInput = { price: number; variable: number; hours: number; hourlyRate: number; refundRate: number };

export function calculateProfit(input: ProfitInput) {
  const values = Object.values(input);
  if (values.some(value => !Number.isFinite(value) || value < 0)) throw new Error('请输入有效的非负数字');
  if (input.refundRate > 100) throw new Error('退款率不能超过100%');
  const labor = input.hours * input.hourlyRate;
  const refundReserve = input.price * input.refundRate / 100;
  const net = input.price - input.variable - labor - refundReserve;
  const margin = input.price === 0 ? 0 : net / input.price * 100;
  return { net, margin, labor, refundReserve };
}

export function scoreTone(score: number) {
  if (score >= 80) return 'positive';
  if (score >= 65) return 'caution';
  return 'negative';
}
