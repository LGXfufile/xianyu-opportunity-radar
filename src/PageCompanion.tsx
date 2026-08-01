import { PanelRightOpen, Radar, X } from 'lucide-react';
import { useState } from 'react';

export function PageCompanion() {
  const [hidden, setHidden] = useState(false);
  const [status, setStatus] = useState<'idle' | 'opening' | 'error'>('idle');
  if (hidden) return null;
  const open = async () => {
    setStatus('opening');
    try {
      await chrome.runtime.sendMessage({ type: 'RADAR_HEALTH' });
      await chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  };
  return <div className="page-companion">
    <button className="companion-main" onClick={open} disabled={status === 'opening'} aria-label="打开闲鱼机会雷达">
      <Radar size={18} /><span>{status === 'opening' ? '正在打开…' : status === 'error' ? '重试打开' : '发现本页机会'}</span><PanelRightOpen size={16} />
    </button>
    <button className="companion-close" onClick={() => setHidden(true)} aria-label="关闭机会雷达入口"><X size={14} /></button>
  </div>;
}
