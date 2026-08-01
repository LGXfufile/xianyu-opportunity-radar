import { BarChart3, Bookmark, Check, ChevronRight, Compass, Database, RotateCcw, Search, Settings2, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { directionPresets, seedOpportunities } from './data';
import { FeedbackBar, LoadingState, OpportunityCard, ScoreRing } from './components';
import { calculateProfit } from './scoring';
import { clearWatchlist, loadWatchlist, removeWatchItem, saveWatchItem } from './storage';
import type { Feedback, Opportunity, WatchItem } from './types';

type Tab = 'discover' | 'opportunities' | 'watchlist' | 'settings';

export function RadarApp() {
  const [tab, setTab] = useState<Tab>('discover');
  const [query, setQuery] = useState('美甲店经营');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Opportunity[]>(seedOpportunities);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [watchlist, setWatchlist] = useState<WatchItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [price, setPrice] = useState(49);
  const [cost, setCost] = useState(4);
  const [hours, setHours] = useState(0.15);
  const [hourlyRate, setHourlyRate] = useState(50);
  const [refundRate, setRefundRate] = useState(5);
  const [checks, setChecks] = useState([true, true, true, false]);

  useEffect(() => { loadWatchlist().then(setWatchlist).catch(error => setFeedback({ kind: 'error', message: error.message })); }, []);

  const profit = useMemo(() => {
    try { return calculateProfit({ price, variable: cost, hours, hourlyRate, refundRate }); }
    catch { return null; }
  }, [price, cost, hours, hourlyRate, refundRate]);

  const analyze = async () => {
    const clean = query.trim();
    if (!clean) { setFeedback({ kind: 'warning', message: '先输入一个用户、场景或产品方向。' }); return; }
    if (clean.length > 40) { setFeedback({ kind: 'warning', message: '方向请控制在40个字以内，越具体越容易验证。' }); return; }
    setLoading(true); setFeedback(null);
    try {
      await new Promise((resolve, reject) => setTimeout(() => clean === '模拟异常' ? reject(new Error('分析服务暂时不可用，已保留你的输入。')) : resolve(null), 700));
      const adjusted = seedOpportunities.map((item, index) => ({ ...item, id: `${item.id}-${clean}`, audience: index === 0 ? clean : item.audience }));
      setResults(adjusted); setTab('opportunities');
      setFeedback({ kind: 'success', message: `已为“${clean}”找到 ${adjusted.length} 个值得验证的候选。` });
    } catch (error) {
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : '分析失败，请重试。' });
    } finally { setLoading(false); }
  };

  const save = async (item: Opportunity) => {
    setBusyId(item.id);
    try {
      const next = await saveWatchItem({ id: item.id, title: item.title, score: item.score, savedAt: Date.now() });
      setWatchlist(next); setFeedback({ kind: 'success', message: '已收藏，后续访问时会显示变化。' });
    } catch (error) { setFeedback({ kind: 'error', message: error instanceof Error ? error.message : '收藏失败' }); }
    finally { setBusyId(null); }
  };

  const remove = async (id: string) => {
    try { setWatchlist(await removeWatchItem(id)); setFeedback({ kind: 'info', message: '已移出观察列表。' }); }
    catch (error) { setFeedback({ kind: 'error', message: error instanceof Error ? error.message : '删除失败' }); }
  };

  return <div className="app-shell">
    <header className="app-header"><div><span className="eyebrow">闲鱼机会雷达</span><h1>{tab === 'discover' ? '发现' : tab === 'opportunities' ? '机会' : tab === 'watchlist' ? '观察' : '设置'}</h1></div><span className="dev-badge">DEV · MOCK</span></header>
    {feedback && <FeedbackBar feedback={feedback} onClose={() => setFeedback(null)} />}

    <main className="app-content">
      {tab === 'discover' && <>
        <section className="hero-card">
          <div className="hero-copy"><span className="eyebrow">从一个具体场景开始</span><h2>寻找竞争更少、利润更清楚的产品。</h2><p>输入用户、职业或场景。我们会把需求证据、竞争、交付与合规放在同一张判断卡里。</p></div>
          <div className="search-box"><Search size={18} /><input value={query} maxLength={40} onChange={event => setQuery(event.target.value)} onKeyDown={event => event.key === 'Enter' && analyze()} aria-label="产品机会方向" placeholder="例如：美甲店经营" /><button onClick={analyze} disabled={loading}>{loading ? '分析中' : '发现机会'}</button></div>
          <div className="preset-row">{directionPresets.map(item => <button key={item} onClick={() => setQuery(item)}>{item}</button>)}</div>
        </section>
        {loading ? <LoadingState /> : <section className="market-summary"><div><span className="eyebrow">示例市场摘要</span><h2>需求正在发生，竞争仍可区分。</h2><p>基于24个有效样本。当前为Mock数据，正式版将显示来源与抓取时间。</p></div><ScoreRing score={82} /></section>}
        <section className="three-grid"><div><Compass /><strong>具体需求</strong><span>从身份与场景切入</span></div><div><BarChart3 /><strong>真实利润</strong><span>计入售后和退款</span></div><div><ShieldCheck /><strong>合规优先</strong><span>高风险机会不推荐</span></div></section>
      </>}

      {tab === 'opportunities' && <>
        <section className="section-heading"><div><span className="eyebrow">{results.length} 个候选</span><h2>先验证，再投入。</h2></div><button className="icon-button" onClick={() => setTab('discover')} aria-label="重新选择方向"><RotateCcw size={17} /></button></section>
        <div className="card-list">{results.map(item => <OpportunityCard key={item.id} item={item} busy={busyId === item.id} onSave={save} />)}</div>
        <section className="calculator">
          <span className="eyebrow">利润压力测试</span><h2>别让毛利掩盖售后成本。</h2>
          <div className="form-grid">
            <label>售价<input type="number" min="0" value={price} onChange={e => setPrice(Number(e.target.value))} /></label>
            <label>单次成本<input type="number" min="0" value={cost} onChange={e => setCost(Number(e.target.value))} /></label>
            <label>人工小时<input type="number" min="0" step="0.05" value={hours} onChange={e => setHours(Number(e.target.value))} /></label>
            <label>时薪<input type="number" min="0" value={hourlyRate} onChange={e => setHourlyRate(Number(e.target.value))} /></label>
            <label>退款率 %<input type="number" min="0" max="100" value={refundRate} onChange={e => setRefundRate(Number(e.target.value))} /></label>
          </div>
          {profit ? <div className={`profit-result ${profit.net < 0 ? 'loss' : ''}`}><span>预计单笔净利润</span><strong>¥{profit.net.toFixed(2)}</strong><small>净利率 {profit.margin.toFixed(1)}% · 已预留退款 ¥{profit.refundReserve.toFixed(2)}</small></div> : <div className="inline-error" role="alert">请输入有效成本，退款率不能超过100%。</div>}
        </section>
      </>}

      {tab === 'watchlist' && <section>
        <div className="section-heading"><div><span className="eyebrow">本地保存</span><h2>{watchlist.length ? `${watchlist.length} 个观察项` : '还没有收藏机会'}</h2></div>{watchlist.length > 0 && <button className="icon-button danger" onClick={async () => { await clearWatchlist(); setWatchlist([]); setFeedback({ kind: 'info', message: '本地观察列表已清空。' }); }} aria-label="清空观察列表"><Trash2 size={17} /></button>}</div>
        {watchlist.length === 0 ? <div className="empty"><Bookmark size={28} /><p>在机会卡片点击“收藏并观察”，下次会显示变化。</p><button className="secondary" onClick={() => setTab('opportunities')}>查看候选机会</button></div> : <div className="watch-list">{watchlist.map(item => <div key={item.id}><div><strong>{item.title}</strong><span>机会分 {item.score} · {new Date(item.savedAt).toLocaleDateString('zh-CN')}</span></div><button onClick={() => remove(item.id)} aria-label={`删除${item.title}`}><Trash2 size={16} /></button></div>)}</div>}
      </section>}

      {tab === 'settings' && <>
        <section className="settings-card"><Database /><div><strong>本地优先</strong><p>收藏和快照保存在浏览器本地。当前Mock版本不会上传页面数据。</p></div><span className="status-dot">已启用</span></section>
        <section className="settings-card"><ShieldCheck /><div><strong>合规保护</strong><p>高风险虚拟产品会被限制推荐，不提供规避平台审核的方法。</p></div><span className="status-dot">已启用</span></section>
        <section className="checklist"><span className="eyebrow">发布前自检</span><h2>四项都通过，才进入验证。</h2>{['内容由我原创或已获得授权', '不含机构水印、出版物或付费课程', '不售卖破解软件、共享账号或资格', '交付边界、售后和退款规则已写清'].map((label, index) => <button key={label} className={checks[index] ? 'checked' : ''} onClick={() => setChecks(values => values.map((value, i) => i === index ? !value : value))}><span>{checks[index] && <Check size={14} />}</span>{label}</button>)}</section>
      </>}
    </main>

    <nav className="bottom-nav" aria-label="主导航">
      <button className={tab === 'discover' ? 'active' : ''} onClick={() => setTab('discover')}><Compass /><span>发现</span></button>
      <button className={tab === 'opportunities' ? 'active' : ''} onClick={() => setTab('opportunities')}><ChevronRight /><span>机会</span></button>
      <button className={tab === 'watchlist' ? 'active' : ''} onClick={() => setTab('watchlist')}><Bookmark /><span>观察</span></button>
      <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}><Settings2 /><span>设置</span></button>
    </nav>
  </div>;
}
