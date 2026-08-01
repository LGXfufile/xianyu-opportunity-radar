import type { WatchItem } from './types';

const KEY = 'radar_watchlist';

function hasExtensionStorage() {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);
}

export async function loadWatchlist(): Promise<WatchItem[]> {
  try {
    if (hasExtensionStorage()) {
      const result = await chrome.storage.local.get(KEY);
      return Array.isArray(result[KEY]) ? result[KEY] : [];
    }
    const raw = globalThis.localStorage?.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : '读取收藏失败');
  }
}

export async function saveWatchItem(item: WatchItem): Promise<WatchItem[]> {
  const current = await loadWatchlist();
  const next = [item, ...current.filter(entry => entry.id !== item.id)].slice(0, 50);
  if (hasExtensionStorage()) await chrome.storage.local.set({ [KEY]: next });
  else globalThis.localStorage?.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function removeWatchItem(id: string): Promise<WatchItem[]> {
  const current = await loadWatchlist();
  const next = current.filter(item => item.id !== id);
  if (hasExtensionStorage()) await chrome.storage.local.set({ [KEY]: next });
  else globalThis.localStorage?.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function clearWatchlist(): Promise<void> {
  if (hasExtensionStorage()) await chrome.storage.local.remove(KEY);
  else globalThis.localStorage?.removeItem(KEY);
}
