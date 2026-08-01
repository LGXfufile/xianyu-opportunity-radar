import type { MonitorSummary, MonitoredProduct, MonitoringEvent, MonitoringTask, MonitoringTaskSummary, ProductSnapshot } from './monitoringTypes';

const DB_NAME = 'xianyu-opportunity-radar';
const DB_VERSION = 1;
const PRODUCTS = 'products';
const SNAPSHOTS = 'snapshots';
const TASKS = 'tasks';
const EVENTS = 'events';
const DEDUPE_WINDOW = 10 * 60 * 1000;

function requestValue<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('数据库操作失败'));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('数据库事务失败'));
    transaction.onabort = () => reject(transaction.error || new Error('数据库事务已取消'));
  });
}

export function openMonitoringDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PRODUCTS)) db.createObjectStore(PRODUCTS, { keyPath: 'itemId' });
      if (!db.objectStoreNames.contains(SNAPSHOTS)) {
        const store = db.createObjectStore(SNAPSHOTS, { keyPath: 'id', autoIncrement: true });
        store.createIndex('itemIdCapturedAt', ['itemId', 'capturedAt']);
        store.createIndex('itemId', 'itemId');
      }
      if (!db.objectStoreNames.contains(TASKS)) {
        const store = db.createObjectStore(TASKS, { keyPath: 'id' });
        store.createIndex('activeNextRunAt', ['active', 'nextRunAt']);
      }
      if (!db.objectStoreNames.contains(EVENTS)) {
        const store = db.createObjectStore(EVENTS, { keyPath: 'id', autoIncrement: true });
        store.createIndex('taskIdCreatedAt', ['taskId', 'createdAt']);
        store.createIndex('itemIdCreatedAt', ['itemId', 'createdAt']);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('监控数据库打开失败'));
  });
}

async function snapshotsFor(db: IDBDatabase, itemId: string) {
  const transaction = db.transaction(SNAPSHOTS, 'readonly');
  const values = await requestValue(transaction.objectStore(SNAPSHOTS).index('itemId').getAll(itemId)) as ProductSnapshot[];
  await transactionDone(transaction);
  return values.sort((a, b) => b.capturedAt - a.capturedAt);
}

async function eventCountFor(db: IDBDatabase, taskId: string) {
  const transaction = db.transaction(EVENTS, 'readonly');
  const values = await requestValue(transaction.objectStore(EVENTS).index('taskIdCreatedAt').getAll(IDBKeyRange.bound([taskId, 0], [taskId, Number.MAX_SAFE_INTEGER])));
  await transactionDone(transaction);
  return Array.isArray(values) ? values.length : 0;
}

async function allTasks(db: IDBDatabase) {
  const transaction = db.transaction(TASKS, 'readonly');
  const values = await requestValue(transaction.objectStore(TASKS).getAll()) as MonitoringTask[];
  await transactionDone(transaction);
  return values;
}

export async function addSnapshot(snapshot: ProductSnapshot) {
  const db = await openMonitoringDb();
  try {
    const history = await snapshotsFor(db, snapshot.itemId);
    const latest = history[0];
    const unchanged = latest && latest.price === snapshot.price && latest.wants === snapshot.wants && latest.views === snapshot.views && latest.score === snapshot.score;
    if (latest && unchanged && snapshot.capturedAt - latest.capturedAt < DEDUPE_WINDOW) return false;
    const transaction = db.transaction(SNAPSHOTS, 'readwrite');
    transaction.objectStore(SNAPSHOTS).add(snapshot);
    await transactionDone(transaction);
    return true;
  } finally { db.close(); }
}

export async function upsertMonitoredProduct(product: MonitoredProduct, snapshot: ProductSnapshot) {
  const db = await openMonitoringDb();
  try {
    const transaction = db.transaction(PRODUCTS, 'readwrite');
    transaction.objectStore(PRODUCTS).put(product);
    await transactionDone(transaction);
  } finally { db.close(); }
  await addSnapshot(snapshot);
}

export async function listMonitoredProducts(): Promise<MonitorSummary[]> {
  const db = await openMonitoringDb();
  try {
    const transaction = db.transaction(PRODUCTS, 'readonly');
    const products = await requestValue(transaction.objectStore(PRODUCTS).getAll()) as MonitoredProduct[];
    await transactionDone(transaction);
    const summaries = await Promise.all(products.map(async product => {
      const history = await snapshotsFor(db, product.itemId);
      return { ...product, latest: history[0], previous: history[1], snapshotCount: history.length };
    }));
    return summaries.sort((a, b) => b.updatedAt - a.updatedAt);
  } finally { db.close(); }
}

export async function removeMonitoredProduct(itemId: string) {
  const db = await openMonitoringDb();
  try {
    const transaction = db.transaction([PRODUCTS, SNAPSHOTS], 'readwrite');
    transaction.objectStore(PRODUCTS).delete(itemId);
    const index = transaction.objectStore(SNAPSHOTS).index('itemId');
    const keys = await requestValue(index.getAllKeys(itemId));
    keys.forEach(key => transaction.objectStore(SNAPSHOTS).delete(key));
    await transactionDone(transaction);
  } finally { db.close(); }
}

export async function upsertTask(task: MonitoringTask) {
  const db = await openMonitoringDb();
  try {
    const transaction = db.transaction(TASKS, 'readwrite');
    transaction.objectStore(TASKS).put(task);
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

export async function removeTask(taskId: string) {
  const db = await openMonitoringDb();
  try {
    const transaction = db.transaction(TASKS, 'readwrite');
    transaction.objectStore(TASKS).delete(taskId);
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

export async function listTasks(): Promise<MonitoringTaskSummary[]> {
  const db = await openMonitoringDb();
  try {
    const tasks = await allTasks(db);
    const now = Date.now();
    const summaries = await Promise.all(tasks.map(async task => {
      const dueAt = task.nextRunAt ?? (task.lastRunAt ?? task.createdAt);
      const dueInMs = dueAt - now;
      const overdue = dueInMs <= 0;
      return {
        ...task,
        eventCount: await eventCountFor(db, task.id),
        dueInMs,
        dueLabel: overdue ? '已到期' : `还有 ${Math.ceil(dueInMs / 60000)} 分钟`,
        overdue
      };
    }));
    return summaries.sort((a, b) => Number(b.overdue) - Number(a.overdue) || (a.nextRunAt ?? 0) - (b.nextRunAt ?? 0));
  } finally {
    db.close();
  }
}

export async function addEvents(events: MonitoringEvent[]) {
  if (!events.length) return 0;
  const db = await openMonitoringDb();
  try {
    const transaction = db.transaction(EVENTS, 'readwrite');
    const store = transaction.objectStore(EVENTS);
    let count = 0;
    for (const event of events) {
      store.add(event);
      count += 1;
    }
    await transactionDone(transaction);
    return count;
  } finally {
    db.close();
  }
}

export async function getRecentEvents(limit = 20): Promise<MonitoringEvent[]> {
  const db = await openMonitoringDb();
  try {
    const transaction = db.transaction(EVENTS, 'readonly');
    const values = await requestValue(transaction.objectStore(EVENTS).getAll()) as MonitoringEvent[];
    await transactionDone(transaction);
    return values.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  } finally {
    db.close();
  }
}
