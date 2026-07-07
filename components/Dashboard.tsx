"use client";

import { useEffect, useRef, useState } from "react";
import type { Alarm, DeskConfig } from "@/lib/types";
import { MainView } from "./widgets/registry";
import Standby from "./Standby";
import SettingsSheet from "./SettingsSheet";
import AlarmOverlay from "./AlarmOverlay";
import { alarmMatches } from "./alarmUtil";
import { unlockAudio } from "./audio";
import { useWakeLock } from "./hooks";

const PAGES = 2; // 0 = widgets, 1 = standby

export default function Dashboard({ username }: { username: string }) {
  const [config, setConfig] = useState<DeskConfig | null>(null);
  const [yaml, setYaml] = useState("");
  const [page, setPage] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ringing, setRinging] = useState<Alarm | null>(null);

  const start = useRef<{ x: number; id: number } | null>(null);
  const cfgRef = useRef<DeskConfig | null>(null);
  const ringingRef = useRef<Alarm | null>(null);
  const fired = useRef<Set<string>>(new Set());
  const snooze = useRef<{ at: number; alarm: Alarm } | null>(null);

  cfgRef.current = config;
  ringingRef.current = ringing;

  useWakeLock();

  // load the user's yaml config
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        setConfig(d.config);
        setYaml(d.yaml);
      })
      .catch(() => {});
  }, []);

  // browsers gate audio behind a gesture — unlock on the first touch
  useEffect(() => {
    window.addEventListener("pointerdown", unlockAudio, { once: true });
    return () => window.removeEventListener("pointerdown", unlockAudio);
  }, []);

  // alarm engine: tick once a second, ring on match (once per minute-key)
  useEffect(() => {
    const id = setInterval(() => {
      if (ringingRef.current) return;
      const now = new Date();
      if (snooze.current && now.getTime() >= snooze.current.at) {
        setRinging(snooze.current.alarm);
        snooze.current = null;
        return;
      }
      const cfg = cfgRef.current;
      if (!cfg) return;
      for (const a of cfg.alarms) {
        if (!alarmMatches(a, now)) continue;
        const key = `${now.toDateString()}|${a.time}|${a.label}`;
        if (fired.current.has(key)) continue;
        fired.current.add(key);
        setRinging(a);
        break;
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // arrow keys page too (handy on desktop)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setPage((p) => Math.min(PAGES - 1, p + 1));
      if (e.key === "ArrowLeft") setPage((p) => Math.max(0, p - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("button, input, textarea, a")) return;
    start.current = { x: e.clientX, id: e.pointerId };
    setDrag(0);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!start.current || e.pointerId !== start.current.id) return;
    setDrag(e.clientX - start.current.x);
  }
  function onPointerUp(e: React.PointerEvent) {
    if (!start.current || e.pointerId !== start.current.id) return;
    const dx = e.clientX - start.current.x;
    start.current = null;
    setDrag(null);
    const threshold = Math.min(80, window.innerWidth * 0.1);
    if (dx < -threshold) setPage((p) => Math.min(PAGES - 1, p + 1));
    else if (dx > threshold) setPage((p) => Math.max(0, p - 1));
  }

  if (!config) {
    return (
      <main className="stage" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "var(--dim)", fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 20 }}>
          warming up…
        </span>
      </main>
    );
  }

  return (
    <main>
      <div
        className="stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className={`pager-track${drag === null ? " animate" : ""}`}
          style={{ transform: `translateX(calc(${-page * 100}% + ${drag ?? 0}px))` }}
        >
          <section className="page">
            <MainView config={config} />
          </section>
          <section className="page">
            <Standby config={config} />
          </section>
        </div>
      </div>

      <button className="gear" onClick={() => setSettingsOpen(true)} aria-label="settings">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
          <circle cx="12" cy="12" r="3.2" />
          <path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.6 7.6 0 0 0 7 6.5l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 2.6-1.5l2.4 1 2-3.4z" />
        </svg>
      </button>

      <div className="dots">
        {Array.from({ length: PAGES }, (_, i) => (
          <i key={i} className={i === page ? "on" : ""} />
        ))}
      </div>

      <SettingsSheet
        open={settingsOpen}
        yaml={yaml}
        username={username}
        onClose={() => setSettingsOpen(false)}
        onSaved={(y, c) => {
          setYaml(y);
          setConfig(c);
        }}
      />

      {ringing && (
        <AlarmOverlay
          alarm={ringing}
          onSnooze={() => {
            snooze.current = { at: Date.now() + 5 * 60 * 1000, alarm: ringing };
            setRinging(null);
          }}
          onDismiss={() => setRinging(null)}
        />
      )}
    </main>
  );
}
