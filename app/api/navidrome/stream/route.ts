import { NextRequest, NextResponse } from "next/server";
import { isUser, requireUser } from "@/lib/api";
import { getUserSettings } from "@/lib/settings";
import { subsonicUrl } from "@/lib/navidrome";

// Proxies Subsonic audio bytes — the stream url itself carries no Navidrome
// credentials, unlike the account settings the client already holds for every
// integration. Range passthrough gives the <audio> element real seek support.

const VALID_ID = /^[\w-]+$/;
const PASSTHROUGH_HEADERS = ["content-type", "content-length", "content-range", "accept-ranges", "cache-control"];

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!isUser(user)) return user;

  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!VALID_ID.test(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const settings = getUserSettings(user.id);
  const nd = settings.integrations.navidrome;
  if (!nd.url || !nd.username || !nd.password)
    return NextResponse.json({ error: "navidrome not configured" }, { status: 400 });

  const target = subsonicUrl(nd, "stream", { id });
  const range = req.headers.get("range");
  let upstream: Response;
  try {
    upstream = await fetch(target, { headers: range ? { Range: range } : {}, signal: AbortSignal.timeout(15000) });
  } catch {
    return NextResponse.json({ error: "navidrome unreachable" }, { status: 502 });
  }
  if (!upstream.ok && upstream.status !== 206)
    return NextResponse.json({ error: `navidrome: error ${upstream.status}` }, { status: upstream.status });

  // Subsonic reports auth/not-found errors as a 200 JSON/XML envelope, not an
  // HTTP error status — catch that here rather than streaming it as "audio".
  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.startsWith("audio/"))
    return NextResponse.json({ error: "navidrome: unexpected response" }, { status: 502 });

  const headers = new Headers();
  for (const h of PASSTHROUGH_HEADERS) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (!headers.has("accept-ranges")) headers.set("accept-ranges", "bytes");

  return new Response(upstream.body, { status: upstream.status, headers });
}
