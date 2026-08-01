import { addSnapshot, listMonitoredProducts, removeMonitoredProduct, upsertMonitoredProduct } from '../src/monitoringDb';
import type { MonitorMessage } from '../src/monitoringTypes';

export default defineBackground(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);

  chrome.runtime.onMessage.addListener((message: MonitorMessage | { type: 'RADAR_HEALTH' }, _sender, sendResponse) => {
    if (message?.type === 'RADAR_HEALTH') {
      sendResponse({ ok: true, at: Date.now(), version: chrome.runtime.getManifest().version });
      return;
    }
    if (!message?.type.startsWith('MONITOR_')) return;
    const run = async () => {
      if (message.type === 'MONITOR_LIST') return listMonitoredProducts();
      if (message.type === 'MONITOR_UPSERT') return upsertMonitoredProduct(message.product, message.snapshot);
      if (message.type === 'MONITOR_SNAPSHOT') return addSnapshot(message.snapshot);
      if (message.type === 'MONITOR_REMOVE') return removeMonitoredProduct(message.itemId);
    };
    void run().then(data => sendResponse({ ok: true, data })).catch(error => sendResponse({ ok: false, error: error instanceof Error ? error.message : '监控数据库操作失败' }));
    return true;
  });
});
