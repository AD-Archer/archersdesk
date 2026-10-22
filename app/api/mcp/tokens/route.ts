import { NextRequest, NextResponse } from "next/server";
import { isUser, requireUser } from "@/lib/api";
import { MCP_SCOPES, type McpScope } from "@/lib/mcp/scopes";
import { createToken, listTokens } from "@/lib/mcp/tokens";
import { getUserSettings } from "@/lib/settings";

// The signed-in account's MCP tokens (settings → MCP). Listing never shows a
// token; making one returns it this once.

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!isUser(user)) return user;
  return NextResponse.json({ tokens: listTokens(user.id) });
}

export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!isUser(user)) return user;
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim().slice(0, 40);
  if (!name) return NextResponse.json({ error: "give the token a name" }, { status: 400 });
  const scopes = (Array.isArray(body.scopes) ? body.scopes : []).filter((s: unknown): s is McpScope =>
    (MCP_SCOPES as readonly string[]).includes(String(s))
  );
  if (!scopes.length) return NextResponse.json({ error: "pick at least one thing it can do" }, { status: 400 });
  const known = new Set(getUserSettings(user.id).devices.map((d) => d.id));
  const screens = (Array.isArray(body.screens) ? body.screens : []).map(String).filter((id: string) => known.has(id));
  return NextResponse.json(createToken(user.id, name, scopes, screens));
}
