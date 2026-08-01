import { BarChart3, Bookmark, Check, ChevronRight, Compass, Database, ExternalLink, RefreshCw, RotateCcw, Search, Settings2, ShieldCheck, Trash2, TrendingUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { buildOpportunities, directionPresets, initialOpportunities } from './data';
import { FeedbackBar, LoadingState, OpportunityCard, ScoreRing } from './components';
import { calculateProfit } from './scoring';
import { clearWatchlist, loadWatchlist, removeWatchItem, saveWatchItem } from './storage';
import type { Feedback, Opportunity, WatchItem } from './types';
import { loadMonitors, loadTasks, monitorDelta, removeMonitor, removeTask, runDueTasks, saveTask, taskDueLabel } from './monitoringClient';
import type { MonitorSummary, MonitoringTask, MonitoringTaskSummary } from './monitoringTypes';

type Tab = 'discover' | 'opportunities' | 'watchlist' | 'settings';

export function RadarApp() {
  const [tab, setTab] = useState<Tab>('discover');
  const [query, setQuery] = useState('工业产品');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Opportunity[]>(initialOpportunities);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [watchlist, setWatchlist] = useState<WatchItem[]>([]);
  const [monitors, setMonitors] = useState<MonitorSummary[]>([]);
  const [tasks, setTasks] = useState<MonitoringTaskSummary[]>([]);
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [taskLoading, setTaskLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [price, setPrice] = useState(49);
  const [cost, setCost] = useState(4);
  const [hours, setHours] = useState(0.15);
  const [hourlyRate, setHourlyRate] = useState(50);
  const [refundRate, setRefundRate] = useState(5);
  const [checks, setChecks] = useState([true, true, true, false]);

  const refreshMonitors = async () => {
    setMonitorLoading(true);
    try { setMonitors(await loadMonitors()); }
    catch (error) { setFeedback({ kind: 'error', message: error instanceof Error ? error.message : '读取监控数据库失败' }); }
    finally { setMonitorLoading(false); }
  };

  const refreshTasks = async () => {
    setTaskLoading(true);
    try { setTasks(await loadTasks()); }
    catch (error) { setFeedback({ kind: 'error', message: error instanceof Error ? error.message : '读取监控任务失败' }); }
    finally { setTaskLoading(false); }
  };

  useEffect(() => { loadWatchlist().then(setWatchlist).catch(error => setFeedback({ kind: 'error', message: error.message })); void refreshMonitors(); void refreshTasks(); }, []);

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
      const adjusted = buildOpportunities(clean);
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

  const saveCurrentTask = async () => {
    const task: MonitoringTask = {
      id: `task-${Date.now()}`,
      name: `${query.trim() || '机会任务'} · ${new Date().toLocaleDateString('zh-CN')}`,
      keywords: query.trim() ? [query.trim()] : [],
      minScore: 75,
      minRatio: 8,
      maxCompetition: 70,
      minProfitMargin: 25,
      minPrice: 0,
      maxPrice: 99999,
      publishedWindowDays: 30,
      active: true,
      intervalMinutes: 180,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await saveTask(task);
    await refreshTasks();
    setFeedback({ kind: 'success', message: '已保存为定时监控任务。' });
  };

  const remove = async (id: string) => {
    try { setWatchlist(await removeWatchItem(id)); setFeedback({ kind: 'info', message: '已移出观察列表。' }); }
    catch (error) { setFeedback({ kind: 'error', message: error instanceof Error ? error.message : '删除失败' }); }
  };

  return <div className="app-shell">
    <header className="app-header"><div><span className="eyebrow">闲鱼机会雷达</span><h1>{tab === 'discover' ? '发现' : tab === 'opportunities' ? '机会' : tab === 'watchlist' ? '观察' : '设置'}</h1></div><span className="dev-badge">MVP · 样本库</span></header>
    {feedback && <FeedbackBar feedback={feedback} onClose={() => setFeedback(null)} />}

    <main className="app-content">
      {tab === 'discover' && <>
        <section className="hero-card">
          <div className="hero-copy"><span className="eyebrow">从一个具体场景开始</span><h2>寻找竞争更少、利润更清楚的产品。</h2><p>输入用户、职业或场景。我们会把需求证据、竞争、交付与合规放在同一张判断卡里。</p></div>
          <div className="search-box"><Search size={18} /><input value={query} maxLength={40} onChange={event => setQuery(event.target.value)} onKeyDown={event => event.key === 'Enter' && analyze()} aria-label="产品机会方向" placeholder="例如：工业产品" /><button onClick={analyze} disabled={loading}>{loading ? '分析中' : '发现机会'}</button></div>
          <div className="preset-row">{directionPresets.map(item => <button key={item} onClick={() => setQuery(item)}>{item}</button>)}</div>
        </section>
        {loading ? <LoadingState /> : <section className="market-summary"><div><span className="eyebrow">人工验证样本</span><h2>结果会随场景变化，不再复用固定卡片。</h2><p>工业方向基于本次闲鱼搜索快照；未覆盖方向会明确标记为待验证。</p></div><ScoreRing score={82} /></section>}
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
        <div className="section-heading"><div><span className="eyebrow">IndexedDB · 浏览即更新</span><h2>{monitors.length ? `${monitors.length} 个商品监控中` : '还没有监控商品'}</h2></div><button className="icon-button" disabled={monitorLoading} onClick={refreshMonitors} aria-label="刷新监控数据"><RefreshCw className={monitorLoading ? 'spin' : ''} size={17} /></button></div>
        {monitors.length === 0 ? <div className="empty monitor-empty"><TrendingUp size={28} /><p>在闲鱼搜索结果中点击“＋ 监控”，每次再次看到商品时会记录真实变化。</p></div> : <div className="monitor-list">{monitors.map(item => {
          const delta = monitorDelta(item); const latest = item.latest;
          return <article key={item.itemId} className="monitor-card">
            <div className="monitor-card-head"><div><strong>{item.title}</strong><span>{item.snapshotCount} 次快照 · {latest ? new Date(latest.capturedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '等待首次数据'}</span></div><span className="monitor-score">{latest?.score ?? '—'}</span></div>
            {latest && <div className="monitor-metrics"><span>¥{latest.price}</span><span>{latest.wants} 想要 <b>{delta.wants > 0 ? `+${delta.wants}` : delta.wants || ''}</b></span><span>{latest.views} 浏览 <b>{delta.views > 0 ? `+${delta.views}` : delta.views || ''}</b></span><span>{(latest.ratio * 100).toFixed(1)}%</span></div>}
            <div className="monitor-actions"><a href={item.url} target="_blank" rel="noreferrer">查看商品 <ExternalLink size={13} /></a><button onClick={async () => { await removeMonitor(item.itemId); await refreshMonitors(); setFeedback({ kind: 'info', message: '已停止监控并删除历史快照。' }); }}><Trash2 size={13} />停止监控</button></div>
          </article>;
        })}</div>}
        {watchlist.length > 0 && <><div className="subsection-title"><span>概念机会收藏</span><button onClick={async () => { await clearWatchlist(); setWatchlist([]); }} aria-label="清空概念机会收藏">清空</button></div><div className="watch-list">{watchlist.map(item => <div key={item.id}><div><strong>{item.title}</strong><span>机会分 {item.score} · {new Date(item.savedAt).toLocaleDateString('zh-CN')}</span></div><button onClick={() => remove(item.id)} aria-label={`删除${item.title}`}><Trash2 size={16} /></button></div>)}</div></>}
        <div className="section-heading" style={{ marginTop: 20 }}><div><span className="eyebrow">定时监控</span><h2>{tasks.length ? `${tasks.length} 个任务` : '还没有监控任务'}</h2></div><div style={{ display: 'flex', gap: 8 }}><button className="icon-button" disabled={taskLoading} onClick={async () => { await refreshTasks(); await runDueTasks(); await refreshTasks(); }} aria-label="手动扫描任务"><RefreshCw className={taskLoading ? 'spin' : ''} size={17} /></button><button className="secondary" onClick={saveCurrentTask}>保存当前方向</button></div></div>
        {tasks.length === 0 ? <div className="empty monitor-empty"><TrendingUp size={28} /><p>把当前搜索方向保存成任务，后续会定时复扫并记录新增机会。</p></div> : <div className="monitor-list">{tasks.map(task => <article key={task.id} className="monitor-card">
          <div className="monitor-card-head"><div><strong>{task.name}</strong><span>{task.keywords.join('、') || '无关键词'} · {taskDueLabel(task)} · {task.active ? '运行中' : '已暂停'}</span></div><span className="monitor-score">{task.eventCount}</span></div>
          <div className="monitor-metrics"><span>阈值 {task.minScore}</span><span>想要率 {task.minRatio}%</span><span>竞争 ≤ {task.maxCompetition}</span><span>{task.publishedWindowDays} 天</span></div>
          <div className="monitor-actions"><button onClick={async () => { await removeTask(task.id); await refreshTasks(); setFeedback({ kind: 'info', message: '已删除监控任务。' }); }}><Trash2 size={13} />删除任务</button></div>
        </article>)}</div>}
      </section>}

      {tab === 'settings' && <>
        <section className="settings-card"><Database /><div><strong>监控数据库</strong><p>商品与历史快照保存在扩展 IndexedDB，不上传闲鱼登录态；相同数据10分钟内自动去重。</p></div><span className="status-dot">已启用</span></section>
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
