import { calculateInterestMetric, formatPercent } from './interestRatio';
import { compareInterestMetrics, defaultInterestFilter, matchesInterestFilter, type FilterableMetric, type InterestFilter, type InterestSort } from './interestFilters';
import { calculateMarketContext, calculateOpportunityScore } from './opportunityScore';
import type { MonitorMessage, MonitorResponse, MonitorSummary, MonitoredProduct, MonitoringEvent, MonitoringTask, MonitoringTaskSummary, ProductSnapshot } from './monitoringTypes';

type DetailData = { wants: number; views: number; fetchedAt: number; createdAt?: number | string; sellerId?: string; sellerSold?: number; sellerItems?: number };
type DetailResponse = { source: 'XY_RADAR'; type: 'DETAIL_RESPONSE'; requestId: string; ok: boolean; wants?: number; views?: number; createdAt?: number | string; sellerId?: string | number; sellerSold?: number; sellerItems?: number; error?: string };
type ProfitConfig = { unitCost: number; fulfillmentCost: number; reserveRate: number };

const CACHE_PREFIX = 'interest:v2:';
const CACHE_TTL = 24 * 60 * 60 * 1000;
const MAX_CONCURRENT = 2;
const FILTER_KEY = 'interest-filter-v1';
const FILTER_ENABLED_KEY = 'interest-filter-enabled-v1';
const PROFIT_KEY = 'opportunity-profit-v1';
const defaultProfit: ProfitConfig = { unitCost: 5, fulfillmentCost: 2, reserveRate: 5 };
const pending = new Map<string, { resolve: (value: DetailData) => void; reject: (error: Error) => void; timer: number }>();

function requestDetail(itemId: string): Promise<DetailData> {
  return new Promise((resolve, reject) => {
    const requestId = `${itemId}-${crypto.randomUUID()}`;
    const timer = window.setTimeout(() => { pending.delete(requestId); reject(new Error('数据请求超时')); }, 16000);
    pending.set(requestId, { resolve, reject, timer });
    window.postMessage({ source: 'XY_RADAR', type: 'DETAIL_REQUEST', requestId, itemId }, '*');
  });
}

async function readCache(itemId: string) {
  const result = await chrome.storage.local.get(`${CACHE_PREFIX}${itemId}`);
  const cached = result[`${CACHE_PREFIX}${itemId}`] as DetailData | undefined;
  return cached && Date.now() - cached.fetchedAt < CACHE_TTL ? cached : null;
}

async function getDetail(itemId: string) {
  const cached = await readCache(itemId);
  if (cached) return { ...cached, cached: true };
  const fresh = await requestDetail(itemId);
  await chrome.storage.local.set({ [`${CACHE_PREFIX}${itemId}`]: fresh });
  return { ...fresh, cached: false };
}

function renderMetric(container: HTMLElement, data: DetailData & { cached: boolean }) {
  const metric = calculateInterestMetric(data.wants, data.views);
  container.className = `xy-interest xy-interest--${metric.level}`;
  container.innerHTML = '';
  const main = document.createElement('strong');
  main.textContent = `想要率 ${formatPercent(metric.rawRatio)}`;
  const detail = document.createElement('span');
  detail.textContent = `${metric.wants} 想要 ÷ ${metric.views} 浏览 · ${metric.label}${data.cached ? ' · 缓存' : ''}`;
  container.append(main, detail);
  container.title = `可信想要率 ${formatPercent(metric.trustedRatio)}；浏览不足100时不判定高潜。`;
}

function parsePrice(card: HTMLElement) {
  const text = card.querySelector<HTMLElement>('[class*="price-wrap"]')?.innerText.replace(/[^\d.]/g, '') || '';
  const value = Number(text);
  return Number.isFinite(value) ? value : 0;
}

async function sendMonitor<T>(message: MonitorMessage) {
  const response = await chrome.runtime.sendMessage(message) as MonitorResponse<T>;
  if (!response?.ok) throw new Error(response?.error || '监控操作失败');
  return response.data;
}

const splitKeywords = (value: string[] | string | undefined) => {
  const raw = Array.isArray(value) ? value : (value || '').split(/[,，\n]/);
  return raw.map(item => item.trim().toLocaleLowerCase()).filter(Boolean);
};

function matchesTask(metric: { title?: string; wants: number; views: number; ratio: number; price: number; score: number; profit: number; publishedAt?: number; blueOcean: boolean; index: number; competition?: number } | null, task: MonitoringTask) {
  if (!metric) return false;
  const keywords = splitKeywords(task.keywords);
  if (keywords.length && !keywords.some(word => metric.title?.toLocaleLowerCase().includes(word))) return false;
  const ratioPercent = metric.ratio * 100;
  const profitMargin = metric.price > 0 ? metric.profit / metric.price * 100 : 0;
  const now = Date.now();
  if (metric.score < task.minScore) return false;
  if (ratioPercent < task.minRatio) return false;
  if (metric.price < task.minPrice || metric.price > task.maxPrice) return false;
  if (profitMargin < task.minProfitMargin) return false;
  if ((metric.competition ?? 50) > task.maxCompetition) return false;
  if (task.publishedWindowDays && metric.publishedAt && now - metric.publishedAt > task.publishedWindowDays * 86400000) return false;
  return true;
}

