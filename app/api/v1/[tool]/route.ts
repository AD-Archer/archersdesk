import { NextRequest, NextResponse } from "next/server";
import { ScopeError, ToolError, callTool } from "@/lib/mcp/tools";
import { authenticate } from "@/lib/mcp/tokens";

// The MCP tools as plain REST, for scripts and anything that speaks OpenAPI
// rather than MCP: POST /api/v1/<tool> with the arguments as the json body.
// Same tokens, same scopes (see /openapi.json).

export async function POST(req: NextRequest, { params }: { params: Promise<{ tool: string }> }) {
  const ctx = authenticate(req.headers.get("authorization"));
  if (!ctx)
    return NextResponse.json(
      { error: "a desk token is needed: settings → MCP makes one" },
      { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="archers-desk"' } }
    );
  const { tool } = await params;
  const args = await req.json().catch(() => ({}));
  try {
    return NextResponse.json({ result: await callTool(tool, args, ctx) });
  } catch (e) {
    if (e instanceof ToolError) return NextResponse.json({ error: e.message }, { status: e instanceof ScopeError ? 403 : 400 });
    console.error(`api ${tool}:`, e);
    return NextResponse.json({ error: "the desk hit an error doing that" }, { status: 500 });
  }
}
