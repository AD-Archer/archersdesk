import { NextRequest, NextResponse } from "next/server";
import { isUser, requireUser } from "@/lib/api";
import { getUserSettings } from "@/lib/settings";
import { subsonicUrl } from "@/lib/navidrome";

// Proxies Subsonic cover art the same way stream/route.ts proxies audio —
// credentials stay server-side, art doesn't change so it's cached hard.

const VALID_ID = /^[\w-]+$/;

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!isUser(user)) return user;

  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!VALID_ID.test(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const settings = getUserSettings(user.id);
  const nd = settings.integrations.navidrome;
  if (!nd.url || !nd.username || !nd.password)
    return NextResponse.json({ error: "navidrome not configured" }, { status: 400 });

  const target = subsonicUrl(nd, "getCoverArt", { id, size: "300" });
  let upstream: Response;
  try {
    upstream = await fetch(target, { signal: AbortSignal.timeout(9000) });
  } catch {
    return NextResponse.json({ error: "navidrome unreachable" }, { status: 502 });
  }
  if (!upstream.ok) return NextResponse.json({ error: `navidrome: error ${upstream.status}` }, { status: upstream.status });

  // Subsonic reports auth/not-found errors as a 200 JSON/XML envelope, not an
  // HTTP error status — catch that here rather than streaming it as an image.
  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/"))
    return NextResponse.json({ error: "navidrome: unexpected response" }, { status: 502 });

  const headers = new Headers();
  headers.set("content-type", contentType);
  headers.set("cache-control", "private, max-age=86400");
  return new Response(upstream.body, { status: 200, headers });
}
