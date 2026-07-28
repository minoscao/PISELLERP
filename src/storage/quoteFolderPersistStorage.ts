import type { StateStorage } from "zustand/middleware";
import { quotePersistStorage, readPersistJsonFromIdbOnly } from "./quotePersistStorage";

const PERSIST_API = "/api/quote-persist";

function isJsonResponse(response: Response) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  return contentType.includes("application/json") || contentType.includes("application/vnd.api+json");
}

/**
 * 优先读写项目目录 `data/marketing-quote-v1.json`（经 Vite dev / `vite preview` 的 `/api/quote-persist`）。
 * 读取时合并：项目文件、IndexedDB、localStorage 残留，取定制方案内容更完整的一份。
 */
export const quoteFolderPersistStorage: StateStorage = {
  getItem: async (name) => {
    if (typeof window === "undefined") return quotePersistStorage.getItem(name);

    let fromFile: string | null = null;
    try {
      const r = await fetch(PERSIST_API, { method: "GET", cache: "no-store" });
      // A static-host SPA fallback can answer this URL with index.html (200).
      // Never pass that HTML to Zustand's JSON persist parser, otherwise startup
      // remains stuck in the loading state.
      if (r.ok && isJsonResponse(r)) {
        const t = await r.text();
        if (t && t.trim().length > 0) fromFile = t;
      }
    } catch {
      /* 静态托管、file:// 等无 API */
    }

    if (fromFile) return fromFile;

    const fromIdb = await readPersistJsonFromIdbOnly(name);
    let fromLegacyLs: string | null = null;
    try {
      fromLegacyLs = window.localStorage.getItem(name);
    } catch {
      /* ignore */
    }

    if (fromIdb) return fromIdb;
    if (fromLegacyLs) return fromLegacyLs;

    return quotePersistStorage.getItem(name);
  },

  setItem: async (name, value) => {
    const str = typeof value === "string" ? value : JSON.stringify(value);
    try {
      const response = await fetch(PERSIST_API, {
        method: "PUT",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: str,
      });
      if (!response.ok) throw new Error("Project storage endpoint is unavailable");
    } catch {
      /* 无服务时仅写 IDB */
    }
    return quotePersistStorage.setItem(name, str);
  },

  removeItem: async (name) => {
    try {
      await fetch(PERSIST_API, { method: "DELETE" });
    } catch {
      /* noop */
    }
    return quotePersistStorage.removeItem(name);
  },
};

export { PERSIST_API as QUOTE_PERSIST_API };
