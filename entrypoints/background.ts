import { addSnapshot, addEvents, listMonitoredProducts, listTasks, removeMonitoredProduct, removeTask, upsertMonitoredProduct, upsertTask } from '../src/monitoringDb';
import type { MonitorMessage, MonitoringEvent, MonitoringTask, MonitoringTaskSummary } from '../src/monitoringTypes';

const ALARM_NAME = 'xianyu-opportunity-radar-tick';

async function scheduleAlarm() {
  await chrome.alarms.create(ALARM_NAME, { periodInMinutes: 15 });
}

async function broadcastTick() {
  const tabs = await chrome.tabs.query({ url: ['https://www.goofish.com/*'] });
  await Promise.allSettled(tabs.map(tab => tab.id ? chrome.tabs.sendMessage(tab.id, { type: 'TASK_TICK' }) : Promise.resolve()));
}

async function runDueTaskScan(now: number) {
  const tasks = await listTasks();
  const due = tasks.filter(task => task.active && (task.nextRunAt ?? task.createdAt) <= now);
  if (!due.length) return tasks;
  await broadcastTick();
  return due;
}

export default defineBackground(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
  void scheduleAlarm();

  chrome.runtime.onMessage.addListener((message: MonitorMessage | { type: 'RADAR_HEALTH' } | { type: 'TASK_TICK' }, _sender, sendResponse) => {
    if (message?.type === 'RADAR_HEALTH') {
      sendResponse({ ok: true, at: Date.now(), version: chrome.runtime.getManifest().version });
      return;
    }
    if (message?.type === 'TASK_TICK') return;
    if (!message?.type.startsWith('MONITOR_')) return;
    const run = async () => {
      if (message.type === 'MONITOR_LIST') return listMonitoredProducts();
      if (message.type === 'MONITOR_UPSERT') return upsertMonitoredProduct(message.product, message.snapshot);
      if (message.type === 'MONITOR_SNAPSHOT') return addSnapshot(message.snapshot);
      if (message.type === 'MONITOR_REMOVE') return removeMonitoredProduct(message.itemId);
      if (message.type === 'TASK_LIST') return listTasks();
      if (message.type === 'TASK_UPSERT') return upsertTask(message.task);
      if (message.type === 'TASK_REMOVE') return removeTask(message.taskId);
      if (message.type === 'TASK_RUN_DUE') return runDueTaskScan(message.at ?? Date.now());
      if (message.type === 'TASK_EVENT_APPEND') return addEvents(message.events);
    };
    void run().then(data => sendResponse({ ok: true, data })).catch(error => sendResponse({ ok: false, error: error instanceof Error ? error.message : '监控数据库操作失败' }));
    return true;
  });

  chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name !== ALARM_NAME) return;
    void runDueTaskScan(Date.now()).catch(() => undefined);
  });

  chrome.runtime.onInstalled.addListener(() => { void scheduleAlarm(); });
  chrome.runtime.onStartup.addListener(() => { void scheduleAlarm(); });
});
