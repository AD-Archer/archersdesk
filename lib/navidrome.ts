// Subsonic API client for Navidrome — token auth (salt + md5(password+salt))
// so the plaintext password never goes on the wire to the media server.
// Used by lib/integrations.ts (browse/search JSON) and the stream/cover
// proxy routes (binary passthrough), which build their own request URL via
// subsonicUrl() since they don't go through subsonicFetch's JSON envelope.

import crypto from "crypto";

export interface NavidromeCreds {
  url: string;
  username: string;
  password: string;
}

export interface NavidromeSong {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  coverArt: string;
}

export interface NavidromeAlbum {
  id: string;
  name: string;
  artist: string;
  coverArt: string;
  songCount: number;
}

export interface NavidromePlaylist {
  id: string;
  name: string;
  songCount: number;
}

const CLIENT = "archersdesk";
const API_VERSION = "1.16.1";

function authParams(nd: NavidromeCreds): Record<string, string> {
  const salt = crypto.randomBytes(6).toString("hex");
  const token = crypto.createHash("md5").update(nd.password + salt).digest("hex");
  return { u: nd.username, t: token, s: salt, v: API_VERSION, c: CLIENT };
}

/** Build an authenticated Subsonic REST URL for `endpoint` (e.g. "stream", "getCoverArt"). */
export function subsonicUrl(nd: NavidromeCreds, endpoint: string, params: Record<string, string> = {}): string {
  const qs = new URLSearchParams({ ...authParams(nd), ...params });
  return `${nd.url.replace(/\/+$/, "")}/rest/${endpoint}.view?${qs.toString()}`;
}

type SubsonicResult = { ok: true; data: unknown } | { ok: false; reason: string };

/** Fetch a JSON Subsonic endpoint and unwrap the `subsonic-response` envelope. */
export async function subsonicFetch(
  nd: NavidromeCreds,
  endpoint: string,
  params: Record<string, string> = {}
): Promise<SubsonicResult> {
  const url = subsonicUrl(nd, endpoint, { ...params, f: "json" });
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(9000) });
  } catch {
    return { ok: false, reason: "navidrome unreachable" };
  }
  if (res.status === 401) return { ok: false, reason: "navidrome rejected that username or password" };
  if (!res.ok) return { ok: false, reason: `navidrome: error ${res.status}` };

  let body: { "subsonic-response"?: { status?: string; error?: { message?: string } } };
  try {
    body = await res.json();
  } catch {
    return { ok: false, reason: "navidrome: invalid response" };
  }
  const sr = body["subsonic-response"];
  if (!sr) return { ok: false, reason: "navidrome: invalid response" };
  if (sr.status !== "ok") return { ok: false, reason: `navidrome: ${sr.error?.message ?? "request failed"}` };
  return { ok: true, data: sr };
}

function toSong(s: {
  id: string;
  title?: string;
  artist?: string;
  album?: string;
  duration?: number;
  coverArt?: string;
}): NavidromeSong {
  return {
    id: s.id,
    title: s.title ?? "",
    artist: s.artist ?? "",
    album: s.album ?? "",
    duration: s.duration ?? 0,
    coverArt: s.coverArt ?? "",
  };
}

function toAlbum(a: { id: string; name?: string; artist?: string; coverArt?: string; songCount?: number }): NavidromeAlbum {
  return { id: a.id, name: a.name ?? "", artist: a.artist ?? "", coverArt: a.coverArt ?? "", songCount: a.songCount ?? 0 };
}

function toPlaylist(p: { id: string; name?: string; songCount?: number }): NavidromePlaylist {
  return { id: p.id, name: p.name ?? "", songCount: p.songCount ?? 0 };
}

export async function navidromePlaylists(nd: NavidromeCreds): Promise<SubsonicResult> {
  const res = await subsonicFetch(nd, "getPlaylists");
  if (!res.ok) return res;
  const raw = (res.data as { playlists?: { playlist?: unknown[] } }).playlists?.playlist ?? [];
  return { ok: true, data: (raw as Parameters<typeof toPlaylist>[0][]).map(toPlaylist) };
}

export async function navidromeRecentAlbums(nd: NavidromeCreds, size = 20): Promise<SubsonicResult> {
  const res = await subsonicFetch(nd, "getAlbumList2", { type: "recent", size: String(size) });
  if (!res.ok) return res;
  const raw = (res.data as { albumList2?: { album?: unknown[] } }).albumList2?.album ?? [];
  return { ok: true, data: (raw as Parameters<typeof toAlbum>[0][]).map(toAlbum) };
}

export async function navidromeSearch(nd: NavidromeCreds, query: string): Promise<SubsonicResult> {
  const res = await subsonicFetch(nd, "search3", { query, songCount: "25", albumCount: "12", artistCount: "0" });
  if (!res.ok) return res;
  const result = (res.data as { searchResult3?: { song?: unknown[]; album?: unknown[] } }).searchResult3 ?? {};
  return {
    ok: true,
    data: {
      songs: ((result.song ?? []) as Parameters<typeof toSong>[0][]).map(toSong),
      albums: ((result.album ?? []) as Parameters<typeof toAlbum>[0][]).map(toAlbum),
    },
  };
}

export async function navidromeAlbumSongs(nd: NavidromeCreds, id: string): Promise<SubsonicResult> {
  const res = await subsonicFetch(nd, "getAlbum", { id });
  if (!res.ok) return res;
  const raw = (res.data as { album?: { song?: unknown[] } }).album?.song ?? [];
  return { ok: true, data: (raw as Parameters<typeof toSong>[0][]).map(toSong) };
}

export async function navidromePlaylistSongs(nd: NavidromeCreds, id: string): Promise<SubsonicResult> {
  const res = await subsonicFetch(nd, "getPlaylist", { id });
  if (!res.ok) return res;
  const raw = (res.data as { playlist?: { entry?: unknown[] } }).playlist?.entry ?? [];
  return { ok: true, data: (raw as Parameters<typeof toSong>[0][]).map(toSong) };
}
