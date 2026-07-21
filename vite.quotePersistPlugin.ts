import fs from "node:fs";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import type { Connect, Plugin } from "vite";

/** Same basename as Zustand persist key `name` in `quoteStore.ts`. */
export const QUOTE_PERSIST_FILE = "marketing-quote-v1.json";

const persistDir = path.resolve(process.cwd(), "data");
const persistPath = path.join(persistDir, QUOTE_PERSIST_FILE);
const backupDir = path.join(persistDir, "backups");
const MAX_BACKUPS = 5;
const BACKUP_PREFIX = "marketing-quote-";
const BACKUP_JSON_SUFFIX = ".json";
const BACKUP_GZIP_SUFFIX = ".json.gz";

function writeTimestampedBackup(body: string) {
  try {
    fs.mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    fs.writeFileSync(
      path.join(backupDir, `${BACKUP_PREFIX}${stamp}${BACKUP_GZIP_SUFFIX}`),
      gzipSync(createCompactBackupBody(body)),
      "binary",
    );
    pruneBackupFiles();
  } catch {
    /* backup failure must not block save */
  }
}

function createCompactBackupBody(body: string) {
  try {
    const root = JSON.parse(body) as { state?: Record<string, unknown> };
    const state = root && typeof root === "object" ? root.state : null;
    if (state && typeof state === "object") {
      delete state.materials;
    }
    return JSON.stringify(root);
  } catch {
    return body;
  }
}

function isBackupFile(name: string) {
  return (
    name.startsWith(BACKUP_PREFIX) && (name.endsWith(BACKUP_JSON_SUFFIX) || name.endsWith(BACKUP_GZIP_SUFFIX))
  );
}

function isSafeBackupName(name: string) {
  return /^marketing-quote-[-0-9TZ]+\.json(\.gz)?$/.test(name);
}

function pruneBackupFiles() {
  if (!fs.existsSync(backupDir)) return;
  const files = fs
    .readdirSync(backupDir)
    .filter(isBackupFile)
    .map((f) => ({ f, t: fs.statSync(path.join(backupDir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (const old of files.slice(MAX_BACKUPS)) {
    try {
      fs.unlinkSync(path.join(backupDir, old.f));
    } catch {
      /* ignore */
    }
  }
}

function listBackupFiles(): { name: string; mtime: string; size: number }[] {
  if (!fs.existsSync(backupDir)) return [];
  pruneBackupFiles();
  return fs
    .readdirSync(backupDir)
    .filter(isBackupFile)
    .map((f) => {
      const st = fs.statSync(path.join(backupDir, f));
      return { name: f, mtime: st.mtime.toISOString(), size: st.size };
    })
    .sort((a, b) => b.mtime.localeCompare(a.mtime));
}

function persistApiMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const raw = req.url ?? "";
    const pathname = raw.split("?")[0] ?? "";
    if (pathname === "/api/quote-persist/backups") {
      if (req.method !== "GET") {
        res.statusCode = 405;
        res.end();
        return;
      }
      try {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.end(JSON.stringify({ files: listBackupFiles() }));
      } catch (e) {
        res.statusCode = 500;
        res.end(e instanceof Error ? e.message : "backup list error");
      }
      return;
    }

    const backupRead = pathname.match(/^\/api\/quote-persist\/backups\/([^/]+)$/);
    if (backupRead) {
      const name = decodeURIComponent(backupRead[1] ?? "");
      if (!isSafeBackupName(name)) {
        res.statusCode = 400;
        res.end("invalid backup name");
        return;
      }
      const filePath = path.join(backupDir, name);
      if (req.method !== "GET") {
        res.statusCode = 405;
        res.end();
        return;
      }
      try {
        if (!fs.existsSync(filePath)) {
          res.statusCode = 404;
          res.end();
          return;
        }
        const data = name.endsWith(BACKUP_GZIP_SUFFIX)
          ? gunzipSync(fs.readFileSync(filePath)).toString("utf8")
          : fs.readFileSync(filePath, "utf8");
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.end(data);
      } catch (e) {
        res.statusCode = 500;
        res.end(e instanceof Error ? e.message : "backup read error");
      }
      return;
    }

    if (pathname !== "/api/quote-persist") {
      next();
      return;
    }

    if (req.method === "GET") {
      try {
        if (!fs.existsSync(persistPath)) {
          res.statusCode = 404;
          res.end();
          return;
        }
        const data = fs.readFileSync(persistPath, "utf8");
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.end(data);
      } catch (e) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end(e instanceof Error ? e.message : "persist read error");
      }
      return;
    }

    if (req.method === "DELETE") {
      try {
        if (fs.existsSync(persistPath)) fs.unlinkSync(persistPath);
        res.statusCode = 204;
        res.end();
      } catch (e) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end(e instanceof Error ? e.message : "persist delete error");
      }
      return;
    }

    if (req.method === "PUT" || req.method === "POST") {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer | string) => {
        chunks.push(typeof c === "string" ? Buffer.from(c) : c);
      });
      req.on("end", () => {
        try {
          const body = Buffer.concat(chunks).toString("utf8");
          fs.mkdirSync(persistDir, { recursive: true });
          if (fs.existsSync(persistPath)) {
            try {
              const previousBody = fs.readFileSync(persistPath, "utf8");
              if (previousBody !== body) writeTimestampedBackup(previousBody);
            } catch {
              /* ignore */
            }
          }
          fs.writeFileSync(persistPath, body, "utf8");
          res.statusCode = 204;
          res.end();
        } catch (e) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.end(e instanceof Error ? e.message : "persist write error");
        }
      });
      req.on("error", () => {
        res.statusCode = 500;
        res.end();
      });
      return;
    }

    res.statusCode = 405;
    res.end();
  };
}

/** Dev + `vite preview`: expose REST so the SPA can persist to `data/marketing-quote-v1.json`. */
export function quotePersistFileApiPlugin(): Plugin {
  const attach = (server: { middlewares: Connect.Server }) => {
    server.middlewares.use(persistApiMiddleware());
  };
  return {
    name: "quote-persist-file-api",
    configureServer: attach,
    configurePreviewServer: attach,
  };
}
