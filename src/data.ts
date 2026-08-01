import type { Opportunity } from './types';

const industrialOpportunities: Opportunity[] = [
  {
    id: 'industrial-portfolio-audit', title: '工业设计作品集诊断与修改优先级报告', audience: '工业设计考研、求职与留学申请者',
    format: 'PDF诊断报告 + 30分钟复盘', score: 82, demand: 86, competition: 70, profit: 84, delivery: 76, risk: 91,
    price: '¥79–199', confidence: '中',
    reason: ['真实搜索中同类作品集出现127、173人想要等需求信号', '低价素材包拥挤，原创诊断与辅导更容易形成差异', '可用固定检查表交付，边际成本低且不需要囤货'],
    warning: '只做原创诊断与辅导，不代写、代做作品集。'
  },
  {
    id: 'industrial-portfolio-system', title: '工业设计作品集原创排版系统包', audience: '已有项目但不会组织作品集的学生与新人',
    format: 'Figma / PSD组件 + 使用指南', score: 78, demand: 83, competition: 66, profit: 88, delivery: 90, risk: 82,
    price: '¥39–99', confidence: '中',
    reason: ['买家需求集中在排版、项目叙事和设计过程展示', '比出售他人作品集更合规，也更容易建立个人品牌', '一次制作可重复交付，并可向诊断服务升级'],
    warning: '模板、字体和示例素材必须原创或获得商业授权。'
  },
  {
    id: 'vsm-workbook', title: '制造业VSM价值流现场采集与改善工作簿', audience: '制造业IE、精益生产与工厂改善人员',
    format: 'Excel工具 + 示例案例 + 填写说明', score: 72, demand: 70, competition: 74, profit: 78, delivery: 89, risk: 90,
    price: '¥29–89', confidence: '低',
    reason: ['闲鱼存在VSM模板、精益管理资料的持续供给', '多数竞品是资料合集，现场采集和自动计算仍有区分空间', '可按注塑、装配、仓储等场景继续细分'],
    warning: '当前“想要人数”证据较弱，应先用3个访谈或预售验证。'
  }
];

const scenarioLibraries: Array<{ match: RegExp; items: Opportunity[] }> = [
  { match: /工业|产品设计|作品集|制造|工厂|精益|vsm/i, items: industrialOpportunities },
  { match: /美甲|美业|美容/, items: [{ id: 'beauty-margin', title: '美甲店套餐定价与耗材毛利计算器', audience: '独立美甲师与小型门店', format: '飞书表格 / Excel', score: 84, demand: 86, competition: 72, profit: 91, delivery: 88, risk: 92, price: '¥29–69', confidence: '中', reason: ['定价、耗材与提成需要同时计算', '通用报价表多，垂直经营工具相对少', '可标准化交付，单次可变成本低'] }] },
  { match: /合租|租房|室友/, items: [{ id: 'rental-kit', title: '三人合租押金与公共采购分摊工作台', audience: '城市合租青年', format: 'Notion / 飞书多维表格', score: 78, demand: 81, competition: 76, profit: 80, delivery: 85, risk: 95, price: '¥19–39', confidence: '中', reason: ['比记账模板更具体', '适合用演示数据展示价值', '可扩展退租结算版本'] }] },
  { match: /摆摊|夜市|小吃/, items: [{ id: 'stall-profit', title: '夜市摆摊单品成本与盈亏平衡计算器', audience: '首次摆摊与小吃创业者', format: 'Excel计算器 + 使用指南', score: 75, demand: 79, competition: 68, profit: 83, delivery: 82, risk: 88, price: '¥19–49', confidence: '低', reason: ['热点与长期创业需求重合', '从配方资料升级为原创经营工具', '可以围绕不同摊位持续迭代'], warning: '需要进一步验证近期需求。' }] }
];

export function buildOpportunities(query: string): Opportunity[] {
  const library = scenarioLibraries.find(group => group.match.test(query));
  if (library) return library.items.map(item => ({ ...item, id: `${item.id}-${query}` }));
  return [{
    id: `unverified-${query}`, title: `${query}：需求访谈与预售验证清单`, audience: `正在寻找“${query}”解决方案的人群`,
    format: '验证清单 + 访谈记录表', score: 56, demand: 50, competition: 50, profit: 60, delivery: 85, risk: 90,
    price: '先验证，暂不定价', confidence: '低',
    reason: ['当前样本库没有匹配到可靠的细分机会', '先收集搜索结果、想要人数和用户原话', '获得至少3个有效需求信号后再投入制作'],
    warning: '这是待验证方向，不应被展示为已确认的赚钱机会。'
  }];
}

export const directionPresets = ['工业产品', '美甲店经营', '合租生活', '夜市摆摊'];
export const initialOpportunities = buildOpportunities('工业产品');
