"use client";

import { useEffect, useRef, useState } from "react";

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

/** Wheel and trackpad scrolling as whole steps (a page at a time): deltas
 *  add up to a threshold, then one step, and the rest of that gesture —
 *  trackpad inertia, a spun wheel — is swallowed until the wheel goes quiet.
 *  When `canStep` says no (already at the end), the event is left to bubble
 *  so an outer pager can take it; once a gesture has stepped it stays ours.
 *  `axis: "x"` only answers sideways scrolling. */
export function useWheelStep({
  axis,
  canStep,
  onStep,
}: {
  axis: "x" | "both";
  canStep: (dir: 1 | -1) => boolean;
  onStep: (dir: 1 | -1) => void;
}) {
  const gesture = useRef<{ acc: number; spent: boolean; timer: ReturnType<typeof setTimeout> | null }>({
    acc: 0,
    spent: false,
    timer: null,
  });
  return (e: React.WheelEvent) => {
    const g = gesture.current;
    const sideways = Math.abs(e.deltaX) > Math.abs(e.deltaY);
    if (axis === "x" && !sideways && !g.spent) return;
    // line/page delta modes (some mice, firefox) → roughly pixels
    const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const d = (sideways ? e.deltaX : e.deltaY) * scale;
    if (!d) return;
    const dir = d > 0 ? 1 : -1;
    if (!g.spent && !canStep(dir)) return;
    e.stopPropagation();
    if (g.timer) clearTimeout(g.timer);
    g.timer = setTimeout(() => {
      g.acc = 0;
      g.spent = false;
    }, 160);
    if (g.spent) return;
    g.acc += d;
    if (Math.abs(g.acc) >= 40) {
      g.spent = true;
      g.acc = 0;
      onStep(dir);
    }
  };
}