function cardMetricFromData(card: HTMLAnchorElement) {
  const wants = Number(card.dataset.xyWants), views = Number(card.dataset.xyViews), ratio = Number(card.dataset.xyRatio), index = Number(card.dataset.xyIndex);
  const price = Number(card.dataset.xyPrice), score = Number(card.dataset.xyScore), profit = Number(card.dataset.xyProfit), publishedAt = card.dataset.xyPublished ? Number(card.dataset.xyPublished) : undefined;
  const title = card.querySelector<HTMLElement>('[class*="main-title"]')?.innerText.replace(/\s+/g, ' ').trim();
  return [wants, views, ratio, price, score, profit, index].every(Number.isFinite)
    ? { title, wants, views, ratio, price, score, profit, publishedAt, blueOcean: card.dataset.xyBlue === 'true', index, competition: Number(card.dataset.xyCompetition || 0) }
    : null;
}

function renderError(container: HTMLElement, error: unknown, onRetry: () => void) {
  container.className = 'xy-interest xy-interest--error';
  container.innerHTML = '';
  const text = document.createElement('span');
  text.textContent = error instanceof Error ? error.message : '暂时无法获取想要率';
  const retry = document.createElement('button');
  retry.type = 'button'; retry.textContent = '重试';
  retry.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); onRetry(); }, { once: true });
  container.append(text, retry);
}

function addStyles() {
  if (document.querySelector('#xy-interest-styles')) return;
  const style = document.createElement('style');
  style.id = 'xy-interest-styles';
  style.textContent = `
    .xy-interest{margin-top:7px;padding:6px 8px;border:1px solid #1e5b4324;border-radius:8px;background:#f3f5f3;color:#48514c;display:flex;flex-wrap:wrap;align-items:center;gap:3px 6px;min-height:30px;font:11px/1.25 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;position:relative;z-index:2}
    .xy-interest strong{font-size:12px;color:#1e5b43;white-space:nowrap}.xy-interest span{opacity:.82}.xy-interest--loading{animation:xy-pulse 1.2s ease-in-out infinite}.xy-interest--high{background:#dff2e6;border-color:#2d74534a}.xy-interest--medium{background:#edf3e8}.xy-interest--low{background:#f4f2eb}.xy-interest--insufficient{background:#f2f3f3}.xy-interest--error{background:#f8e8e6;color:#8a3232;justify-content:space-between}.xy-interest button{border:0;background:transparent;color:inherit;font-weight:700;cursor:pointer}@keyframes xy-pulse{50%{opacity:.55}}@media(prefers-color-scheme:dark){.xy-interest{background:#202723;color:#b8c1bc}.xy-interest strong{color:#81c5a2}.xy-interest--error{background:#3d2725;color:#f1aaa4}}
    .xy-filter{grid-column:1/-1;margin:0 0 18px;padding:14px 16px;border:1px solid #1c262117;border-radius:16px;background:#fffffff2;box-shadow:0 8px 28px #16231c12;font:13px/1.4 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;color:#17201c}
    .xy-filter-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.xy-filter-title{display:flex;align-items:center;gap:9px;font-weight:750}.xy-filter-count{color:#1e5b43;background:#e4f3ea;border-radius:999px;padding:3px 8px;font-size:11px}.xy-filter-actions{display:flex;gap:6px}.xy-filter button{border:1px solid #1c262117;background:#fff;border-radius:9px;padding:6px 9px;cursor:pointer;color:inherit}.xy-filter .xy-filter-search{background:#17201c;color:#fff;border-color:#17201c;padding-inline:14px;font-weight:750;box-shadow:0 4px 12px #17201c24}.xy-filter .xy-filter-search:hover{background:#27332d}.xy-filter .xy-filter-search:active{transform:scale(.97)}.xy-filter-body{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:10px;margin-top:12px}.xy-filter-field{display:grid;gap:4px;color:#68716c;font-size:11px}.xy-filter-field input,.xy-filter-field select{width:100%;border:1px solid #1c26211f;background:#fff;border-radius:9px;padding:8px;color:#17201c;font:12px inherit;outline:none}.xy-filter-field input:focus,.xy-filter-field select:focus{border-color:#2d7453;box-shadow:0 0 0 3px #2d74531c}.xy-filter-check{display:flex;align-items:center;gap:7px;color:#48514c;font-size:12px}.xy-filter-check input{accent-color:#1e5b43}.xy-filter-note{grid-column:1/-1;color:#7a817d;font-size:11px}.xy-filter[data-collapsed="true"] .xy-filter-body{display:none}@media(max-width:900px){.xy-filter-body{grid-template-columns:repeat(2,minmax(120px,1fr))}}@media(prefers-color-scheme:dark){.xy-filter{background:#1d2420f2;color:#f1f5f2;border-color:#ffffff17}.xy-filter button,.xy-filter-field input,.xy-filter-field select{background:#202723;color:#f1f5f2;border-color:#ffffff17}.xy-filter .xy-filter-search{background:#e9f1ec;color:#152019;border-color:#e9f1ec}.xy-filter-count{background:#233f31;color:#81c5a2}}
    .xy-opportunity{width:100%;display:grid;grid-template-columns:1fr auto;align-items:center;gap:4px 6px;padding-top:5px;margin-top:2px;border-top:1px solid #1e5b4320}.xy-opportunity b{font-size:12px}.xy-opportunity small{grid-column:1/2;opacity:.76}.xy-opportunity--blue b{color:#087a45}.xy-opportunity--avoid b{color:#8a4b32}.xy-monitor-button{grid-column:2;grid-row:1/3;border:1px solid #1e5b4330!important;background:#fff!important;color:#1e5b43!important;border-radius:7px!important;padding:5px 7px!important;font-size:10px!important}.xy-monitor-button[data-active="true"]{background:#1e5b43!important;color:#fff!important}.xy-monitor-button:disabled{opacity:.6;cursor:wait}.xy-profit-title{grid-column:1/-1;padding-top:3px;font-size:12px;font-weight:750}.xy-filter-body{grid-template-columns:repeat(5,minmax(110px,1fr))}.xy-market-insight{grid-column:1/-1;padding:9px 11px;border-radius:10px;background:#eef5f0;color:#315342;font-size:12px}.xy-filter-export{white-space:nowrap}@media(prefers-color-scheme:dark){.xy-opportunity--blue b{color:#7ee2ae}.xy-market-insight{background:#23332a;color:#a8d6bd}.xy-monitor-button{background:#26312b!important}}
    .xy-filter-toggle{display:flex;align-items:center;gap:7px;padding:5px 9px;border-radius:999px;background:#f1f3f1;color:#68716c;font-size:12px;cursor:pointer;white-space:nowrap}.xy-filter-toggle input{width:16px;height:16px;accent-color:#1e5b43}.xy-filter[data-filter-enabled="false"] .xy-filter-body{opacity:.48;pointer-events:none;filter:saturate(.6)}.xy-filter[data-filter-enabled="false"] .xy-filter-search{opacity:.5;cursor:not-allowed}.xy-filter[data-filter-enabled="true"] .xy-filter-toggle{background:#e2f2e8;color:#1e5b43;font-weight:700}
    .xy-active-filter{display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:999px;background:#eef1ef;color:#59635e;font-size:11px;font-weight:650}.xy-filter[data-filter-enabled="true"] .xy-active-filter{background:#173e2d;color:#fff}.xy-active-filter::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.72}
  `;
  document.head.append(style);
}

