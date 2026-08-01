import type { MonitorSummary, MonitoredProduct, ProductSnapshot } from './monitoringTypes';

const DB_NAME = 'xianyu-opportunity-radar';
const DB_VERSION = 1;
const PRODUCTS = 'products';
const SNAPSHOTS = 'snapshots';
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
