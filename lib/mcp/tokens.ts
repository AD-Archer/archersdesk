import crypto from "node:crypto";
import { getDb } from "../db";
import { MCP_SCOPES, type McpScope, type McpTokenInfo } from "./scopes";

// Per-account MCP tokens. A token is shown once, when it's made; the database
// keeps only its sha-256, so a leaked db doesn't leak access. Each token
// carries its scopes and, optionally, the screens it may touch.

const PREFIX = "desk_";

/** Who a request is, once its bearer token checks out. */
export interface McpContext {
  userId: number;
  tokenId: string;
  scopes: Set<McpScope>;
  screens: string[]; // empty = every screen
}

interface Row {
  id: string;
  user_id: number;
  name: string;
  scopes: string;
  screens: string;
  created_at: number;
  last_used_at: number | null;
}

const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

function parseList(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function info(r: Row): McpTokenInfo {
  return {
    id: r.id,
    name: r.name,
    scopes: parseList(r.scopes).filter((s): s is McpScope => (MCP_SCOPES as readonly string[]).includes(s)),
    screens: parseList(r.screens),
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at,
  };
}

export function listTokens(userId: number): McpTokenInfo[] {
  const rows = getDb()
    .prepare("SELECT * FROM mcp_tokens WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId) as Row[];
  return rows.map(info);
}

/** Make a token; the plain token comes back this once and is never stored. */
export function createToken(
  userId: number,
  name: string,
  scopes: McpScope[],
  screens: string[]
): { token: string; info: McpTokenInfo } {
  const token = PREFIX + crypto.randomBytes(32).toString("base64url");
  const id = crypto.randomUUID();
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO mcp_tokens (id, user_id, name, token_hash, scopes, screens, created_at, last_used_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`
    )
    .run(id, userId, name, hash(token), JSON.stringify(scopes), JSON.stringify(screens), now);
  return {
    token,
    info: { id, name, scopes, screens, createdAt: now, lastUsedAt: null },
  };
}

export function revokeToken(userId: number, id: string): boolean {
  return getDb().prepare("DELETE FROM mcp_tokens WHERE id = ? AND user_id = ?").run(id, userId).changes > 0;
}

/** The context for an `Authorization: Bearer desk_…` header, or null. */
export function authenticate(header: string | null): McpContext | null {
  const m = /^Bearer\s+(\S+)$/i.exec(header ?? "");
  if (!m || !m[1].startsWith(PREFIX)) return null;
  const db = getDb();
  const row = db.prepare("SELECT * FROM mcp_tokens WHERE token_hash = ?").get(hash(m[1])) as Row | undefined;
  if (!row) return null;
  db.prepare("UPDATE mcp_tokens SET last_used_at = ? WHERE id = ?").run(Date.now(), row.id);
  const t = info(row);
  return { userId: row.user_id, tokenId: row.id, scopes: new Set(t.scopes), screens: t.screens };
}
