import { ArrowUpRight, Radar } from 'lucide-react';
import { useState } from 'react';
import { FeedbackBar } from './components';
import type { Feedback } from './types';

export function PopupApp() {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const openPanel = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.windowId) throw new Error('没有找到当前窗口');
      await chrome.sidePanel.open({ windowId: tab.windowId });
      window.close();
    } catch (error) {
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : '无法打开侧边栏' });
    }
  };
  return <main className="popup-shell">
    <div className="brand-mark"><Radar size={20} /></div>
    <span className="eyebrow">OPPORTUNITY RADAR</span>
    <h1>把热度，变成可验证的机会。</h1>
    <p>分析当前闲鱼页面的需求、竞争、利润与风险。</p>
    {feedback && <FeedbackBar feedback={feedback} onClose={() => setFeedback(null)} />}
    <button className="primary full" onClick={openPanel}>打开机会雷达 <ArrowUpRight size={16} /></button>
    <small>当前版本仅访问 goofish.com，默认不上传页面数据。</small>
  </main>;
}
