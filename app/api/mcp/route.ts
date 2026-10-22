import { NextRequest, NextResponse } from "next/server";
import { INSTRUCTIONS, TOOLS, ToolError, allowed, callTool } from "@/lib/mcp/tools";
import { authenticate, type McpContext } from "@/lib/mcp/tokens";

// The desk's MCP server: Streamable HTTP, stateless, JSON responses (no SSE
// stream, nothing to resume). One endpoint for every account; the bearer
// token says whose desk it is, what it may do and which screens it reaches.
// Tools live in lib/mcp/tools.ts.

const VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

interface RpcMessage {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

const reply = (id: RpcMessage["id"], result: unknown) => ({ jsonrpc: "2.0", id, result });
const error = (id: RpcMessage["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

async function handle(msg: RpcMessage, ctx: McpContext) {
  const { id, method, params } = msg;
  switch (method) {
    case "initialize": {
      const asked = String(params?.protocolVersion ?? "");
      return reply(id, {
        protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "archers-desk", title: "archer's desk", version: "1.0.0" },
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return reply(id, {});
    case "tools/list":
      return reply(id, {
        tools: TOOLS.filter((t) => allowed(t, ctx)).map((t) => ({
          name: t.name,
          title: t.title,
          description: t.description,
          inputSchema: t.input,
          annotations: { title: t.title, ...t.annotations },
        })),
      });
    case "tools/call": {
      const name = String(params?.name ?? "");
      try {
        const result = await callTool(name, params?.arguments, ctx);
        return reply(id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: Array.isArray(result) || typeof result !== "object" ? { result } : result,
          isError: false,
        });
      } catch (e) {
        // a caller's mistake is the tool's answer, so the model can fix it
        if (e instanceof ToolError) return reply(id, { content: [{ type: "text", text: e.message }], isError: true });
        console.error(`mcp ${name}:`, e);
        return reply(id, { content: [{ type: "text", text: "the desk hit an error doing that" }], isError: true });
      }
    }
    default:
      return error(id, -32601, `no method ${method}`);
  }
}

export async function POST(req: NextRequest) {
  const ctx = authenticate(req.headers.get("authorization"));
  if (!ctx)
    return NextResponse.json(error(null, -32001, "a desk token is needed: settings → MCP makes one"), {
      status: 401,
      headers: { "WWW-Authenticate": 'Bearer realm="archers-desk"' },
    });

  const body = await req.json().catch(() => undefined);
  if (body === undefined) return NextResponse.json(error(null, -32700, "that isn't json"), { status: 400 });
  const batch = Array.isArray(body);
  const messages: RpcMessage[] = batch ? body : [body];

  const out = [];
  for (const m of messages) {
    if (!m || typeof m !== "object" || m.jsonrpc !== "2.0") out.push(error(null, -32600, "not a json-rpc 2.0 message"));
    // notifications (no id) and responses get no answer
    else if (m.method && m.id !== undefined && m.id !== null) out.push(await handle(m, ctx));
  }
  if (!out.length) return new NextResponse(null, { status: 202 });
  return NextResponse.json(batch ? out : out[0]);
}

// no server-to-client stream and no sessions to end
export function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}

export function DELETE() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
