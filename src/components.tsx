import { AlertCircle, CheckCircle2, Info, LoaderCircle, TriangleAlert, X } from 'lucide-react';
import type { Feedback, Opportunity } from './types';
import { scoreTone } from './scoring';

export function FeedbackBar({ feedback, onClose }: { feedback: Feedback; onClose: () => void }) {
  const Icon = feedback.kind === 'success' ? CheckCircle2 : feedback.kind === 'error' ? AlertCircle : feedback.kind === 'warning' ? TriangleAlert : Info;
  return <div className={`feedback feedback-${feedback.kind}`} role={feedback.kind === 'error' ? 'alert' : 'status'}>
    <Icon size={16} aria-hidden="true" /><span>{feedback.message}</span><button onClick={onClose} aria-label="关闭提示"><X size={15} /></button>
  </div>;
}

export function LoadingState({ label = '正在分析证据…' }: { label?: string }) {
  return <div className="loading" role="status"><LoaderCircle className="spin" size={20} /><span>{label}</span></div>;
}

export function ScoreRing({ score, label = '机会分' }: { score: number; label?: string }) {
  const safe = Math.min(100, Math.max(0, score));
  return <div className={`score-ring ${scoreTone(safe)}`} style={{ '--score': `${safe * 3.6}deg` } as React.CSSProperties}>
    <div><strong>{safe}</strong><span>{label}</span></div>
  </div>;
}

export function OpportunityCard({ item, onSave, busy }: { item: Opportunity; onSave: (item: Opportunity) => void; busy?: boolean }) {
  return <article className="opportunity-card">
    <div className="card-top"><div><span className="eyebrow">{item.audience}</span><h3>{item.title}</h3></div><span className={`score-chip ${scoreTone(item.score)}`}>{item.score}</span></div>
    <p className="format">{item.format} · {item.price} · 置信度{item.confidence}</p>
    <ul>{item.reason.slice(0, 3).map(reason => <li key={reason}>{reason}</li>)}</ul>
    {item.warning && <p className="inline-warning"><TriangleAlert size={14} />{item.warning}</p>}
    <div className="metric-row" aria-label="机会评分明细">
      <span>需求 {item.demand}</span><span>竞争 {item.competition}</span><span>利润 {item.profit}</span><span>风险 {item.risk}</span>
    </div>
    <button className="secondary full" disabled={busy} onClick={() => onSave(item)}>{busy ? '正在收藏…' : '收藏并观察'}</button>
  </article>;
}
