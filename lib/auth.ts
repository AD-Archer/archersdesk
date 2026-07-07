import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { getDb } from "./db";
import { DEFAULT_YAML } from "./config";
import { env } from "./env";

export const SESSION_COOKIE = "desk_session";
const SESSION_DAYS = 60;

// ── env-provisioned account ──────────────────────────────────────────
// ADMIN_USERNAME / ADMIN_PASSWORD (compose env or infisical) bootstrap an
// account on first boot and keep its password in sync with the env value.
function seedEnvUser() {
  const { adminUsername: username, adminPassword: password } = env;
  if (!username || !password) return;
  if (validateCredentials(username, password)) {
    console.warn("[archersdesk] ADMIN_USERNAME/ADMIN_PASSWORD invalid — skipping seed");
    return;
  }
  const db = getDb();
  const row = db
    .prepare("SELECT id, password_hash FROM users WHERE username = ?")
    .get(username) as { id: number; password_hash: string } | undefined;
  if (!row) {
    const info = db
      .prepare("INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)")
      .run(username, bcrypt.hashSync(password, 10), Date.now());
    db.prepare("INSERT INTO configs (user_id, yaml, updated_at) VALUES (?, ?, ?)").run(
      Number(info.lastInsertRowid),
      DEFAULT_YAML,
      Date.now()
    );
    console.log(`[archersdesk] seeded account "${username}" from env`);
  } else if (!bcrypt.compareSync(password, row.password_hash)) {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
      bcrypt.hashSync(password, 10),
      row.id
    );
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(row.id);
    console.log(`[archersdesk] password for "${username}" updated from env`);
  }
}

const g = globalThis as typeof globalThis & { __deskSeeded?: boolean };
if (!g.__deskSeeded) {
  g.__deskSeeded = true;
  seedEnvUser();
}

export interface User {
  id: number;
  username: string;
}

export function validateCredentials(username: unknown, password: unknown): string | null {
  if (typeof username !== "string" || !/^[a-zA-Z0-9_.-]{2,32}$/.test(username))
    return "username must be 2–32 characters (letters, numbers, _ . -)";
  if (typeof password !== "string" || password.length < 6)
    return "password must be at least 6 characters";
  return null;
}

export async function registerUser(username: string, password: string): Promise<User | "taken"> {
  const db = getDb();
  const hash = await bcrypt.hash(password, 10);
  try {
    const info = db
      .prepare("INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)")
      .run(username, hash, Date.now());
    const id = Number(info.lastInsertRowid);
    db.prepare("INSERT INTO configs (user_id, yaml, updated_at) VALUES (?, ?, ?)").run(
      id,
      DEFAULT_YAML,
      Date.now()
    );
    return { id, username };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("UNIQUE")) return "taken";
    throw err;
  }
}

export async function verifyUser(username: string, password: string): Promise<User | null> {
  const db = getDb();
  const row = db
    .prepare("SELECT id, username, password_hash FROM users WHERE username = ?")
    .get(username) as { id: number; username: string; password_hash: string } | undefined;
  if (!row) return null;
  const ok = await bcrypt.compare(password, row.password_hash);
  return ok ? { id: row.id, username: row.username } : null;
}

export function createSession(userId: number): { token: string; maxAge: number } {
  const db = getDb();
  const token = crypto.randomBytes(32).toString("hex");
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  db.prepare("INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)").run(
    token,
    userId,
    Date.now() + maxAge * 1000,
    Date.now()
  );
  // opportunistic cleanup of expired sessions
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
  return { token, maxAge };
}

export function getSessionUser(token: string | undefined): User | null {
  if (!token) return null;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT u.id, u.username FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`
    )
    .get(token, Date.now()) as User | undefined;
  return row ?? null;
}

export function destroySession(token: string | undefined) {
  if (!token) return;
  getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
}
