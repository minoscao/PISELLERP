import type { StateStorage } from "zustand/middleware";

const DB_NAME = "marketing-quote-idb";
const DB_VERSION = 1;
const STORE_NAME = "kv";

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("aborted"));
  });
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

/** 只读 IndexedDB 中的 persist JSON（不触发 localStorage 迁移）。 */
export async function readPersistJsonFromIdbOnly(name: string): Promise<string | null> {
  const db = await openDb();
  if (!db) return null;
  try {
    const tx = db.transaction(STORE_NAME, "readonly");
    const v = await idbRequest(tx.objectStore(STORE_NAME).get(name));
    return v != null ? String(v) : null;
  } catch {
    return null;
  }
}

/**
 * Zustand persist：IndexedDB（容量远大于 localStorage）。
 * 若 IDB 中无数据，会尝试读取同名 localStorage 键、写入 IDB 后删除 localStorage，减轻迁移成本。
 */
export const quotePersistStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const db = await openDb();
    if (db) {
      try {
        const tx = db.transaction(STORE_NAME, "readonly");
        const v = await idbRequest(tx.objectStore(STORE_NAME).get(name));
        if (v != null) return String(v);
      } catch {
        /* fall through */
      }
    }
    try {
      const legacy = localStorage.getItem(name);
      if (!legacy) return null;
      if (db) {
        try {
          const tx = db.transaction(STORE_NAME, "readwrite");
          tx.objectStore(STORE_NAME).put(legacy, name);
          await txDone(tx);
          try {
            localStorage.removeItem(name);
          } catch {
            /* ignore */
          }
        } catch {
          /* 迁移失败则仍从返回值读取，保留 localStorage */
        }
      }
      return legacy;
    } catch {
      return null;
    }
  },

  setItem: async (name: string, value: string): Promise<void> => {
    const db = await openDb();
    if (db) {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(value, name);
      await txDone(tx);
    } else {
      try {
        localStorage.setItem(name, value);
      } catch (e) {
        console.error("Persist failed (no IndexedDB and localStorage full):", e);
        throw e;
      }
      return;
    }
    try {
      localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },

  removeItem: async (name: string): Promise<void> => {
    const db = await openDb();
    if (db) {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(name);
        await txDone(tx);
      } catch {
        /* ignore */
      }
    }
    try {
      localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};
