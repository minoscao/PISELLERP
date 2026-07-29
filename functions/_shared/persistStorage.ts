export type PersistEnv = {
  DB: {
    prepare(query: string): {
      bind(...values: unknown[]): {
        first<T>(): Promise<T | null>;
        all<T>(): Promise<{ results: T[] }>;
        run(): Promise<unknown>;
      };
      all<T>(): Promise<{ results: T[] }>;
      run(): Promise<unknown>;
    };
    batch(statements: Array<{ run(): Promise<unknown> } | { first<T>(): Promise<T | null> }>): Promise<unknown>;
  };
  R2: {
    get(key: string): Promise<StoredObject | null>;
    put(key: string, value: ReadableStream | ArrayBuffer | string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
    delete(keys: string | string[]): Promise<void>;
  };
};

export type StoredObject = {
  body: ReadableStream;
  size: number;
  httpMetadata?: { contentType?: string };
  writeHttpMetadata(headers: Headers): void;
};

type PersistDocument = { object_key: string; byte_size: number; updated_at: string };
type PersistBackup = { name: string; object_key: string; byte_size: number; created_at: string };

const DOCUMENT_ID = "marketing-quote-v1";
const STATE_OBJECT_KEY = "erp-state/marketing-quote-v1.json";
const MAX_BACKUPS = 5;

export async function ensurePersistSchema(env: PersistEnv) {
  await env.DB.batch([
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS persist_documents (id TEXT PRIMARY KEY, object_key TEXT NOT NULL, byte_size INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)",
    ),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS persist_backups (name TEXT PRIMARY KEY, object_key TEXT NOT NULL, byte_size INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)",
    ),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS persist_backups_created_idx ON persist_backups(created_at DESC)"),
  ]);
}

export async function getPersistState(env: PersistEnv): Promise<StoredObject | null> {
  await ensurePersistSchema(env);
  const record = await env.DB
    .prepare("SELECT object_key, byte_size, updated_at FROM persist_documents WHERE id = ?")
    .bind(DOCUMENT_ID)
    .first<PersistDocument>();
  return env.R2.get(record?.object_key || STATE_OBJECT_KEY);
}

export async function putPersistState(request: Request, env: PersistEnv): Promise<void> {
  await ensurePersistSchema(env);
  if (!request.body) throw new Error("missing request body");

  const existing = await env.R2.get(STATE_OBJECT_KEY);
  const now = new Date().toISOString();
  if (existing) {
    const name = `marketing-quote-${now.replace(/[:.]/g, "-")}.json`;
    const objectKey = `erp-state/backups/${name}`;
    await env.R2.put(objectKey, existing.body, {
      httpMetadata: { contentType: existing.httpMetadata?.contentType || "application/json; charset=utf-8" },
    });
    await env.DB
      .prepare("INSERT INTO persist_backups (name, object_key, byte_size, created_at) VALUES (?, ?, ?, ?)")
      .bind(name, objectKey, existing.size, now)
      .run();
  }

  const declaredSize = Number(request.headers.get("content-length") || 0);
  await env.R2.put(STATE_OBJECT_KEY, request.body, {
    httpMetadata: { contentType: request.headers.get("content-type") || "application/json; charset=utf-8" },
  });
  await env.DB
    .prepare(
      "INSERT INTO persist_documents (id, object_key, byte_size, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET object_key = excluded.object_key, byte_size = excluded.byte_size, updated_at = excluded.updated_at",
    )
    .bind(DOCUMENT_ID, STATE_OBJECT_KEY, Number.isFinite(declaredSize) ? declaredSize : 0, now)
    .run();

  const backups = await listPersistBackups(env);
  const stale = backups.slice(MAX_BACKUPS);
  if (stale.length) {
    await env.R2.delete(stale.map((item) => item.object_key));
    await Promise.all(stale.map((item) => env.DB.prepare("DELETE FROM persist_backups WHERE name = ?").bind(item.name).run()));
  }
}

export async function deletePersistState(env: PersistEnv): Promise<void> {
  await ensurePersistSchema(env);
  await env.R2.delete(STATE_OBJECT_KEY);
  await env.DB.prepare("DELETE FROM persist_documents WHERE id = ?").bind(DOCUMENT_ID).run();
}

export async function listPersistBackups(env: PersistEnv): Promise<PersistBackup[]> {
  await ensurePersistSchema(env);
  const result = await env.DB
    .prepare("SELECT name, object_key, byte_size, created_at FROM persist_backups ORDER BY created_at DESC")
    .all<PersistBackup>();
  return result.results;
}

export async function getPersistBackup(name: string, env: PersistEnv): Promise<StoredObject | null> {
  await ensurePersistSchema(env);
  const backup = await env.DB
    .prepare("SELECT name, object_key, byte_size, created_at FROM persist_backups WHERE name = ?")
    .bind(name)
    .first<PersistBackup>();
  return backup ? env.R2.get(backup.object_key) : null;
}

export function isSafeBackupName(name: string): boolean {
  return /^marketing-quote-[-0-9TZ]+\.json$/.test(name);
}
