import Database from "better-sqlite3";
import { env } from "./env";

// Cached on globalThis so Next's dev-mode module reloads reuse one handle.
const g = globalThis as typeof globalThis & { __deskDb?: Database.Database };

export function getDb(): Database.Database {
  if (!g.__deskDb) {
    const db = new Database(env.dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.exec(`
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
      DROP TABLE IF EXISTS configs;
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    `);
    g.__deskDb = db;
  }
  return g.__deskDb;
}
