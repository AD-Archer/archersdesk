import type {
  FeedService,
  IntegrationPayload,
  IntegrationService,
  ProxyService,
  Settings,
} from "./types";

// ── integration fetchers ─────────────────────────────────────────────
// Each service is one entry: { ttl, fetch(settings) } returning the standard
// envelope. Adding a service = an entry here + a widget on the client kit +
// (if it needs credentials) a field in settings → accounts. That's it.

const g = globalThis as typeof globalThis & {
  __deskIntegrations?: Map<string, { at: number; body: IntegrationPayload }>;
  __deskIntegrationInflight?: Map<string, Promise<IntegrationPayload>>;
};
const cache = (g.__deskIntegrations ??= new Map());
const inflight = (g.__deskIntegrationInflight ??= new Map());

const UA = { "User-Agent": "archersdesk/0.1 (personal dashboard)" };

function need(reason: string): IntegrationPayload {
  return { configured: false, reason };
}

function grab(url: string, headers: Record<string, string> = {}, init: RequestInit = {}) {
  return fetch(url, { ...init, headers: { ...UA, ...headers }, signal: AbortSignal.timeout(9000) });
}

// event type → short verb for the activity list
const GH_VERBS: Record<string, string> = {
  PushEvent: "pushed",
  CreateEvent: "created",
  PullRequestEvent: "PR",
  IssuesEvent: "issue",
  IssueCommentEvent: "commented",
  WatchEvent: "starred",
  ForkEvent: "forked",
  ReleaseEvent: "released",
  PullRequestReviewEvent: "reviewed",
};

const WAKATIME_DEFAULT_API = "https://api.wakatime.com/api/v1";

function normalizeApiBase(url: string, fallback: string) {
  const trimmed = (url || fallback).trim().replace(/\/+$/, "");
  if (trimmed === "https://wakatime.com/api/v1") return WAKATIME_DEFAULT_API;
  return trimmed;
}

function wakaItems(items: unknown, count = 3) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item): item is { name?: string; text?: string; percent?: number } => Boolean(item?.name))
    .slice(0, count)
    .map((item) => ({
      name: item.name ?? "",
      text: item.text ?? "",
      percent: typeof item.percent === "number" ? item.percent : null,
    }));
}

interface Fetcher {
  ttl: number; // ms
  fetch(settings: Settings): Promise<IntegrationPayload>;
}

