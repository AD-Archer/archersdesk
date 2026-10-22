import Database from "better-sqlite3";
import { env } from "./env";

// Cached on globalThis so Next's dev-mode module reloads reuse one handle.
const g = globalThis as typeof globalThis & { __deskDb?: Database.Database };
// The schema runs once per load of this module rather than once per handle,
// so a table added here exists after a dev reload, not only after a restart.
let migrated = false;

export function getDb(): Database.Database {
  if (!g.__deskDb) {
    const db = new Database(env.dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    g.__deskDb = db;
  }
  if (!migrated) {
    g.__deskDb.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        created_at    INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token      TEXT PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (
        user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        data       TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      -- MCP access tokens: only a hash is kept; scopes and screens are json
      -- arrays (screens empty = every screen). See lib/mcp/tokens.ts.
      CREATE TABLE IF NOT EXISTS mcp_tokens (
        id           TEXT PRIMARY KEY,
        user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name         TEXT NOT NULL,
        token_hash   TEXT NOT NULL UNIQUE,
        scopes       TEXT NOT NULL,
        screens      TEXT NOT NULL,
        created_at   INTEGER NOT NULL,
        last_used_at INTEGER
      );
      DROP TABLE IF EXISTS configs;
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_mcp_tokens_user ON mcp_tokens(user_id);
    `);
    migrated = true;
  }
  return g.__deskDb;
}
