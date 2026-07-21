/** Zustand persist 默认键名（与 quoteStore persist.name 一致） */
export const QUOTE_PERSIST_STORAGE_KEY = "marketing-quote-v1";

export type QuotePersistLocalState = Record<string, unknown> | null;

/** 读取仍留在 localStorage 的整份 persist JSON（若存在）。结构为 `{ state: { ... }, version }`。 */
export function readQuotePersistStateFromLocalStorage(): QuotePersistLocalState {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(QUOTE_PERSIST_STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as { state?: Record<string, unknown> };
    if (!o || typeof o !== "object" || !o.state || typeof o.state !== "object") return null;
    return o.state;
  } catch {
    return null;
  }
}

/** 优先使用「非空」的一份：IndexedDB 里若已写成空数组，可回退到 localStorage 备份。 */
export function preferNonEmptyCatalogArray<T>(
  fromPersisted: T[] | undefined,
  fromLocalStorage: T[] | undefined,
  fallback: T[],
): T[] {
  if (Array.isArray(fromPersisted) && fromPersisted.length > 0) return fromPersisted;
  if (Array.isArray(fromLocalStorage) && fromLocalStorage.length > 0) return fromLocalStorage;
  if (Array.isArray(fromPersisted)) return fromPersisted;
  if (Array.isArray(fromLocalStorage)) return fromLocalStorage;
  return fallback;
}
