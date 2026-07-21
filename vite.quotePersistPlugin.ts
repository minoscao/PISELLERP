import fs from "node:fs";
import path from "node:path";
import type { Connect, Plugin } from "vite";

/** Same basename as Zustand persist key `name` in `quoteStore.ts`. */
export const QUOTE_PERSIST_FILE = "marketing-quote-v1.json";

const persistDir = path.resolve(process.cwd(), "data");
const persistPath = path.join(persistDir, QUOTE_PERSIST_FILE);
const backupDir = path.join(persistDir, "backups");
const MAX_BACKUPS = 20;

function writeTimestampedBackup(body: string) {
  try {
    fs.mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    fs.writeFileSync(path.join(backupDir, `marketing-quote-${stamp}.json`), body, "utf8");
    const files = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith("marketing-quote-") && f.endsWith(".json"))
      .map((f) => ({ f, t: fs.statSync(path.join(backupDir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    for (const old of files.slice(MAX_BACKUPS)) {
      try {
        fs.unlinkSync(path.join(backupDir, old.f));
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* backup failure must not block save */
  }
}

function listBackupFiles(): { name: string; mtime: string; size: number }[] {
  if (!fs.existsSync(backupDir)) return [];
  return fs
    .readdirSync(backupDir)
    .filter((f) => f.startsWith("marketing-quote-") && f.endsWith(".json"))
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
      if (!/^marketing-quote-[-0-9TZ]+\.json$/.test(name)) {
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
        const data = fs.readFileSync(filePath, "utf8");
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
              writeTimestampedBackup(fs.readFileSync(persistPath, "utf8"));
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
