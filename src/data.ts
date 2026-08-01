import type { Opportunity } from './types';

export const seedOpportunities: Opportunity[] = [
  {
    id: 'beauty-margin', title: '美甲店套餐定价与耗材毛利计算器', audience: '独立美甲师与小型门店',
    format: '飞书表格 / Excel', score: 84, demand: 86, competition: 72, profit: 91, delivery: 88, risk: 92,
    price: '¥29–69', confidence: '中',
    reason: ['用户任务明确：定价、耗材与提成需要同时计算', '通用报价表多，垂直经营工具相对少', '可标准化交付，单次可变成本低']
  },
  {
    id: 'rental-kit', title: '三人合租押金与公共采购分摊工作台', audience: '城市合租青年',
    format: 'Notion / 飞书多维表格', score: 78, demand: 81, competition: 76, profit: 80, delivery: 85, risk: 95,
    price: '¥19–39', confidence: '中',
    reason: ['比“记账模板”更具体，购买意图容易表达', '适合用演示数据展示价值', '可扩展搬家交接与退租结算版本']
  },
  {
    id: 'stall-profit', title: '夜市摆摊单品成本与盈亏平衡计算器', audience: '首次摆摊与小吃创业者',
    format: 'Excel计算器 + 使用指南', score: 75, demand: 79, competition: 68, profit: 83, delivery: 82, risk: 88,
    price: '¥19–49', confidence: '低',
    reason: ['热点与长期创业需求重合', '从“配方资料”升级为原创经营工具', '可以围绕不同摊位持续迭代'],
    warning: '需要进一步验证近期搜索与评论需求，当前证据不足。'
  }
];

export const directionPresets = ['美甲店经营', '合租生活', '夜市摆摊', 'AI工作流'];
