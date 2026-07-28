CREATE TABLE IF NOT EXISTS persist_documents (
  id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL,
  byte_size INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS persist_backups (
  name TEXT PRIMARY KEY,
  object_key TEXT NOT NULL,
  byte_size INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS persist_backups_created_idx ON persist_backups(created_at DESC);
