import { NextRequest, NextResponse } from "next/server";
import { isUser, requireUser } from "@/lib/api";
import { getUserConfig } from "@/lib/config";
import { env } from "@/lib/env";

// Last.fm recent tracks — Navidrome scrobbles land here. The API key comes
// from the user's YAML (lastfm.api_key) or the server-wide LASTFM_API_KEY
// secret (injected by Infisical). Cached 15s per user to be polite.

const g = globalThis as typeof globalThis & {
  __deskLastfm?: Map<number, { at: number; body: unknown; status: number }>;
};
const cache = (g.__deskLastfm ??= new Map());
const TTL = 15 * 1000;

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!isUser(user)) return user;

  const hit = cache.get(user.id);
  if (hit && Date.now() - hit.at < TTL)
    return NextResponse.json(hit.body as object, { status: hit.status });

  const { config } = getUserConfig(user.id);
  const username = config.lastfm.username;
  const apiKey = config.lastfm.api_key || env.lastfmApiKey;

  const respond = (body: object, status = 200) => {
    cache.set(user.id, { at: Date.now(), body, status });
    return NextResponse.json(body, { status });
  };

  if (!username)
    return respond({ configured: false, reason: "set lastfm.username in your config" });
  if (!apiKey)
    return respond({
      configured: false,
      reason: "no last.fm api key — set lastfm.api_key in your config or LASTFM_API_KEY on the server",
    });

  try {
    const res = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(username)}` +
        `&api_key=${encodeURIComponent(apiKey)}&format=json&limit=1&extended=1`,
      { signal: AbortSignal.timeout(8000) }
    );
    const data = await res.json();
    if (data.error)
      return respond({ configured: false, reason: `last.fm: ${data.message || "error " + data.error}` });

    const track = data?.recenttracks?.track?.[0];
    if (!track) return respond({ configured: true, playing: false, track: null });

    const images: Array<{ size: string; "#text": string }> = track.image ?? [];
    const art =
      images.find((i) => i.size === "extralarge")?.["#text"] ||
      images.find((i) => i.size === "large")?.["#text"] ||
      "";

    return respond({
      configured: true,
      playing: track["@attr"]?.nowplaying === "true",
      track: {
        name: track.name ?? "",
        artist: track.artist?.name ?? track.artist?.["#text"] ?? "",
        album: track.album?.["#text"] ?? "",
        art,
        url: track.url ?? "",
        playedAt: track.date?.uts ? Number(track.date.uts) * 1000 : null,
      },
    });
  } catch {
    return respond({ configured: true, playing: false, track: null, reason: "last.fm unreachable" }, 200);
  }
}