export const INTEGRATIONS: Record<IntegrationService, Fetcher> = {
  github: {
    ttl: 5 * 60 * 1000,
    async fetch(settings) {
      const { username, token } = settings.integrations.github;
      if (!username) return need("add your github username in settings → accounts");
      const auth: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const [evRes, profRes, streakRes] = await Promise.all([
        grab(`https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=60`, auth),
        grab(`https://api.github.com/users/${encodeURIComponent(username)}`, auth),
        // community streak service (same data as the readme streak cards)
        grab(`https://streak-stats.demolab.com/?user=${encodeURIComponent(username)}&type=json`).catch(
          () => null
        ),
      ]);
      if (evRes.status === 404) return need(`github user "${username}" not found`);
      if (evRes.status === 400) return need("github: bad request — check the username/token");
      if (!evRes.ok)
        return need(`github: ${evRes.status === 403 ? "rate limited — add a token" : `error ${evRes.status}`}`);
      const events = (await evRes.json()) as Array<{
        type: string;
        repo?: { name: string };
        created_at: string;
        payload?: { commits?: unknown[] };
      }>;
      const profile = profRes.ok
        ? ((await profRes.json()) as { followers?: number; public_repos?: number; name?: string })
        : {};
      let streak: { current: number; longest: number; total: number } | null = null;
      if (streakRes?.ok) {
        try {
          const s = await streakRes.json();
          streak = {
            current: s?.currentStreak?.length ?? 0,
            longest: s?.longestStreak?.length ?? 0,
            total: s?.totalContributions ?? 0,
          };
        } catch {
          streak = null;
        }
      }
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const recent = events.filter((e) => new Date(e.created_at).getTime() > dayAgo);
      const commits = recent
        .filter((e) => e.type === "PushEvent")
        .reduce((n, e) => n + (e.payload?.commits?.length ?? 0), 0);
      const latest = events.slice(0, 3).map((e) => ({
        verb: GH_VERBS[e.type] ?? "did",
        repo: e.repo?.name?.split("/")[1] ?? e.repo?.name ?? "",
      }));
      return {
        configured: true,
        data: {
          username,
          today: recent.length,
          commits,
          repos: new Set(recent.map((e) => e.repo?.name)).size,
          latest,
          followers: profile.followers ?? null,
          publicRepos: profile.public_repos ?? null,
          streak,
        },
      };
    },
  },

  septa: {
    ttl: 60 * 1000,
    async fetch(settings) {
      const { station } = settings.integrations.septa;
      if (!station) return need("set your septa station in settings → accounts");
      const res = await grab(
        `https://api.septa.org/api/Arrivals/index.php?station=${encodeURIComponent(station)}&results=8`
      );
      if (!res.ok) return need(`septa: error ${res.status}`);
      const j = await res.json();
      const firstKey = Object.keys(j ?? {})[0];
      if (!firstKey) return need(`no arrivals found — check the station name ("${station}")`);
      interface SeptaTrain {
        line: string;
        destination: string;
        sched_time: string;
        depart_time: string;
        status: string;
        track: string;
        direction: string;
      }
      const groups = (j[firstKey] ?? []) as Array<Record<string, SeptaTrain[]>>;
      const trains = groups
        .flatMap((g) => Object.values(g).flat())
        .map((t) => ({
          line: t.line,
          destination: t.destination,
          at: new Date(t.depart_time || t.sched_time).getTime(),
          status: t.status === "On Time" ? "on time" : (t.status ?? "").toLowerCase(),
          track: t.track,
        }))
        .filter((t) => Number.isFinite(t.at))
        .sort((a, b) => a.at - b.at)
        .slice(0, 5);
      if (!trains.length) return need(`no upcoming trains at "${station}" right now`);
      return { configured: true, data: { station: firstKey.split(" Departures")[0], trains } };
    },
  },

  jellyfin: {
    ttl: 60 * 1000,
    async fetch(settings) {
      const { url, apiKey, username, password } = settings.integrations.jellyfin;
      if (!url) return need("set your jellyfin url in settings → accounts");
      if (!apiKey && (!username || !password))
        return need("set a jellyfin api key or username + password in settings → accounts");

      let token = apiKey;
      if (!token) {
        const auth = await grab(
          `${url}/Users/AuthenticateByName`,
          {
            "Content-Type": "application/json",
            Authorization: 'MediaBrowser Client="archersdesk", Device="dashboard", DeviceId="archersdesk", Version="0.1"',
          },
          {
            method: "POST",
            body: JSON.stringify({ Username: username, Pw: password }),
          }
        );
        if (auth.status === 401) return need("jellyfin rejected that username or password");
        if (!auth.ok) return need(`jellyfin login: error ${auth.status}`);
        token = ((await auth.json()) as { AccessToken?: string }).AccessToken ?? "";
        if (!token) return need("jellyfin login did not return a token");
      }

      const res = await grab(`${url}/Sessions`, { Authorization: `MediaBrowser Token="${token}"` });
      if (res.status === 401) return need(apiKey ? "jellyfin rejected that api key" : "jellyfin rejected that login");
      if (!res.ok) return need(`jellyfin: error ${res.status}`);
      const sessions = (await res.json()) as Array<{
        UserName?: string;
        NowPlayingItem?: { Name?: string; SeriesName?: string; Type?: string };
      }>;
      const playing = sessions
        .filter((s) => s.NowPlayingItem)
        .map((s) => ({
          user: s.UserName ?? "someone",
          title: s.NowPlayingItem!.SeriesName
            ? `${s.NowPlayingItem!.SeriesName} · ${s.NowPlayingItem!.Name}`
            : (s.NowPlayingItem!.Name ?? ""),
        }));
      return { configured: true, data: { server: "jellyfin", playing } };
    },
  },

  plex: {
    ttl: 60 * 1000,
    async fetch(settings) {
      const { url, token } = settings.integrations.plex;
      if (!url || !token) return need("set your plex url + token in settings → accounts");
      const res = await grab(`${url}/status/sessions`, {
        Accept: "application/json",
        "X-Plex-Token": token,
      });
      if (res.status === 401) return need("plex rejected that token");
      if (!res.ok) return need(`plex: error ${res.status}`);
      const j = await res.json();
      const meta = (j?.MediaContainer?.Metadata ?? []) as Array<{
        title?: string;
        grandparentTitle?: string;
        User?: { title?: string };
      }>;
      const playing = meta.map((m) => ({
        user: m.User?.title ?? "someone",
        title: m.grandparentTitle ? `${m.grandparentTitle} · ${m.title}` : (m.title ?? ""),
      }));
      return { configured: true, data: { server: "plex", playing } };
    },
  },

  chess: {
    ttl: 5 * 60 * 1000,
    async fetch(settings) {
      const { username } = settings.integrations.chess;
      if (!username) return need("add your chess.com username in settings → accounts");
      const res = await grab(`https://api.chess.com/pub/player/${encodeURIComponent(username.toLowerCase())}/stats`);
      if (res.status === 404) return need(`chess.com user "${username}" not found`);
      if (res.status === 400) return need("chess.com: bad request — check the username");
      if (!res.ok) return need(`chess.com: error ${res.status}`);
      const s = await res.json();
      const modes = [
        { key: "rapid", v: s.chess_rapid },
        { key: "blitz", v: s.chess_blitz },
        { key: "bullet", v: s.chess_bullet },
        { key: "daily", v: s.chess_daily },
      ]
        .filter((m) => m.v?.last?.rating)
        .map((m) => ({
          mode: m.key,
          rating: m.v.last.rating as number,
          best: (m.v.best?.rating as number) ?? null,
          record: m.v.record ? `${m.v.record.win}w ${m.v.record.loss}l ${m.v.record.draw}d` : "",
        }));
      if (!modes.length) return need(`no rated games for "${username}" yet`);
      const top = [...modes].sort((a, b) => b.rating - a.rating)[0];
      return { configured: true, data: { username, top, modes, puzzles: s.tactics?.highest?.rating ?? null } };
    },
  },

  stocks: {
    ttl: 2 * 60 * 1000,
    async fetch(settings) {
      const symbols = settings.integrations.stocks.symbols.slice(0, 6);
      if (!symbols.length) return need("add tickers in settings → accounts");
      const quotes = await Promise.all(
        symbols.map(async (sym) => {
          try {
            const res = await grab(
              `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=15m`
            );
            if (!res.ok) return { sym, error: true };
            const meta = (await res.json())?.chart?.result?.[0]?.meta;
            if (!meta?.regularMarketPrice) return { sym, error: true };
            const prev = meta.chartPreviousClose ?? meta.previousClose ?? meta.regularMarketPrice;
            const price = meta.regularMarketPrice as number;
            return { sym, price, changePct: prev ? ((price - prev) / prev) * 100 : 0 };
          } catch {
            return { sym, error: true };
          }
        })
      );
      if (quotes.every((q) => "error" in q && q.error)) return need("quotes unavailable right now");
      return { configured: true, data: { quotes } };
    },
  },

  anilist: {
    ttl: 10 * 60 * 1000,
    async fetch(settings) {
      const { username } = settings.integrations.anilist;
      if (!username) return need("add your anilist username in settings → accounts");
      const query = `query($name:String){ User(name:$name){ name statistics{
        anime{ count episodesWatched minutesWatched meanScore }
        manga{ count chaptersRead }
      } } }`;
      const res = await grab("https://graphql.anilist.co", { "Content-Type": "application/json" }, {
        method: "POST",
        body: JSON.stringify({ query, variables: { name: username } }),
      });
      const body = await res.json();
      if (body.errors || !body.data?.User) return need(`anilist user "${username}" not found`);
      const a = body.data.User.statistics.anime;
      const m = body.data.User.statistics.manga;
      return {
        configured: true,
        data: {
          username: body.data.User.name,
          animeCount: a.count,
          episodes: a.episodesWatched,
          daysWatched: Math.round(a.minutesWatched / 1440),
          meanScore: a.meanScore,
          mangaCount: m.count,
          chapters: m.chaptersRead,
        },
      };
    },
  },

  wakatime: {
    ttl: 5 * 60 * 1000,
    async fetch(settings) {
      const { apiKey, apiUrl } = settings.integrations.wakatime;
      if (!apiKey) return need("add your wakatime api key in settings → accounts");
      // apiUrl points at any wakatime-compatible server (wakapi, hackatime…).
      // Path and auth scheme differ between implementations: wakatime.com uses
      // status_bar + Basic, wakapi/hackatime use statusbar and often Bearer —
      // walk the combinations until one answers.
      const base = normalizeApiBase(apiUrl, WAKATIME_DEFAULT_API);
      const attempts = [
        { path: "summaries?range=Today", auth: `Basic ${Buffer.from(apiKey).toString("base64")}` },
        { path: "summaries?range=Today", auth: `Bearer ${apiKey}` },
        { path: "status_bar/today", auth: `Basic ${Buffer.from(apiKey).toString("base64")}` },
        { path: "statusbar/today", auth: `Basic ${Buffer.from(apiKey).toString("base64")}` },
        { path: "status_bar/today", auth: `Bearer ${apiKey}` },
        { path: "statusbar/today", auth: `Bearer ${apiKey}` },
      ];
      let res: Response | null = null;
      for (const a of attempts) {
        res = await grab(`${base}/users/current/${a.path}`, { Authorization: a.auth });
        if (res.ok) break;
      }
      if (!res) return need("wakatime unreachable");
      if (res.status === 401) return need("wakatime rejected that api key");
      if (!res.ok) return need(`wakatime: error ${res.status} — check the api url`);
      const body = await res.json();
      const d = body?.data?.grand_total ? body.data : body?.data?.[0];
      const langs = wakaItems(d?.languages).filter((l) => l.name !== "Other");
      return {
        configured: true,
        data: {
          total: d?.grand_total?.text || "0 mins",
          langs,
          projects: wakaItems(d?.projects),
          operatingSystems: wakaItems(d?.operating_systems),
          editors: wakaItems(d?.editors),
          categories: wakaItems(d?.categories),
        },
      };
    },
  },
};

