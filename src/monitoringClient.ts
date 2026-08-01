import type { MonitorMessage, MonitorResponse, MonitorSummary, MonitoringTask, MonitoringTaskSummary } from './monitoringTypes';

async function send<T>(message: MonitorMessage): Promise<T> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return [] as T;
  const response = await chrome.runtime.sendMessage(message) as MonitorResponse<T>;
  if (!response?.ok) throw new Error(response?.error || '监控数据库操作失败');
  return response.data;
}

export const loadMonitors = () => send<MonitorSummary[]>({ type: 'MONITOR_LIST' });
export const removeMonitor = (itemId: string) => send<void>({ type: 'MONITOR_REMOVE', itemId });
export const loadTasks = () => send<MonitoringTaskSummary[]>({ type: 'TASK_LIST' });
export const saveTask = (task: MonitoringTask) => send<void>({ type: 'TASK_UPSERT', task });
export const removeTask = (taskId: string) => send<void>({ type: 'TASK_REMOVE', taskId });
export const runDueTasks = () => send<MonitoringTaskSummary[]>({ type: 'TASK_RUN_DUE' });

export function monitorDelta(item: MonitorSummary) {
  const latest = item.latest, previous = item.previous;
  return {
    wants: latest && previous ? latest.wants - previous.wants : 0,
    views: latest && previous ? latest.views - previous.views : 0,
    price: latest && previous ? latest.price - previous.price : 0,
    score: latest && previous ? latest.score - previous.score : 0
  };
}

export function taskDueLabel(task: MonitoringTaskSummary) {
  if (task.overdue) return '立即执行';
  if (task.dueInMs < 60 * 60 * 1000) return '1小时内';
  if (task.dueInMs < 6 * 60 * 60 * 1000) return '今日稍后';
  return task.dueLabel;
}
