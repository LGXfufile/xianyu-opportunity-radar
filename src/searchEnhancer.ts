import { calculateInterestMetric, formatPercent } from './interestRatio';
import { compareInterestMetrics, defaultInterestFilter, matchesInterestFilter, type FilterableMetric, type InterestFilter, type InterestSort } from './interestFilters';

type DetailData = { wants: number; views: number; fetchedAt: number };
type DetailResponse = { source: 'XY_RADAR'; type: 'DETAIL_RESPONSE'; requestId: string; ok: boolean; wants?: number; views?: number; error?: string };

const CACHE_PREFIX = 'interest:';
const CACHE_TTL = 24 * 60 * 60 * 1000;
const MAX_CONCURRENT = 2;
const FILTER_KEY = 'interest-filter-v1';
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
    .xy-filter-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.xy-filter-title{display:flex;align-items:center;gap:9px;font-weight:750}.xy-filter-count{color:#1e5b43;background:#e4f3ea;border-radius:999px;padding:3px 8px;font-size:11px}.xy-filter-actions{display:flex;gap:6px}.xy-filter button{border:1px solid #1c262117;background:#fff;border-radius:9px;padding:6px 9px;cursor:pointer;color:inherit}.xy-filter-body{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:10px;margin-top:12px}.xy-filter-field{display:grid;gap:4px;color:#68716c;font-size:11px}.xy-filter-field input,.xy-filter-field select{width:100%;border:1px solid #1c26211f;background:#fff;border-radius:9px;padding:8px;color:#17201c;font:12px inherit;outline:none}.xy-filter-field input:focus,.xy-filter-field select:focus{border-color:#2d7453;box-shadow:0 0 0 3px #2d74531c}.xy-filter-check{display:flex;align-items:center;gap:7px;color:#48514c;font-size:12px}.xy-filter-check input{accent-color:#1e5b43}.xy-filter-note{grid-column:1/-1;color:#7a817d;font-size:11px}.xy-filter[data-collapsed="true"] .xy-filter-body{display:none}@media(max-width:900px){.xy-filter-body{grid-template-columns:repeat(2,minmax(120px,1fr))}}@media(prefers-color-scheme:dark){.xy-filter{background:#1d2420f2;color:#f1f5f2;border-color:#ffffff17}.xy-filter button,.xy-filter-field input,.xy-filter-field select{background:#202723;color:#f1f5f2;border-color:#ffffff17}.xy-filter-count{background:#233f31;color:#81c5a2}}
  `;
  document.head.append(style);
}

export function startSearchEnhancer(signal: AbortSignal) {
  addStyles();
  let filter: InterestFilter = { ...defaultInterestFilter };
  let filterRoot: HTMLElement | null = null;
  let countNode: HTMLElement | null = null;

  const cardMetric = (card: HTMLAnchorElement): FilterableMetric | null => {
    const wants = Number(card.dataset.xyWants), views = Number(card.dataset.xyViews), ratio = Number(card.dataset.xyRatio), index = Number(card.dataset.xyIndex);
    return [wants, views, ratio, index].every(Number.isFinite) ? { wants, views, ratio, index } : null;
  };

  const applyFilter = () => {
    const cards = [...document.querySelectorAll<HTMLAnchorElement>('a[data-xy-enhanced="true"]')];
    let matched = 0;
    const ranked = cards.map(card => ({ card, metric: cardMetric(card) })).filter((item): item is { card: HTMLAnchorElement; metric: FilterableMetric } => !!item.metric);
    ranked.sort((a, b) => compareInterestMetrics(a.metric, b.metric, filter.sort)).forEach((item, order) => { item.card.style.order = String(order); });
    cards.forEach(card => {
      const metric = cardMetric(card); const visible = !metric || matchesInterestFilter(metric, filter);
      card.style.display = visible ? '' : 'none'; if (visible && metric) matched += 1;
    });
    if (countNode) countNode.textContent = ranked.length < cards.length ? `${matched}/${ranked.length} 命中 · ${ranked.length}/${cards.length} 已分析` : `${matched}/${ranked.length} 命中`;
  };

  const persistFilter = () => { void chrome.storage.local.set({ [FILTER_KEY]: filter }); applyFilter(); };

  const makeNumberField = (label: string, key: keyof Pick<InterestFilter, 'minWants' | 'maxWants' | 'minViews' | 'maxViews' | 'minRatio' | 'maxRatio'>, placeholder: string) => {
    const wrap = document.createElement('label'); wrap.className = 'xy-filter-field'; wrap.append(label);
    const input = document.createElement('input'); input.type = 'number'; input.min = '0'; input.placeholder = placeholder; input.value = filter[key]?.toString() || '';
    input.addEventListener('input', () => { const value = input.value === '' ? undefined : Math.max(0, Number(input.value)); filter = { ...filter, [key]: value }; persistFilter(); });
    wrap.append(input); return wrap;
  };

  const ensureToolbar = () => {
    if (filterRoot?.isConnected) return;
    const feed = document.querySelector<HTMLElement>('[class*="feeds-list-container"]'); if (!feed?.parentElement) return;
    const root = document.createElement('section'); root.className = 'xy-filter'; root.setAttribute('aria-label', '机会指标筛选');
    const head = document.createElement('div'); head.className = 'xy-filter-head';
    const title = document.createElement('div'); title.className = 'xy-filter-title'; title.append('机会筛选'); countNode = document.createElement('span'); countNode.className = 'xy-filter-count'; countNode.textContent = '数据加载中'; title.append(countNode);
    const actions = document.createElement('div'); actions.className = 'xy-filter-actions';
    const reset = document.createElement('button'); reset.type = 'button'; reset.textContent = '重置';
    const collapse = document.createElement('button'); collapse.type = 'button'; collapse.textContent = '收起'; collapse.setAttribute('aria-expanded', 'true');
    actions.append(reset, collapse); head.append(title, actions);
    const body = document.createElement('div'); body.className = 'xy-filter-body';
    body.append(makeNumberField('想要数 ≥', 'minWants', '不限'), makeNumberField('想要数 ≤', 'maxWants', '不限'), makeNumberField('浏览量 ≥', 'minViews', '建议 100'), makeNumberField('浏览量 ≤', 'maxViews', '不限'), makeNumberField('想要率 ≥ %', 'minRatio', '例如 8'), makeNumberField('想要率 ≤ %', 'maxRatio', '不限'));
    const sortWrap = document.createElement('label'); sortWrap.className = 'xy-filter-field'; sortWrap.append('排序');
    const select = document.createElement('select'); const sortOptions: Array<[InterestSort, string]> = [['default','默认顺序'],['ratio-desc','想要率从高到低'],['wants-desc','想要数从高到低'],['views-desc','浏览量从高到低']]; sortOptions.forEach(([value, text]) => { const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option); }); select.value = filter.sort;
    select.addEventListener('change', () => { filter = { ...filter, sort: select.value as InterestSort }; persistFilter(); }); sortWrap.append(select); body.append(sortWrap);
    const check = document.createElement('label'); check.className = 'xy-filter-check'; const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = filter.sufficientOnly; checkbox.addEventListener('change', () => { filter = { ...filter, sufficientOnly: checkbox.checked }; persistFilter(); }); check.append(checkbox, '只看浏览量 ≥ 100 的充分样本'); body.append(check);
    const note = document.createElement('div'); note.className = 'xy-filter-note'; note.textContent = '筛选即时生效并自动记住；未完成加载的商品暂时保留。'; body.append(note);
    reset.addEventListener('click', () => { filter = { ...defaultInterestFilter }; void chrome.storage.local.remove(FILTER_KEY); root.remove(); filterRoot = null; countNode = null; ensureToolbar(); applyFilter(); });
    collapse.addEventListener('click', () => { const collapsed = root.dataset.collapsed !== 'true'; root.dataset.collapsed = String(collapsed); collapse.textContent = collapsed ? '展开' : '收起'; collapse.setAttribute('aria-expanded', String(!collapsed)); });
    root.append(head, body); feed.parentElement.insertBefore(root, feed); filterRoot = root; applyFilter();
  };

  void chrome.storage.local.get(FILTER_KEY).then(result => { const saved = result[FILTER_KEY] as InterestFilter | undefined; if (saved) filter = { ...defaultInterestFilter, ...saved }; filterRoot?.remove(); filterRoot = null; ensureToolbar(); applyFilter(); });
  window.addEventListener('message', event => {
    const response = event.data as DetailResponse;
    if (event.source !== window || response?.source !== 'XY_RADAR' || response.type !== 'DETAIL_RESPONSE') return;
    const task = pending.get(response.requestId); if (!task) return;
    clearTimeout(task.timer); pending.delete(response.requestId);
    if (response.ok && Number.isFinite(response.wants) && Number.isFinite(response.views)) task.resolve({ wants: response.wants!, views: response.views!, fetchedAt: Date.now() });
    else task.reject(new Error(response.error || '热度数据获取失败'));
  }, { signal });

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
          applyFilter();
        }).catch(error => renderError(task.container, error, () => { void load(); }));
      };
      load().finally(() => { active -= 1; runQueue(); });
    }
  };

  const scan = () => [...document.querySelectorAll<HTMLAnchorElement>('a[href*="/item?"]')].forEach(card => {
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
  const mutation = new MutationObserver(() => { ensureToolbar(); scan(); }); mutation.observe(document.body, { childList: true, subtree: true }); ensureToolbar(); scan();
  signal.addEventListener('abort', () => mutation.disconnect());
}
