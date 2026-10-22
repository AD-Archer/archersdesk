import { NextRequest, NextResponse } from "next/server";
import { openapi } from "@/lib/mcp/openapi";

// public: it describes the api, it doesn't open it
export function GET(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  return NextResponse.json(openapi(`${proto}://${host}`), { headers: { "Access-Control-Allow-Origin": "*" } });
}
