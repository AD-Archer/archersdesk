"use client";

import { useEffect, useState } from "react";

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
export function usePoll<T>(url: string, ms: number, deps: unknown[] = []): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let dead = false;
    const go = () =>
      fetch(url)
        .then((r) => r.json())
        .then((d) => {
          if (!dead) setData(d);
        })
        .catch(() => {});
    go();
    const id = setInterval(go, ms);
    const onVis = () => document.visibilityState === "visible" && go();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      dead = true;
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
