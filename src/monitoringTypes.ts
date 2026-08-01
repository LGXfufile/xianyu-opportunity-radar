export type MonitoredProduct = {
  itemId: string;
  title: string;
  url: string;
  imageUrl?: string;
  addedAt: number;
  updatedAt: number;
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

export type MonitorMessage =
  | { type: 'MONITOR_LIST' }
  | { type: 'MONITOR_UPSERT'; product: MonitoredProduct; snapshot: ProductSnapshot }
  | { type: 'MONITOR_SNAPSHOT'; snapshot: ProductSnapshot }
  | { type: 'MONITOR_REMOVE'; itemId: string };

export type MonitorResponse<T = unknown> = { ok: true; data: T } | { ok: false; error: string };
