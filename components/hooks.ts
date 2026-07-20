"use client";

import { useEffect, useState } from "react";

const pollCache = new Map<string, { at: number; data: unknown }>();
const pollInflight = new Map<string, Promise<unknown>>();

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** False during SSR + hydration, true after mount — gate second-precision
 *  output on this so server and client markup can't disagree. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function useNow(ms = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** Poll a JSON endpoint; refetches on an interval and when the tab wakes. */
export function usePoll<T>(url: string | null, ms: number, deps: unknown[] = []): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let dead = false;
    if (!url) {
      setData(null);
      return () => {
        dead = true;
      };
    }
    const key = `${url}|${JSON.stringify(deps)}`;
    const cached = pollCache.get(key);
    if (cached) setData(cached.data as T);

    const go = () => {
      const fresh = pollCache.get(key);
      if (fresh && Date.now() - fresh.at < Math.min(ms, 15_000)) {
        if (!dead) setData(fresh.data as T);
        return;
      }
      const existing = pollInflight.get(key);
      const req =
        existing ??
        fetch(url)
          .then(async (r) => {
            const text = await r.text();
            let body: unknown = null;
            try {
              body = text ? JSON.parse(text) : null;
            } catch {
              body = null;
            }
            if (!r.ok) {
              if (isRecord(body) && typeof body.reason === "string") return body;
              if (isRecord(body) && typeof body.error === "string")
                return { ...body, configured: false, reason: body.error };
              return { configured: false, reason: `request failed (${r.status})` };
            }
            return body;
          })
          .then((d) => {
            pollCache.set(key, { at: Date.now(), data: d });
            return d;
          })
          .finally(() => pollInflight.delete(key));
      pollInflight.set(key, req);
      req
        .then((d) => {
          if (!dead) setData(d as T);
        })
        .catch(() => {});
    };
    const initial = setTimeout(go, cached ? 1200 : 250);
    const id = setInterval(go, ms);
    const onVis = () => document.visibilityState === "visible" && go();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      dead = true;
      clearTimeout(initial);
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ms, ...deps]);
  return data;
}

/** Keep the screen awake — this thing lives on an always-on display. */
export function useWakeLock() {
  useEffect(() => {
    type WakeLockSentinel = { release(): Promise<void> };
    let lock: WakeLockSentinel | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: { request(type: "screen"): Promise<WakeLockSentinel> };
    };
    const acquire = () => {
      nav.wakeLock
        ?.request("screen")
        .then((l) => (lock = l))
        .catch(() => {});
    };
    acquire();
    const onVis = () => document.visibilityState === "visible" && acquire();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      lock?.release().catch(() => {});
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
}
