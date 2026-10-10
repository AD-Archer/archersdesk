import { NextRequest, NextResponse } from "next/server";
import { isUser, requireUser } from "@/lib/api";
import { compressImage } from "@/lib/images";
import { getUserSettings } from "@/lib/settings";

const g = globalThis as typeof globalThis & { __macapadIcons?: Map<string, Buffer> };
const cache = (g.__macapadIcons ??= new Map());

// App icons for macapad buttons. The tablet can't call the mac itself (the
// token stays on the server), so this fetches the png from macapad and hands
// it on with a long cache — an <img src="/api/macapad/app-icon?bundleId=…">.
// The png is recompressed to a webp (alpha kept, 512px so it stays sharp on
// a big pad page key) and kept in memory.

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!isUser(user)) return user;

  const bundleId = req.nextUrl.searchParams.get("bundleId") ?? "";
  if (!/^[\w.-]{1,200}$/.test(bundleId)) return NextResponse.json({ error: "bad bundleId" }, { status: 400 });

  const headers = { "Content-Type": "image/webp", "Cache-Control": "private, max-age=604800" };
  const hit = cache.get(`${user.id}|${bundleId}`);
  if (hit) return new NextResponse(new Uint8Array(hit), { headers });

  const { url, token } = getUserSettings(user.id).integrations.macapad;
  if (!url || !token) return NextResponse.json({ error: "macapad isn't set up" }, { status: 404 });

  try {
    const res = await fetch(`${url}/api/apps/icon?bundleId=${encodeURIComponent(bundleId)}&size=512`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return NextResponse.json({ error: `macapad: error ${res.status}` }, { status: res.status === 404 ? 404 : 502 });
    const icon = await compressImage(Buffer.from(await res.arrayBuffer()), 512);
    if (cache.size > 400) cache.clear();
    cache.set(`${user.id}|${bundleId}`, icon);
    return new NextResponse(new Uint8Array(icon), { headers });
  } catch {
    return NextResponse.json({ error: "can't reach your mac" }, { status: 502 });
  }
}
