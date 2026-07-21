import type { PersistStorage, StateStorage, StorageValue } from "zustand/middleware";

const DEFAULT_MS = 450;

/** 最近一次 `createDebouncedJsonStorage` 实例的立即落盘函数（单应用单 persist 键）。 */
let flushQuotePersistDebouncedStorage: (() => void) | null = null;

export function flushQuotePersistDebouncedStorageNow() {
  flushQuotePersistDebouncedStorage?.();
}

/**
 * 与 `createJSONStorage` 相同：对 persist 暴露「已 parse / 待 stringify」的对象流；
 * 但将 JSON.stringify 与落盘延迟到用户停顿后执行，避免大状态在每次 set（含每击键）时全量主线程序列化。
 * 在 pagehide / beforeunload / visibility 隐藏时立即 flush，降低未落盘数据丢失风险。
 */
export function createDebouncedJsonStorage<S = unknown>(
  getStorage: () => StateStorage,
  debounceMs: number = DEFAULT_MS,
): PersistStorage<S> {
  const storage = getStorage();
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let pending: { name: string; newValue: StorageValue<S> } | null = null;

  const runFlush = () => {
    if (!pending) return;
    const { name, newValue } = pending;
    pending = null;
    const value = JSON.stringify(newValue);
    return storage.setItem(name, value);
  };

  const scheduleFlush = () => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      timeout = null;
      void runFlush();
    }, debounceMs);
  };

  const flushSync = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    void runFlush();
  };
  flushQuotePersistDebouncedStorage = flushSync;

  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", flushSync, { capture: true });
    window.addEventListener("beforeunload", flushSync, { capture: true });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushSync();
    });
  }

  return {
    getItem: (name) => {
      const str = storage.getItem(name) as string | null | Promise<string | null>;
      const parse = (s: string | null): StorageValue<S> | null => {
        if (s == null) return null;
        return JSON.parse(String(s)) as StorageValue<S>;
      };
      if (str != null && typeof (str as Promise<string | null>).then === "function") {
        return (str as Promise<string | null>).then(parse);
      }
      return parse(str as string | null);
    },
    setItem: (name, newValue) => {
      pending = { name, newValue };
      scheduleFlush();
    },
    removeItem: (name) => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      if (pending?.name === name) {
        pending = null;
      } else {
        void runFlush();
      }
      return storage.removeItem(name);
    },
  };
}