export function startSearchEnhancer(signal: AbortSignal) {
  addStyles();
  let filter: InterestFilter = { ...defaultInterestFilter };
  let filterEnabled = false;
  let profitConfig: ProfitConfig = { ...defaultProfit };
  let filterRoot: HTMLElement | null = null;
  let countNode: HTMLElement | null = null;
  let activeFilterNode: HTMLElement | null = null;
  let insightNode: HTMLElement | null = null;
  let taskSummaryNode: HTMLElement | null = null;
  const loaded = new Map<HTMLAnchorElement, DetailData & { cached: boolean }>();
  const monitoredIds = new Set<string>();
  const emittedSignals = new Map<string, string>();

  const cardMetric = (card: HTMLAnchorElement): FilterableMetric | null => {
    const wants = Number(card.dataset.xyWants), views = Number(card.dataset.xyViews), ratio = Number(card.dataset.xyRatio), index = Number(card.dataset.xyIndex);
    const price = Number(card.dataset.xyPrice), score = Number(card.dataset.xyScore), profit = Number(card.dataset.xyProfit), publishedAt = card.dataset.xyPublished ? Number(card.dataset.xyPublished) : undefined;
    const title = card.querySelector<HTMLElement>('[class*="main-title"]')?.innerText.replace(/\s+/g, ' ').trim();
    return [wants, views, ratio, price, score, profit, index].every(Number.isFinite) ? { title, wants, views, ratio, price, score, profit, publishedAt, blueOcean: card.dataset.xyBlue === 'true', index } : null;
  };

  const applyFilter = () => {
    const cards = [...document.querySelectorAll<HTMLAnchorElement>('a[data-xy-enhanced="true"]')];
    let matched = 0;
    const ranked = cards.map(card => ({ card, metric: cardMetric(card) })).filter((item): item is { card: HTMLAnchorElement; metric: FilterableMetric } => !!item.metric);
    ranked.sort((a, b) => compareInterestMetrics(a.metric, b.metric, filterEnabled ? filter.sort : 'default')).forEach((item, order) => { item.card.style.order = String(order); });
    cards.forEach(card => {
      const metric = cardMetric(card); const visible = !filterEnabled || !metric || matchesInterestFilter(metric, filter);
      card.style.display = visible ? '' : 'none'; if (visible && metric) matched += 1;
    });
    if (countNode) countNode.textContent = filterEnabled
      ? (ranked.length < cards.length ? `${matched}/${ranked.length} 命中 · ${ranked.length}/${cards.length} 已分析` : `${matched}/${ranked.length} 命中`)
      : `${ranked.length}/${cards.length} 已分析 · 筛选未开启`;
    if (activeFilterNode) {
      const presetLabels: Record<number, string> = { 7: '近 7 天', 30: '近 1 个月', 90: '近 3 个月' };
      const range = filter.publishedPreset ? presetLabels[filter.publishedPreset]
        : filter.publishedAfter || filter.publishedBefore ? `${filter.publishedAfter || '不限'} 至 ${filter.publishedBefore || '今天'}` : '全部时间';
      activeFilterNode.textContent = filterEnabled ? `发布时间生效中：${range}` : `发布时间已设置：${range} · 开启后生效`;
    }
  };

  const persistFilter = () => { void chrome.storage.local.set({ [FILTER_KEY]: filter }); recomputeOpportunities(); };

  const recomputeOpportunities = () => {
    const words = (value?: string) => (value || '').split(/[,，\n]/).map(item => item.trim().toLocaleLowerCase()).filter(Boolean);
    const included = filterEnabled ? words(filter.includeKeywords) : [], excluded = filterEnabled ? words(filter.excludeKeywords) : [];
    const contextItems = [...loaded.entries()].filter(([card]) => {
      const title = card.querySelector<HTMLElement>('[class*="main-title"]')?.innerText.toLocaleLowerCase() || '';
      return (!included.length || included.some(word => title.includes(word))) && !excluded.some(word => title.includes(word));
    }).map(([, data]) => ({ wants: data.wants, sellerId: data.sellerId }));
    const context = calculateMarketContext(contextItems);
    loaded.forEach((data, card) => {
      const container = card.querySelector<HTMLElement>('.xy-interest');
      if (!container) return;
      const metric = calculateInterestMetric(data.wants, data.views);
      const price = parsePrice(card);
      const rawCreated = typeof data.createdAt === 'string' && /^\d+$/.test(data.createdAt) ? Number(data.createdAt) : data.createdAt;
      const created = typeof rawCreated === 'number' && rawCreated < 1e12 ? rawCreated * 1000 : rawCreated ? new Date(rawCreated).getTime() : NaN;
      const ageDays = Number.isFinite(created) ? Math.max(0, (Date.now() - created) / 86400000) : undefined;
      const newListingSignal = ageDays === undefined ? 50 : ageDays <= 30 ? 78 : ageDays <= 90 ? 62 : 38;
      const smallSellerSignal = data.sellerSold === undefined ? 50 : data.sellerSold <= 50 ? 76 : data.sellerSold <= 300 ? 58 : 32;
      const listingLoadSignal = data.sellerItems === undefined ? 50 : data.sellerItems <= 30 ? 72 : data.sellerItems <= 100 ? 55 : 35;
      const accessibilityScore = newListingSignal * .45 + smallSellerSignal * .35 + listingLoadSignal * .2;
      const result = calculateOpportunityScore({ ...data, trustedRatio: metric.trustedRatio, price, ...profitConfig, competitionScore: context.competitionScore, accessibilityScore });
      const itemId = new URL(card.href).searchParams.get('id') || '';
      card.dataset.xyPrice = String(price); card.dataset.xyScore = String(result.score); card.dataset.xyProfit = String(result.netProfit); card.dataset.xyBlue = String(result.verdict === 'blue-ocean'); card.dataset.xyCompetition = String(result.competition); card.dataset.xyProfitMargin = String(result.margin);
      if (Number.isFinite(created)) card.dataset.xyPublished = String(created); else delete card.dataset.xyPublished;
      container.querySelector('.xy-opportunity')?.remove();
      const row = document.createElement('div'); row.className = `xy-opportunity xy-opportunity--${result.verdict === 'blue-ocean' ? 'blue' : result.verdict}`;
      const score = document.createElement('b'); score.textContent = `机会得分 ${result.score} · ${result.label}`;
      const profit = document.createElement('small');
      const publishedLabel = Number.isFinite(created) ? new Date(created).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) : '时间未知';
      profit.textContent = `¥${price.toFixed(0)}｜净利 ¥${result.netProfit.toFixed(0)}｜${result.margin.toFixed(0)}%｜${publishedLabel}`;
      const monitor = document.createElement('button'); monitor.type = 'button'; monitor.className = 'xy-monitor-button'; monitor.dataset.active = String(monitoredIds.has(itemId)); monitor.textContent = monitoredIds.has(itemId) ? '监控中' : '＋ 监控'; monitor.setAttribute('aria-label', `${monitoredIds.has(itemId) ? '取消监控' : '监控'}${card.querySelector<HTMLElement>('[class*="main-title"]')?.innerText || '商品'}`);
      const snapshot: ProductSnapshot = { itemId, capturedAt: Date.now(), price, wants: data.wants, views: data.views, ratio: metric.rawRatio, score: result.score, netProfit: result.netProfit };
      const product: MonitoredProduct = { itemId, title: card.querySelector<HTMLElement>('[class*="main-title"]')?.innerText.replace(/\s+/g, ' ').trim() || `商品 ${itemId}`, url: card.href, imageUrl: card.querySelector<HTMLImageElement>('[class*="feeds-image"]')?.src, addedAt: Date.now(), updatedAt: Date.now() };
      monitor.addEventListener('click', event => {
        event.preventDefault(); event.stopPropagation(); monitor.disabled = true;
        const action = monitoredIds.has(itemId) ? sendMonitor<void>({ type: 'MONITOR_REMOVE', itemId }) : sendMonitor<void>({ type: 'MONITOR_UPSERT', product, snapshot });
        void action.then(() => { if (monitoredIds.has(itemId)) monitoredIds.delete(itemId); else monitoredIds.add(itemId); recomputeOpportunities(); }).catch(error => { monitor.textContent = error instanceof Error ? '操作失败' : '重试'; }).finally(() => { monitor.disabled = false; });
      });
      row.append(score, profit, monitor); container.append(row);
      if (monitoredIds.has(itemId)) {
        const signature = `${price}:${data.wants}:${data.views}:${result.score}`;
        if (card.dataset.xyMonitorSnapshot !== signature) { card.dataset.xyMonitorSnapshot = signature; void sendMonitor<boolean>({ type: 'MONITOR_SNAPSHOT', snapshot }).catch(() => { delete card.dataset.xyMonitorSnapshot; }); }
      }
      container.title = `需求 ${result.demand}｜竞争友好 ${result.competition}｜新卖家进入 ${result.accessibility}｜供需缺口 ${result.gap}｜利润 ${result.profit}${result.blockers.length ? `；未达蓝海：${result.blockers.join('、')}` : '；达到蓝海候选硬门槛。建议小单验证，不能保证7–15天成交。'}`;
    });
    const allMetrics = [...loaded.keys()].map(cardMetric).filter((item): item is FilterableMetric => !!item);
    const metrics = filterEnabled ? allMetrics.filter(metric => matchesInterestFilter(metric, filter)) : allMetrics;
    if (insightNode && metrics.length) {
      const sortedPrice = metrics.map(item => item.price).sort((a, b) => a - b);
      const medianPrice = sortedPrice[Math.floor(sortedPrice.length / 2)] ?? 0;
      const fresh = metrics.filter(item => item.publishedAt && Date.now() - item.publishedAt <= 30 * 86400000).length;
      const blue = metrics.filter(item => item.blueOcean).length;
      insightNode.textContent = `市场快照：中位价 ¥${medianPrice.toFixed(0)} · 近30天新品 ${fresh}/${metrics.length} · 头部想要集中度 ${(context.top10Concentration * 100).toFixed(0)}% · 蓝海候选 ${blue}`;
    } else if (insightNode) insightNode.textContent = '当前条件没有匹配商品，请放宽时间、价格或关键词范围。';
    if (taskSummaryNode) {
      const totalMonitored = monitoredIds.size;
      const blueCount = [...loaded.keys()].filter(card => card.dataset.xyBlue === 'true').length;
      taskSummaryNode.textContent = `任务扫描已就绪 · 当前监控 ${totalMonitored} 个商品 · 蓝海候选 ${blueCount} 个`;
    }
    applyFilter();
  };

  const runTaskScan = async (reason: 'manual' | 'tick' = 'manual') => {
    const tasks = await sendMonitor<MonitoringTaskSummary[]>({ type: 'TASK_LIST' }).catch(() => [] as MonitoringTaskSummary[]);
    const cards = [...document.querySelectorAll<HTMLAnchorElement>('a[data-xy-enhanced="true"]')];
    const byItemId = new Map(cards.map(card => [new URL(card.href).searchParams.get('id') || '', card] as const));
    const events: Array<{ taskId: string; itemId: string; signature: string; title: string; score: number; wants: number; views: number; ratio: number; price: number; profit: number; url: string; summary: string; kind: 'new-match' | 'score-up' | 'score-down' | 'blue-ocean'; createdAt: number }> = [];
    const updates: MonitoringTask[] = [];
    for (const task of tasks) {
      const nextRunAt = Date.now() + task.intervalMinutes * 60000;
      const activeTask: MonitoringTask = { ...task, lastRunAt: Date.now(), nextRunAt, updatedAt: Date.now() };
      const matched = cards.map(card => ({ card, metric: cardMetric(card) })).filter((entry): entry is { card: HTMLAnchorElement; metric: FilterableMetric } => !!entry.metric && matchesTask(entry.metric, task));
      activeTask.lastMatchCount = matched.length;
      activeTask.lastSignal = matched.length ? `命中 ${matched.length} 个机会` : '暂无命中';
      updates.push(activeTask);
      const taskLabels = matched.slice(0, 3).map(entry => entry.metric.title || '未命名商品');
      for (const entry of matched.slice(0, 8)) {
        const itemId = new URL(entry.card.href).searchParams.get('id') || '';
        const signature = `${task.id}:${itemId}:${entry.metric.score}:${entry.metric.wants}:${entry.metric.views}:${entry.metric.price}`;
        if (emittedSignals.get(`${task.id}:${itemId}`) === signature) continue;
        emittedSignals.set(`${task.id}:${itemId}`, signature);
        events.push({
          taskId: task.id,
          itemId,
          signature,
          title: entry.metric.title || '未命名商品',
          score: entry.metric.score,
          wants: entry.metric.wants,
          views: entry.metric.views,
          ratio: entry.metric.ratio,
          price: entry.metric.price,
          profit: entry.metric.profit,
          url: entry.card.href,
          summary: `${reason === 'tick' ? '定时扫描' : '手动扫描'}命中：${task.name} · ${taskLabels.join('、') || '无标题'}`,
          kind: entry.metric.blueOcean ? 'blue-ocean' : entry.metric.score >= task.minScore + 10 ? 'score-up' : 'new-match',
          createdAt: Date.now()
        });
      }
    }
    if (updates.length) {
      await Promise.allSettled(updates.map(task => sendMonitor<void>({ type: 'TASK_UPSERT', task })));
      if (events.length) await sendMonitor<void>({ type: 'TASK_EVENT_APPEND', events: events.map(({ signature: _signature, ...event }) => event) as MonitoringEvent[] }).catch(() => undefined);
    }
    if (taskSummaryNode) taskSummaryNode.textContent = `已${reason === 'tick' ? '定时' : '手动'}扫描 ${tasks.length} 个任务，发现 ${events.length} 个新机会信号`;
  };

  const makeNumberField = (label: string, key: keyof Pick<InterestFilter, 'minWants' | 'maxWants' | 'minViews' | 'maxViews' | 'minRatio' | 'maxRatio' | 'minPrice' | 'maxPrice' | 'minScore'>, placeholder: string) => {
    const wrap = document.createElement('label'); wrap.className = 'xy-filter-field'; wrap.append(label);
    const input = document.createElement('input'); input.type = 'number'; input.min = '0'; input.placeholder = placeholder; input.value = filter[key]?.toString() || '';
    input.addEventListener('input', () => { const value = input.value === '' ? undefined : Math.max(0, Number(input.value)); filter = { ...filter, [key]: value }; persistFilter(); });
    input.addEventListener('keydown', event => { if (event.key === 'Enter') filterRoot?.querySelector<HTMLButtonElement>('.xy-filter-search')?.click(); });
    wrap.append(input); return wrap;
  };

  const makeProfitField = (label: string, key: keyof ProfitConfig, placeholder: string) => {
    const wrap = document.createElement('label'); wrap.className = 'xy-filter-field'; wrap.append(label);
    const input = document.createElement('input'); input.type = 'number'; input.min = '0'; input.placeholder = placeholder; input.value = String(profitConfig[key]);
    input.addEventListener('input', () => { const value = Math.max(0, Number(input.value) || 0); profitConfig = { ...profitConfig, [key]: value }; void chrome.storage.local.set({ [PROFIT_KEY]: profitConfig }); recomputeOpportunities(); });
    wrap.append(input); return wrap;
  };

  const makeDateField = (label: string, key: 'publishedAfter' | 'publishedBefore') => {
    const wrap = document.createElement('label'); wrap.className = 'xy-filter-field'; wrap.append(label);
    const input = document.createElement('input'); input.type = 'date'; input.value = filter[key] || '';
    input.addEventListener('change', () => { filter = { ...filter, [key]: input.value || undefined, publishedPreset: undefined }; persistFilter(); filterRoot?.remove(); filterRoot = null; insightNode = null; activeFilterNode = null; ensureToolbar(); recomputeOpportunities(); });
    wrap.append(input); return wrap;
  };

  const makeKeywordField = (label: string, key: 'includeKeywords' | 'excludeKeywords', placeholder: string) => {
    const wrap = document.createElement('label'); wrap.className = 'xy-filter-field'; wrap.append(label);
    const input = document.createElement('input'); input.type = 'text'; input.placeholder = placeholder; input.value = filter[key] || '';
    input.addEventListener('input', () => { filter = { ...filter, [key]: input.value || undefined }; void chrome.storage.local.set({ [FILTER_KEY]: filter }); });
    input.addEventListener('keydown', event => { if (event.key === 'Enter') { recomputeOpportunities(); filterRoot?.querySelector<HTMLButtonElement>('.xy-filter-search')?.click(); } });
    wrap.append(input); return wrap;
  };

  const exportAnalysis = () => {
    const rows = [...document.querySelectorAll<HTMLAnchorElement>('a[data-xy-enhanced="true"]')].map(card => {
      const metric = cardMetric(card); if (!metric) return null;
      const title = card.querySelector<HTMLElement>('[class*="main-title"]')?.innerText.replace(/\s+/g, ' ').trim() || '';
      return [title, metric.price, metric.wants, metric.views, (metric.ratio * 100).toFixed(2), metric.score, metric.profit.toFixed(2), metric.blueOcean ? '是' : '否', metric.publishedAt ? new Date(metric.publishedAt).toLocaleDateString('zh-CN') : '未知', card.href];
    }).filter(Boolean) as Array<Array<string | number>>;
    const csv = [['商品', '售价', '想要数', '浏览量', '想要率%', '机会得分', '预估净利润', '蓝海候选', '发布时间', '链接'], ...rows]
      .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })); link.download = `闲鱼机会分析-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(link.href);
  };

  const ensureToolbar = () => {
    if (filterRoot?.isConnected) return;
    const feed = document.querySelector<HTMLElement>('[class*="feeds-list-container"]'); if (!feed?.parentElement) return;
    const root = document.createElement('section'); root.className = 'xy-filter'; root.setAttribute('aria-label', '机会指标筛选'); root.dataset.filterEnabled = String(filterEnabled);
    const head = document.createElement('div'); head.className = 'xy-filter-head';
    const title = document.createElement('div'); title.className = 'xy-filter-title'; title.append('机会筛选'); countNode = document.createElement('span'); countNode.className = 'xy-filter-count'; countNode.textContent = '数据加载中'; activeFilterNode = document.createElement('span'); activeFilterNode.className = 'xy-active-filter'; activeFilterNode.setAttribute('aria-live', 'polite'); title.append(countNode, activeFilterNode);
    const actions = document.createElement('div'); actions.className = 'xy-filter-actions';
    const toggle = document.createElement('label'); toggle.className = 'xy-filter-toggle';
    const toggleInput = document.createElement('input'); toggleInput.type = 'checkbox'; toggleInput.checked = filterEnabled; toggleInput.setAttribute('aria-label', '启用插件条件筛选');
    const toggleText = document.createElement('span'); toggleText.textContent = filterEnabled ? '筛选已开启' : '启用筛选'; toggle.append(toggleInput, toggleText);
    const search = document.createElement('button'); search.type = 'button'; search.className = 'xy-filter-search'; search.textContent = '搜索'; search.setAttribute('aria-label', '按当前条件搜索商品');
    search.disabled = !filterEnabled;
    const exportButton = document.createElement('button'); exportButton.type = 'button'; exportButton.className = 'xy-filter-export'; exportButton.textContent = '导出分析'; exportButton.setAttribute('aria-label', '导出当前商品机会分析CSV');
    const reset = document.createElement('button'); reset.type = 'button'; reset.textContent = '重置';
    const collapse = document.createElement('button'); collapse.type = 'button'; collapse.textContent = '收起'; collapse.setAttribute('aria-expanded', 'true');
    actions.append(toggle, search, exportButton, reset, collapse); head.append(title, actions);
    const body = document.createElement('div'); body.className = 'xy-filter-body';
    body.append(
      makeNumberField('售价 ≥ ¥', 'minPrice', '例如 20'), makeNumberField('售价 ≤ ¥', 'maxPrice', '不限'), makeNumberField('机会得分 ≥', 'minScore', '蓝海 75'),
      makeDateField('发布时间从', 'publishedAfter'), makeDateField('发布时间到', 'publishedBefore'),
      makeKeywordField('标题必须包含', 'includeKeywords', '多个词用逗号'), makeKeywordField('标题排除词', 'excludeKeywords', '如 求购,维修'),
      makeNumberField('想要数 ≥', 'minWants', '不限'), makeNumberField('想要数 ≤', 'maxWants', '不限'), makeNumberField('浏览量 ≥', 'minViews', '建议 100'), makeNumberField('浏览量 ≤', 'maxViews', '不限'),
      makeNumberField('想要率 ≥ %', 'minRatio', '例如 8'), makeNumberField('想要率 ≤ %', 'maxRatio', '不限')
    );
    const quickWrap = document.createElement('label'); quickWrap.className = 'xy-filter-field'; quickWrap.append('发布时间快捷范围');
    const quick = document.createElement('select'); const quickOptions: Array<[string, string]> = [['','全部时间'],['7','近 7 天'],['30','近 1 个月'],['90','近 3 个月']]; quickOptions.forEach(([value, label]) => { const option = document.createElement('option'); option.value = value; option.textContent = label; quick.append(option); }); quick.value = filter.publishedPreset ? String(filter.publishedPreset) : '';
    quick.addEventListener('change', () => { const preset = quick.value ? Number(quick.value) as 7 | 30 | 90 : undefined; filter = { ...filter, publishedPreset: preset, publishedAfter: preset ? new Date(Date.now() - preset * 86400000).toISOString().slice(0, 10) : undefined, publishedBefore: undefined }; persistFilter(); root.remove(); filterRoot = null; insightNode = null; activeFilterNode = null; ensureToolbar(); recomputeOpportunities(); }); quickWrap.append(quick); body.append(quickWrap);
    const sortWrap = document.createElement('label'); sortWrap.className = 'xy-filter-field'; sortWrap.append('排序');
    const select = document.createElement('select'); const sortOptions: Array<[InterestSort, string]> = [['default','默认顺序'],['score-desc','机会得分从高到低'],['profit-desc','单件净利润从高到低'],['ratio-desc','想要率从高到低'],['wants-desc','想要数从高到低'],['views-desc','浏览量从高到低']]; sortOptions.forEach(([value, text]) => { const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option); }); select.value = filter.sort;
    select.addEventListener('change', () => { filter = { ...filter, sort: select.value as InterestSort }; persistFilter(); }); sortWrap.append(select); body.append(sortWrap);
    const check = document.createElement('label'); check.className = 'xy-filter-check'; const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = filter.sufficientOnly; checkbox.addEventListener('change', () => { filter = { ...filter, sufficientOnly: checkbox.checked }; persistFilter(); }); check.append(checkbox, '只看浏览量 ≥ 100 的充分样本'); body.append(check);
    const blueCheck = document.createElement('label'); blueCheck.className = 'xy-filter-check'; const blueBox = document.createElement('input'); blueBox.type = 'checkbox'; blueBox.checked = filter.blueOceanOnly; blueBox.addEventListener('change', () => { filter = { ...filter, blueOceanOnly: blueBox.checked }; persistFilter(); }); blueCheck.append(blueBox, '只看蓝海候选（≥75且通过硬门槛）'); body.append(blueCheck);
    const profitTitle = document.createElement('div'); profitTitle.className = 'xy-profit-title'; profitTitle.textContent = '利润假设 · 修改后立即重算'; body.append(profitTitle, makeProfitField('单件成本 ¥', 'unitCost', '5'), makeProfitField('履约成本 ¥', 'fulfillmentCost', '2'), makeProfitField('退款/平台预留 %', 'reserveRate', '5'));
    insightNode = document.createElement('div'); insightNode.className = 'xy-market-insight'; insightNode.textContent = '正在生成市场快照…'; body.append(insightNode);
  const note = document.createElement('div'); note.className = 'xy-filter-note'; note.textContent = '机会得分：需求25% + 竞争25% + 新卖家进入性25% + 供需缺口15% + 利润10%。达到75分且样本、需求、竞争、进入性、净利均过线，才标记蓝海候选；时间未知的商品在启用发布时间筛选后会被排除。'; body.append(note);
    taskSummaryNode = document.createElement('div'); taskSummaryNode.className = 'xy-market-insight'; taskSummaryNode.textContent = '任务扫描：等待定时器触发或手动点击“立即扫描”'; body.append(taskSummaryNode);
    const taskAction = document.createElement('button'); taskAction.type = 'button'; taskAction.className = 'xy-filter-search'; taskAction.textContent = '立即扫描任务';
    taskAction.setAttribute('aria-label', '立即扫描当前监控任务');
    taskAction.addEventListener('click', () => { void runTaskScan('manual'); });
    actions.append(taskAction);
    toggleInput.addEventListener('change', () => {
      filterEnabled = toggleInput.checked; root.dataset.filterEnabled = String(filterEnabled); search.disabled = !filterEnabled;
      toggleText.textContent = filterEnabled ? '筛选已开启' : '启用筛选'; void chrome.storage.local.set({ [FILTER_ENABLED_KEY]: filterEnabled }); recomputeOpportunities();
    });
    search.addEventListener('click', () => { if (!filterEnabled) return; void chrome.storage.local.set({ [FILTER_KEY]: filter }); recomputeOpportunities(); search.textContent = '已搜索'; window.setTimeout(() => { if (search.isConnected) search.textContent = '搜索'; }, 900); });
    exportButton.addEventListener('click', exportAnalysis);
    reset.addEventListener('click', () => { filter = { ...defaultInterestFilter }; filterEnabled = false; profitConfig = { ...defaultProfit }; void chrome.storage.local.remove([FILTER_KEY, FILTER_ENABLED_KEY, PROFIT_KEY]); root.remove(); filterRoot = null; countNode = null; insightNode = null; activeFilterNode = null; ensureToolbar(); recomputeOpportunities(); });
    collapse.addEventListener('click', () => { const collapsed = root.dataset.collapsed !== 'true'; root.dataset.collapsed = String(collapsed); collapse.textContent = collapsed ? '展开' : '收起'; collapse.setAttribute('aria-expanded', String(!collapsed)); });
    root.append(head, body); feed.parentElement.insertBefore(root, feed); filterRoot = root; applyFilter();
  };

  window.addEventListener('message', event => {
    const response = event.data as DetailResponse;
    if (event.source !== window || response?.source !== 'XY_RADAR' || response.type !== 'DETAIL_RESPONSE') return;
    const task = pending.get(response.requestId); if (!task) return;
    clearTimeout(task.timer); pending.delete(response.requestId);
    if (response.ok && Number.isFinite(response.wants) && Number.isFinite(response.views)) task.resolve({
      wants: response.wants!, views: response.views!, fetchedAt: Date.now(), createdAt: response.createdAt,
      sellerId: response.sellerId === undefined ? undefined : String(response.sellerId), sellerSold: response.sellerSold, sellerItems: response.sellerItems
    });
    else task.reject(new Error(response.error || '热度数据获取失败'));
  }, { signal });

  chrome.runtime.onMessage.addListener((message: { type?: string }) => {
    if (message?.type === 'TASK_TICK') void runTaskScan('tick');
  });

  const queue: Array<{ card: HTMLAnchorElement; container: HTMLElement; itemId: string }> = [];
  const seen = new WeakSet<HTMLAnchorElement>();
  let nextIndex = 0;
  let active = 0;

  const runQueue = () => {
    while (active < MAX_CONCURRENT && queue.length) {
      const task = queue.shift()!; active += 1;
      task.container.className = 'xy-interest xy-interest--loading'; task.container.textContent = '正在计算想要率…';
      const load = (): Promise<void> => {
        task.container.className = 'xy-interest xy-interest--loading'; task.container.textContent = '正在计算想要率…';
        return getDetail(task.itemId).then(data => {
          renderMetric(task.container, data);
          const metric = calculateInterestMetric(data.wants, data.views);
          task.card.dataset.xyWants = String(data.wants); task.card.dataset.xyViews = String(data.views); task.card.dataset.xyRatio = String(metric.rawRatio);
          loaded.set(task.card, data); recomputeOpportunities();
        }).catch(error => renderError(task.container, error, () => { void load(); }));
      };
      load().finally(() => { active -= 1; runQueue(); });
    }
  };

  const scan = () => {
    [...document.querySelectorAll<HTMLAnchorElement>('a[href*="/item?"]')].forEach(card => {
    const itemId = new URL(card.href).searchParams.get('id');
    if (!itemId || seen.has(card)) return;
    seen.add(card);
    card.dataset.xyEnhanced = 'true'; card.dataset.xyIndex = String(nextIndex++);
    let container = card.querySelector<HTMLElement>('.xy-interest');
    if (!container) {
      container = document.createElement('div'); container.className = 'xy-interest';
      card.style.height = 'auto';
      card.style.minHeight = '480px';
      (card.querySelector<HTMLElement>('[class*="feeds-content"]') || card).append(container);
    }
      queue.push({ card, container, itemId }); runQueue();
    });
  };
  void chrome.storage.local.get([FILTER_KEY, FILTER_ENABLED_KEY, PROFIT_KEY]).then(result => {
    const saved = result[FILTER_KEY] as InterestFilter | undefined; const savedProfit = result[PROFIT_KEY] as ProfitConfig | undefined;
    if (saved) filter = { ...defaultInterestFilter, ...saved }; filterEnabled = result[FILTER_ENABLED_KEY] === true;
    if (savedProfit) profitConfig = { ...defaultProfit, ...savedProfit };
    filterRoot?.remove(); filterRoot = null; insightNode = null; activeFilterNode = null; ensureToolbar(); recomputeOpportunities();
  });
  void sendMonitor<MonitorSummary[]>({ type: 'MONITOR_LIST' }).then(items => { items.forEach(item => monitoredIds.add(item.itemId)); recomputeOpportunities(); }).catch(() => undefined);
  const mutation = new MutationObserver(() => { ensureToolbar(); scan(); }); mutation.observe(document.body, { childList: true, subtree: true }); ensureToolbar(); scan();
  signal.addEventListener('abort', () => mutation.disconnect());
}
