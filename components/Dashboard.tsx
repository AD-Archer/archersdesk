"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { WIDGET_PAGE_COUNT } from "@/lib/types";
import type { Alarm, LayoutRow, Settings } from "@/lib/types";
import { MainRow, WidgetPanel } from "./widgets/registry";
import Standby from "./Standby";
import SettingsSheet from "./SettingsSheet";
import AlarmOverlay from "./AlarmOverlay";
import { alarmMatches } from "./alarmUtil";
import { unlockAudio } from "./audio";
import { useWakeLock } from "./hooks";

const PAGES = 1 + WIDGET_PAGE_COUNT; // 0 = standby, 1..n = widget pages
type PaneSide = "left" | "right";
type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};
type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

function widgetPages(settings: Settings): LayoutRow[][] {
  return Array.from(
    { length: WIDGET_PAGE_COUNT },
    (_, i) => settings.layout.pages?.[i] ?? settings.layout.rows
  );
}

export default function Dashboard({
  username,
  initialSettings,
}: {
  username: string;
  initialSettings: Settings;
}) {
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [savedSettings, setSavedSettings] = useState<Settings>(initialSettings);
  const [page, setPage] = useState(0);
  const initialPages = widgetPages(initialSettings);
  const [leftRows, setLeftRows] = useState(() => initialPages.map(() => 0));
  const [rightRows, setRightRows] = useState(() => initialPages.map(() => 0));
  const [activeDualRows, setActiveDualRows] = useState<Array<number | null>>(
    () => initialPages.map((rows) => (rows[0]?.type === "dual" ? 0 : null))
  );
  const [drag, setDrag] = useState<number | null>(null); // horizontal px
  const [dragY, setDragY] = useState<{ pageIndex: number; side: PaneSide; dy: number } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [ringing, setRinging] = useState<Alarm | null>(null);

  const start = useRef<{
    x: number;
    y: number;
    id: number;
    axis: "h" | "v" | null;
    side: PaneSide;
  } | null>(null);
  const settingsRef = useRef<Settings>(settings);
  const pageRef = useRef(page);
  const leftRowsRef = useRef(leftRows);
  const rightRowsRef = useRef(rightRows);
  const activeDualRowsRef = useRef(activeDualRows);
  const ringingRef = useRef<Alarm | null>(null);
  const fired = useRef<Set<string>>(new Set());
  const snooze = useRef<{ at: number; alarm: Alarm } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  settingsRef.current = settings;
  pageRef.current = page;
  leftRowsRef.current = leftRows;
  rightRowsRef.current = rightRows;
  activeDualRowsRef.current = activeDualRows;
  ringingRef.current = ringing;

  const pages = widgetPages(settings);
  const activeWidgetPage = Math.max(0, page - 1);
  const activeRows = pages[activeWidgetPage] ?? pages[0] ?? [];

  useWakeLock();

  // keep pane row indices valid when rows are removed in settings
  useEffect(() => {
    const nextLeft = pages.map((rows, i) => Math.min(leftRows[i] ?? 0, Math.max(0, rows.length - 1)));
    const nextRight = pages.map((rows, i) => Math.min(rightRows[i] ?? 0, Math.max(0, rows.length - 1)));
    const nextDual = pages.map((rows, i) => {
      const current = activeDualRows[i];
      if (current !== null && current !== undefined && current <= rows.length - 1 && rows[current]?.type === "dual") {
        return current;
      }
      return rows[nextLeft[i]]?.type === "dual"
        ? nextLeft[i]
        : rows[nextRight[i]]?.type === "dual"
          ? nextRight[i]
          : null;
    });
    if (JSON.stringify(leftRows) !== JSON.stringify(nextLeft)) setLeftRows(nextLeft);
    if (JSON.stringify(rightRows) !== JSON.stringify(nextRight)) setRightRows(nextRight);
    if (JSON.stringify(activeDualRows) !== JSON.stringify(nextDual)) setActiveDualRows(nextDual);
  }, [pages, leftRows, rightRows, activeDualRows]);

  // theme is a document-level attribute so every layer (body glow, sheet,
  // overlays) swaps palette together — applied live while tapping
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  // track fullscreen state (echo show / browser chrome)
  useEffect(() => {
    const doc = document as FullscreenDocument;
    const el = document.documentElement as FullscreenElement;
    setCanFullscreen(Boolean(el.requestFullscreen || el.webkitRequestFullscreen));
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement || doc.webkitFullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("webkitfullscreenchange", onFs);
    };
  }, []);

  function toggleFullscreen() {
    unlockAudio();
    const doc = document as FullscreenDocument;
    const el = document.documentElement as FullscreenElement;
    if (document.fullscreenElement || doc.webkitFullscreenElement) {
      document.exitFullscreen().catch(() => {});
      doc.webkitExitFullscreen?.();
    } else {
      const request = el.requestFullscreen
        ? () => el.requestFullscreen({ navigationUI: "hide" })
        : el.webkitRequestFullscreen
          ? () => el.webkitRequestFullscreen?.()
          : null;
      request?.()?.catch?.(() => {});
    }
    // re-request inside the gesture — some browsers only grant it here
    (navigator as Navigator & { wakeLock?: { request(t: "screen"): Promise<unknown> } }).wakeLock
      ?.request("screen")
      .catch(() => {});
  }

  // every settings change autosaves (debounced) — no save button anywhere
  function updateSettings(next: Settings) {
    settingsRef.current = next;
    setSettings(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settings: settingsRef.current }),
        });
        if (res.ok) {
          setSavedSettings(settingsRef.current);
          setSaved(true);
          if (savedTimer.current) clearTimeout(savedTimer.current);
          savedTimer.current = setTimeout(() => setSaved(false), 1800);
        }
      } catch {
        // offline — settings still live locally, next change retries
      }
    }, 600);
  }

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
      for (const a of settingsRef.current.alarms) {
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

  // arrow keys on desktop: ←→ pages, ↑↓ rows
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowRight") setPage((p) => Math.min(PAGES - 1, p + 1));
      if (e.key === "ArrowLeft") setPage((p) => Math.max(0, p - 1));
      if (e.key === "ArrowDown" && pageRef.current > 0) moveBothRows(pageRef.current - 1, 1);
      if (e.key === "ArrowUp" && pageRef.current > 0) moveBothRows(pageRef.current - 1, -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function wrapRowIndex(index: number, sourceRows: LayoutRow[]) {
    if (sourceRows.length === 0) return 0;
    return (index + sourceRows.length) % sourceRows.length;
  }

  function moveBothRows(pageIndex: number, delta: number) {
    const sourceRows = widgetPages(settingsRef.current)[pageIndex] ?? [];
    const current =
      activeDualRowsRef.current[pageIndex] ??
      (leftRowsRef.current[pageIndex] === rightRowsRef.current[pageIndex]
        ? leftRowsRef.current[pageIndex]
        : Math.max(leftRowsRef.current[pageIndex] ?? 0, rightRowsRef.current[pageIndex] ?? 0));
    const next = wrapRowIndex(current + delta, sourceRows);
    if (sourceRows[next]?.type === "dual") {
      setActiveDualRows((all) => all.map((v, i) => (i === pageIndex ? next : v)));
    } else {
      setActiveDualRows((all) => all.map((v, i) => (i === pageIndex ? null : v)));
      setLeftRows((all) => all.map((v, i) => (i === pageIndex ? next : v)));
      setRightRows((all) => all.map((v, i) => (i === pageIndex ? next : v)));
    }
  }

  function movePaneRow(pageIndex: number, side: PaneSide, delta: number) {
    const pageRows = pages[pageIndex] ?? [];
    const current = activeDualRows[pageIndex] ?? (side === "left" ? leftRows[pageIndex] : rightRows[pageIndex]) ?? 0;
    const next = wrapRowIndex(current + delta, pageRows);
    if (pageRows[next]?.type === "dual") {
      setActiveDualRows((all) => all.map((v, i) => (i === pageIndex ? next : v)));
    } else if (side === "left") {
      setActiveDualRows((all) => all.map((v, i) => (i === pageIndex ? null : v)));
      setLeftRows((all) => all.map((v, i) => (i === pageIndex ? next : v)));
    } else {
      setActiveDualRows((all) => all.map((v, i) => (i === pageIndex ? null : v)));
      setRightRows((all) => all.map((v, i) => (i === pageIndex ? next : v)));
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("button, input, textarea, a, label")) return;
    // swipes starting on a panel steer that panel's stack; swipes starting on
    // the background (screen edges included) steer whichever half they're in
    const slot = (e.target as HTMLElement).closest<HTMLElement>("[data-slot]")?.dataset.slot;
    const side: PaneSide =
      slot === "right" || slot === "left"
        ? (slot as PaneSide)
        : e.clientX > window.innerWidth / 2
          ? "right"
          : "left";
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, axis: null, side };
  }
  function onPointerMove(e: React.PointerEvent) {
    const s = start.current;
    if (!s || e.pointerId !== s.id) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!s.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 12) {
      s.axis = Math.abs(dx) >= Math.abs(dy) ? "h" : "v";
    }
    if (s.axis === "h") setDrag(dx);
    else if (s.axis === "v" && page > 0 && activeRows.length > 1) {
      setDragY({ pageIndex: page - 1, side: s.side, dy });
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    const s = start.current;
    if (!s || e.pointerId !== s.id) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    const axis = s.axis;
    start.current = null;
    setDrag(null);
    setDragY(null);
    if (axis === "h") {
      const threshold = Math.min(80, window.innerWidth * 0.1);
      if (dx < -threshold) setPage((p) => Math.min(PAGES - 1, p + 1));
      else if (dx > threshold) setPage((p) => Math.max(0, p - 1));
    } else if (axis === "v" && page > 0) {
      const threshold = Math.min(70, window.innerHeight * 0.12);
      if (dy < -threshold) movePaneRow(page - 1, s.side, 1);
      else if (dy > threshold) movePaneRow(page - 1, s.side, -1);
    }
  }

  function paneStyle(pageIndex: number, side: PaneSide) {
    if (!dragY || dragY.pageIndex !== pageIndex || dragY.side !== side) return undefined;
    return { transform: `translateY(${dragY.dy}px)` };
  }

  function renderSplitPane(pageIndex: number, side: PaneSide) {
    const pageRows = pages[pageIndex] ?? [];
    const layout = pageRows[side === "left" ? (leftRows[pageIndex] ?? 0) : (rightRows[pageIndex] ?? 0)];
    if (!layout || layout.type === "dual") return null;
    return (
      <WidgetPanel
        widget={layout[side]}
        settings={settings}
        integrationSettings={savedSettings}
        slot={side}
        style={paneStyle(pageIndex, side)}
      />
    );
  }

  function renderWidgetPage(pageIndex: number) {
    const pageRows = pages[pageIndex] ?? [];
    const activeDualRow = activeDualRows[pageIndex];
    const activeDual = activeDualRow !== null && activeDualRow !== undefined && pageRows[activeDualRow]?.type === "dual";
    return (
      <div className="vrow">
        {activeDual ? (
          <MainRow row={pageRows[activeDualRow!]!} settings={settings} integrationSettings={savedSettings} />
        ) : (
          <div className="main-view">
            {renderSplitPane(pageIndex, "left")}
            {renderSplitPane(pageIndex, "right")}
          </div>
        )}
      </div>
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
            <Standby settings={settings} />
          </section>
          {pages.map((_, i) => (
            <section className="page" key={i}>
              {renderWidgetPage(i)}
            </section>
          ))}
        </div>
      </div>

      {canFullscreen && (
        <button className="fsbtn" onClick={toggleFullscreen} aria-label="fullscreen">
          {fullscreen ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </svg>
          )}
        </button>
      )}

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

      {page > 0 && activeRows.length > 1 && (
        <div className="vdots">
          {activeRows.map((_, i) => (
            <i
              key={i}
              className={
                i === activeDualRows[activeWidgetPage] ||
                i === leftRows[activeWidgetPage] ||
                i === rightRows[activeWidgetPage]
                  ? "on"
                  : ""
              }
            />
          ))}
        </div>
      )}

      <SettingsSheet
        open={settingsOpen}
        settings={settings}
        username={username}
        saved={saved}
        activePage={activeWidgetPage}
        onClose={() => setSettingsOpen(false)}
        onChange={updateSettings}
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
