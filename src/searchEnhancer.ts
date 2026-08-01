import { calculateInterestMetric, formatPercent } from './interestRatio';

type DetailData = { wants: number; views: number; fetchedAt: number };
type DetailResponse = { source: 'XY_RADAR'; type: 'DETAIL_RESPONSE'; requestId: string; ok: boolean; wants?: number; views?: number; error?: string };

const CACHE_PREFIX = 'interest:';
const CACHE_TTL = 24 * 60 * 60 * 1000;
const MAX_ITEMS = 20;
const MAX_CONCURRENT = 2;
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
    .xy-interest{margin-top:9px;padding:8px 10px;border-radius:10px;background:#f3f5f3;color:#48514c;display:grid;gap:2px;font:12px/1.35 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}
    .xy-interest strong{font-size:13px;color:#1e5b43}.xy-interest span{opacity:.78}.xy-interest--loading{animation:xy-pulse 1.2s ease-in-out infinite}.xy-interest--high{background:#e4f3ea}.xy-interest--medium{background:#edf3e8}.xy-interest--low{background:#f4f2eb}.xy-interest--insufficient{background:#f2f3f3}.xy-interest--error{background:#f8e8e6;color:#8a3232;grid-template-columns:1fr auto;align-items:center}.xy-interest button{border:0;background:transparent;color:inherit;font-weight:700;cursor:pointer}@keyframes xy-pulse{50%{opacity:.55}}@media(prefers-color-scheme:dark){.xy-interest{background:#202723;color:#b8c1bc}.xy-interest strong{color:#81c5a2}.xy-interest--error{background:#3d2725;color:#f1aaa4}}
  `;
  document.head.append(style);
}

export function startSearchEnhancer(signal: AbortSignal) {
  addStyles();
  window.addEventListener('message', event => {
    const response = event.data as DetailResponse;
    if (event.source !== window || response?.source !== 'XY_RADAR' || response.type !== 'DETAIL_RESPONSE') return;
    const task = pending.get(response.requestId); if (!task) return;
    clearTimeout(task.timer); pending.delete(response.requestId);
    if (response.ok && Number.isFinite(response.wants) && Number.isFinite(response.views)) task.resolve({ wants: response.wants!, views: response.views!, fetchedAt: Date.now() });
    else task.reject(new Error(response.error || '热度数据获取失败'));
  }, { signal });

  const queue: Array<{ card: HTMLAnchorElement; container: HTMLElement; itemId: string }> = [];
  const seen = new Set<string>();
  let active = 0;

  const runQueue = () => {
    while (active < MAX_CONCURRENT && queue.length) {
      const task = queue.shift()!; active += 1;
      task.container.className = 'xy-interest xy-interest--loading'; task.container.textContent = '正在计算想要率…';
      const load = (): Promise<void> => {
        task.container.className = 'xy-interest xy-interest--loading'; task.container.textContent = '正在计算想要率…';
        return getDetail(task.itemId).then(data => renderMetric(task.container, data)).catch(error => renderError(task.container, error, () => { void load(); }));
      };
      load().finally(() => { active -= 1; runQueue(); });
    }
  };

  const scan = () => [...document.querySelectorAll<HTMLAnchorElement>('a[href*="/item?"]')].slice(0, MAX_ITEMS).forEach(card => {
    const itemId = new URL(card.href).searchParams.get('id');
    if (!itemId || seen.has(itemId)) return;
    seen.add(itemId);
    let container = card.querySelector<HTMLElement>('.xy-interest');
    if (!container) { container = document.createElement('div'); container.className = 'xy-interest'; card.append(container); }
    queue.push({ card, container, itemId }); runQueue();
  });
  const mutation = new MutationObserver(scan); mutation.observe(document.body, { childList: true, subtree: true }); scan();
  signal.addEventListener('abort', () => mutation.disconnect());
}
