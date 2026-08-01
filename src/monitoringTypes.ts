export type MonitoredProduct = {
  itemId: string;
  title: string;
  url: string;
  imageUrl?: string;
  addedAt: number;
  updatedAt: number;
};

export type MonitoringTask = {
  id: string;
  name: string;
  keywords: string[];
  minScore: number;
  minRatio: number;
  maxCompetition: number;
  minProfitMargin: number;
  minPrice: number;
  maxPrice: number;
  publishedWindowDays: 7 | 30 | 90;
  active: boolean;
  intervalMinutes: 60 | 180 | 360 | 720 | 1440;
  lastRunAt?: number;
  nextRunAt?: number;
  lastMatchCount?: number;
  lastSignal?: string;
  createdAt: number;
  updatedAt: number;
};

export type MonitoringEvent = {
  id?: number;
  taskId: string;
  itemId: string;
  createdAt: number;
  kind: 'new-match' | 'score-up' | 'score-down' | 'blue-ocean';
  title: string;
  score: number;
  wants: number;
  views: number;
  ratio: number;
  price: number;
  profit: number;
  url: string;
  summary: string;
};

export type ProductSnapshot = {
  id?: number;
  itemId: string;
  capturedAt: number;
  price: number;
  wants: number;
  views: number;
  ratio: number;
  score: number;
  netProfit: number;
};

export type MonitorSummary = MonitoredProduct & {
  latest?: ProductSnapshot;
  previous?: ProductSnapshot;
  snapshotCount: number;
};

export type MonitoringTaskSummary = MonitoringTask & {
  eventCount: number;
  dueInMs: number;
  dueLabel: string;
  overdue: boolean;
};

export type MonitorMessage =
  | { type: 'MONITOR_LIST' }
  | { type: 'MONITOR_UPSERT'; product: MonitoredProduct; snapshot: ProductSnapshot }
  | { type: 'MONITOR_SNAPSHOT'; snapshot: ProductSnapshot }
  | { type: 'MONITOR_REMOVE'; itemId: string }
  | { type: 'TASK_LIST' }
  | { type: 'TASK_UPSERT'; task: MonitoringTask }
  | { type: 'TASK_REMOVE'; taskId: string }
  | { type: 'TASK_RUN_DUE'; at?: number }
  | { type: 'TASK_EVENT_APPEND'; events: MonitoringEvent[] };

export type MonitorResponse<T = unknown> = { ok: true; data: T } | { ok: false; error: string };