// ── keyless public feeds ─────────────────────────────────────────────
// Same contract as INTEGRATIONS but no credentials — random critters,
// headlines, and location-aware feeds (which read settings.location).

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

// city-bike network directory barely changes — cache it for a day
let bikeNetworks: { at: number; list: Array<{ id: string; name: string; lat: number; lon: number }> } | null = null;

async function picture(url: string, extract: (j: unknown) => { src: string; caption?: string }) {
  const res = await grab(url);
  if (!res.ok) return need("feed unavailable right now");
  return { configured: true, data: extract(await res.json()) };
}

export const OPEN_FEEDS: Record<FeedService, Fetcher> = {
  dog: {
    ttl: 90 * 1000,
    fetch: () =>
      picture("https://dog.ceo/api/breeds/image/random", (j) => {
        const src = (j as { message: string }).message;
        const breed = src.match(/breeds\/([^/]+)\//)?.[1]?.replace(/-/g, " ") ?? "";
        return { src, caption: breed };
      }),
  },
  cat: {
    ttl: 90 * 1000,
    fetch: () =>
      picture("https://cataas.com/cat?json=true", (j) => {
        const o = j as { _id?: string; id?: string; tags?: string[] };
        const id = o._id ?? o.id ?? "";
        return { src: `https://cataas.com/cat/${id}`, caption: o.tags?.[0] ?? "cat" };
      }),
  },
  fox: {
    ttl: 90 * 1000,
    fetch: () => picture("https://randomfox.ca/floof/", (j) => ({ src: (j as { image: string }).image, caption: "fox" })),
  },
  duck: {
    ttl: 90 * 1000,
    fetch: () => picture("https://random-d.uk/api/v2/random", (j) => ({ src: (j as { url: string }).url, caption: "duck" })),
  },
  shibe: {
    ttl: 90 * 1000,
    fetch: () =>
      picture("https://shibe.online/api/shibes?count=1", (j) => ({ src: (j as string[])[0], caption: "shibe" })),
  },

  catfact: {
    ttl: 10 * 60 * 1000,
    async fetch() {
      const res = await grab("https://catfact.ninja/fact");
      if (!res.ok) return need("cat facts unavailable");
      const j = await res.json();
      return { configured: true, data: { fact: j.fact, source: "catfact.ninja" } };
    },
  },
  dogfact: {
    ttl: 10 * 60 * 1000,
    async fetch() {
      const res = await grab("https://dogapi.dog/api/v2/facts?limit=1");
      if (!res.ok) return need("dog facts unavailable");
      const j = await res.json();
      return { configured: true, data: { fact: j?.data?.[0]?.attributes?.body ?? "", source: "dogapi.dog" } };
    },
  },

  spacenews: {
    ttl: 10 * 60 * 1000,
    async fetch() {
      const res = await grab("https://api.spaceflightnewsapi.net/v4/articles/?limit=4");
      if (!res.ok) return need("spaceflight news unavailable");
      const j = await res.json();
      return {
        configured: true,
        data: {
          articles: (j.results ?? []).map((a: { title: string; news_site: string; published_at: string }) => ({
            title: a.title,
            site: a.news_site,
            at: a.published_at,
          })),
        },
      };
    },
  },

  f1: {
    ttl: 30 * 60 * 1000,
    async fetch() {
      // jolpica is the maintained ergast-compatible mirror
      const [raceRes, standRes] = await Promise.all([
        grab("https://api.jolpi.ca/ergast/f1/current/next.json"),
        grab("https://api.jolpi.ca/ergast/f1/current/driverstandings.json"),
      ]);
      const race = raceRes.ok
        ? (await raceRes.json())?.MRData?.RaceTable?.Races?.[0]
        : null;
      const standings = standRes.ok
        ? ((await standRes.json())?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? [])
        : [];
      if (!race && !standings.length) return need("f1 data unavailable");
      return {
        configured: true,
        data: {
          next: race
            ? { name: race.raceName, circuit: race.Circuit?.circuitName ?? "", date: race.date, time: race.time ?? "" }
            : null,
          top: standings.slice(0, 3).map((s: { Driver: { familyName: string }; points: string; position: string }) => ({
            pos: s.position,
            driver: s.Driver.familyName,
            points: s.points,
          })),
        },
      };
    },
  },

  citybikes: {
    ttl: 3 * 60 * 1000,
    async fetch(settings) {
      const { latitude, longitude } = settings.location;
      if (!bikeNetworks || Date.now() - bikeNetworks.at > 24 * 60 * 60 * 1000) {
        const res = await grab("https://api.citybik.es/v2/networks?fields=id,name,location");
        if (!res.ok) return need("citybikes unavailable");
        const j = await res.json();
        bikeNetworks = {
          at: Date.now(),
          list: (j.networks ?? []).map(
            (n: { id: string; name: string; location: { latitude: number; longitude: number } }) => ({
              id: n.id,
              name: n.name,
              lat: n.location.latitude,
              lon: n.location.longitude,
            })
          ),
        };
      }
      const nearest = [...bikeNetworks.list].sort(
        (a, b) => haversineKm(latitude, longitude, a.lat, a.lon) - haversineKm(latitude, longitude, b.lat, b.lon)
      )[0];
      if (!nearest || haversineKm(latitude, longitude, nearest.lat, nearest.lon) > 80)
        return need("no bike share near your location");
      const res = await grab(`https://api.citybik.es/v2/networks/${nearest.id}`);
      if (!res.ok) return need("citybikes unavailable");
      const stations = ((await res.json())?.network?.stations ?? []) as Array<{
        name: string;
        latitude: number;
        longitude: number;
        free_bikes: number;
        empty_slots: number;
      }>;
      const close = stations
        .map((s) => ({ ...s, km: haversineKm(latitude, longitude, s.latitude, s.longitude) }))
        .sort((a, b) => a.km - b.km)
        .slice(0, 4)
        .map((s) => ({ name: s.name, bikes: s.free_bikes, slots: s.empty_slots, km: Math.round(s.km * 10) / 10 }));
      return { configured: true, data: { network: nearest.name, stations: close } };
    },
  },

  flights: {
    ttl: 5 * 60 * 1000,
    async fetch(settings) {
      const { latitude, longitude } = settings.location;
      const d = 0.7; // ~ 50 mile box
      const res = await grab(
        `https://opensky-network.org/api/states/all?lamin=${latitude - d}&lomin=${longitude - d}&lamax=${latitude + d}&lomax=${longitude + d}`
      );
      if (!res.ok) return need("opensky is busy — try again soon");
      const j = await res.json();
      const states = (j?.states ?? []) as Array<Array<unknown>>;
      const planes = states
        .map((s) => ({
          callsign: String(s[1] ?? "").trim(),
          altFt: typeof s[7] === "number" ? Math.round((s[7] as number) * 3.281) : null,
          country: String(s[2] ?? ""),
        }))
        .filter((p) => p.callsign)
        .sort((a, b) => (a.altFt ?? 99999) - (b.altFt ?? 99999));
      return { configured: true, data: { count: states.length, planes: planes.slice(0, 3) } };
    },
  },
};

const ALL_SERVICES: Record<string, Fetcher> = { ...INTEGRATIONS, ...OPEN_FEEDS };

export function isProxyService(s: string): s is ProxyService {
  return s in ALL_SERVICES;
}

export async function runIntegration(
  service: ProxyService,
  userId: number,
  settings: Settings
): Promise<IntegrationPayload> {
  const entry = ALL_SERVICES[service];
  // credentials + location are part of the key so edits refetch immediately
  const creds =
    service in INTEGRATIONS ? settings.integrations[service as IntegrationService] : settings.location;
  const key = `${userId}|${service}|${JSON.stringify(creds)}`;
  if (cache.size > 500) cache.clear();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < entry.ttl) return hit.body;
  const pending = inflight.get(key);
  if (pending) return pending;
  const req = entry
    .fetch(settings)
    .catch((err: unknown) => {
      const reason =
        err instanceof Error && err.name === "TimeoutError"
          ? `${service} timed out`
          : err instanceof Error
            ? `${service} unreachable right now (${err.message})`
            : `${service} unreachable right now`;
      return { configured: true, reason };
    })
    .then((result) => {
      cache.set(key, { at: Date.now(), body: result });
      return result;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, req);
  return req;
}
