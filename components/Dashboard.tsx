"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { WIDGET_PAGE_COUNT } from "@/lib/types";
import type { Alarm, Device, LayoutRow, Presence, Settings, ViewSettings } from "@/lib/types";
import { fromView, toView } from "@/lib/view";
import { MainRow, WidgetPanel } from "./widgets/registry";
import Standby from "./Standby";
import SettingsSheet from "./SettingsSheet";
import AlarmOverlay from "./AlarmOverlay";
import AwayOverlay from "./AwayOverlay";
import DevicePicker from "./DevicePicker";
import Remote from "./Remote";
import { alarmMatches } from "./alarmUtil";
import { alarmsForDevice } from "./alarmUtil";
import { pushPresence } from "./presence";
import { unlockAudio } from "./audio";
import { usePoll, useWakeLock } from "./hooks";

const PAGES = 1 + WIDGET_PAGE_COUNT; // 0 = standby, 1..n = widget pages
const DEVICE_KEY = "archersdesk.deviceId";
const LAST_DEVICE_KEY = "archersdesk.lastDeviceId";
type PaneSide = "left" | "right";
type PresenceSnap = { version: number; devices: Array<{ id: string; presence: Presence }> };
type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};
type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

function widgetPages(view: ViewSettings): LayoutRow[][] {
  return Array.from(
    { length: WIDGET_PAGE_COUNT },
    (_, i) => view.layout.pages?.[i] ?? view.layout.rows
  );
}

function activeDeviceOf(settings: Settings, deviceId: string | null): Device {
  return settings.devices.find((d) => d.id === deviceId) ?? settings.devices[0];
}

function existingDeviceId(devices: Device[], id: string | null): string | null {
  return id && devices.some((d) => d.id === id) ? id : null;
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
  // which device this browser is acting as: a device id, "remote", or null
  // (unresolved → show the picker). `ready` gates first paint until resolved.
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState(0);
  const initialPages = widgetPages(toView(initialSettings, initialSettings.devices[0]));
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
  const [awayNow, setAwayNow] = useState(() => Date.now());

  const start = useRef<{
    x: number;
    y: number;
    id: number;
    axis: "h" | "v" | null;
    side: PaneSide;
  } | null>(null);
  const settingsRef = useRef<Settings>(settings);
  const deviceIdRef = useRef<string | null>(deviceId);
  const viewRef = useRef<ViewSettings | null>(null);
  const pageRef = useRef(page);
  const leftRowsRef = useRef(leftRows);
  const rightRowsRef = useRef(rightRows);
  const activeDualRowsRef = useRef(activeDualRows);
  const ringingRef = useRef<Alarm | null>(null);
  const fired = useRef<Set<string>>(new Set());
  const snooze = useRef<{ at: number; alarm: Alarm } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncedVersion = useRef(initialSettings.version);
  const refetching = useRef(false);

  settingsRef.current = settings;
  deviceIdRef.current = deviceId;
  pageRef.current = page;
  leftRowsRef.current = leftRows;
  rightRowsRef.current = rightRows;
  activeDualRowsRef.current = activeDualRows;
  ringingRef.current = ringing;

  const activeDevice = activeDeviceOf(settings, deviceId);
  const view = toView(settings, activeDevice);
  const savedView = toView(savedSettings, activeDeviceOf(savedSettings, deviceId));
  viewRef.current = view;

  const pages = widgetPages(view);
  const activeWidgetPage = Math.max(0, page - 1);
  const activeRows = pages[activeWidgetPage] ?? pages[0] ?? [];

  const onDisplay = ready && deviceId !== null && deviceId !== "remote";
  const activeAwayUntil = onDisplay ? view.presence.awayUntil : null;
  const showAway =
    !!activeAwayUntil && new Date(activeAwayUntil).getTime() > awayNow && !ringing;

  useWakeLock();

  // resolve which device this browser is, once, after hydration
  useEffect(() => {
    const stored = window.localStorage.getItem(DEVICE_KEY);
    const storedDisplay = window.localStorage.getItem(LAST_DEVICE_KEY);
    const devs = settingsRef.current.devices;
    const fallbackDevice = existingDeviceId(devs, storedDisplay) ?? devs[0]?.id ?? null;
    const isLandscape = window.matchMedia("(orientation: landscape)").matches;
    let resolved: string | null;
    if (stored === "remote") resolved = isLandscape ? fallbackDevice : "remote";
    else if (stored && devs.some((d) => d.id === stored)) resolved = stored;
    else if (devs.length === 1) {
      resolved = devs[0].id;
    } else resolved = null; // multiple devices / stale id → show picker
    if (resolved) window.localStorage.setItem(DEVICE_KEY, resolved);
    if (resolved && resolved !== "remote") window.localStorage.setItem(LAST_DEVICE_KEY, resolved);
    deviceIdRef.current = resolved;
    setDeviceId(resolved);
    setReady(true);
  }, []);

  // A phone can act as the remote in portrait, but landscape should snap back
  // to the last real display so rotation is enough to recover the dashboard.
  useEffect(() => {
    const mq = window.matchMedia("(orientation: landscape)");
    const onOrientation = () => {
      if (!mq.matches || deviceIdRef.current !== "remote") return;
      const devs = settingsRef.current.devices;
      const storedDisplay = window.localStorage.getItem(LAST_DEVICE_KEY);
      const fallback = existingDeviceId(devs, storedDisplay) ?? devs[0]?.id ?? null;
      if (fallback) chooseDevice(fallback);
    };
    onOrientation();
    if (mq.addEventListener) mq.addEventListener("change", onOrientation);
    else mq.addListener(onOrientation);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onOrientation);
      else mq.removeListener(onOrientation);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // presence poll — the remote pushes here; every browser watches it (~3.5s)
  const presenceSnap = usePoll<PresenceSnap>("/api/presence", 3500, []);
  useEffect(() => {
    if (presenceSnap) applyPresence(presenceSnap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presenceSnap]);

  function applyPresence(snap: PresenceSnap) {
    setSettings((prev) => {
      const byId = new Map(snap.devices.map((d) => [d.id, d.presence]));
      let changed = false;
      const devices = prev.devices.map((d) => {
        const p = byId.get(d.id);
        if (p && JSON.stringify(p) !== JSON.stringify(d.presence)) {
          changed = true;
          return { ...d, presence: p };
        }
        return d;
      });
      if (!changed) return prev;
      const next = { ...prev, devices };
      settingsRef.current = next;
      return next;
    });
    // a bumped version means a remote-side alarm/layout/device edit — resync the
    // full doc (unless we're mid-edit, which would clobber our own change)
    if (snap.version > syncedVersion.current) void refetchSettings();
  }

  async function refetchSettings() {
    if (refetching.current || saveTimer.current) return;
    refetching.current = true;
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        if (data?.settings) {
          syncedVersion.current = data.settings.version;
          settingsRef.current = data.settings;
          setSettings(data.settings);
          setSavedSettings(data.settings);
        }
      }
    } catch {
      // offline — the next poll retries
    } finally {
      refetching.current = false;
    }
  }

  // tick once a second only while an away is pending, so the overlay auto-clears
  useEffect(() => {
    if (!activeAwayUntil || new Date(activeAwayUntil).getTime() <= Date.now()) return;
    const id = setInterval(() => setAwayNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activeAwayUntil]);

  // keep pane row indices valid when rows are removed / device switched
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
    document.documentElement.dataset.theme = view.theme;
  }, [view.theme]);

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
  function saveCanonical(next: Settings) {
    settingsRef.current = next;
    setSettings(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      saveTimer.current = null;
      try {
        const res = await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settings: settingsRef.current }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.settings) {
            syncedVersion.current = data.settings.version;
            settingsRef.current = data.settings;
            setSettings(data.settings);
            setSavedSettings(data.settings);
          }
          setSaved(true);
          if (savedTimer.current) clearTimeout(savedTimer.current);
          savedTimer.current = setTimeout(() => setSaved(false), 1800);
        }
      } catch {
        // offline — settings still live locally, next change retries
      }
    }, 600);
  }

  // the settings sheet edits a flattened view; fold it back into canonical
  function updateSettings(next: ViewSettings) {
    saveCanonical(fromView(next));
  }

  function chooseDevice(id: string) {
    window.localStorage.setItem(DEVICE_KEY, id);
    if (id !== "remote") window.localStorage.setItem(LAST_DEVICE_KEY, id);
    deviceIdRef.current = id;
    setDeviceId(id);
    setSettingsOpen(false);
    setPage(0);
  }

  function chooseLastDisplayDevice() {
    const devs = settingsRef.current.devices;
    const storedDisplay = window.localStorage.getItem(LAST_DEVICE_KEY);
    const fallback = existingDeviceId(devs, storedDisplay) ?? devs[0]?.id ?? null;
    if (fallback) chooseDevice(fallback);
  }

  function createDevice(name: string) {
    const base = settingsRef.current.devices[0];
    const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `dev-${Date.now()}`;
    const device: Device = {
      id,
      name,
      theme: base.theme,
      location: { ...base.location },
      layout: { rows: [...base.layout.rows], pages: base.layout.pages.map((p) => [...p]) },
      standby: { ...base.standby },
      presence: { awayUntil: null, awayLocation: "", vibe: "joyful" },
    };
    saveCanonical({ ...settingsRef.current, devices: [...settingsRef.current.devices, device] });
    chooseDevice(id);
  }

  function clearAway() {
    const id = deviceIdRef.current;
    if (!id || id === "remote") return;
    setSettings((prev) => {
      const devices = prev.devices.map((d) =>
        d.id === id ? { ...d, presence: { ...d.presence, awayUntil: null } } : d
      );
      const next = { ...prev, devices };
      settingsRef.current = next;
      return next;
    });
    void pushPresence([id], { awayUntil: null });
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore — redirect anyway
    }
    window.location.href = "/login";
  }

  // browsers gate audio behind a gesture — unlock on the first touch
  useEffect(() => {
    window.addEventListener("pointerdown", unlockAudio, { once: true });
    return () => window.removeEventListener("pointerdown", unlockAudio);
  }, []);

  // alarm engine: tick once a second, ring on match (once per minute-key), but
  // only for alarms targeting this device, and never in remote/picker mode
  useEffect(() => {
    const id = setInterval(() => {
      if (ringingRef.current) return;
      const self = deviceIdRef.current;
      if (!self || self === "remote") return;
      const now = new Date();
      if (snooze.current && now.getTime() >= snooze.current.at) {
        setRinging(snooze.current.alarm);
        snooze.current = null;
        return;
      }
      for (const a of alarmsForDevice(settingsRef.current.alarms, self)) {
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
    const sourceRows = (viewRef.current ? widgetPages(viewRef.current) : pages)[pageIndex] ?? [];
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
        settings={view}
        integrationSettings={savedView}
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
          <MainRow row={pageRows[activeDualRow!]!} settings={view} integrationSettings={savedView} />
        ) : (
          <div className="main-view">
            {renderSplitPane(pageIndex, "left")}
            {renderSplitPane(pageIndex, "right")}
          </div>
        )}
      </div>
    );
  }

  if (!ready) return <main />;

  if (deviceId === null) {
    return (
      <DevicePicker devices={settings.devices} onChoose={chooseDevice} onCreate={createDevice} />
    );
  }

  if (deviceId === "remote") {
    return (
      <>
        <Remote
          settings={settings}
          username={username}
          onChoose={chooseDevice}
          onBecomeDisplay={chooseLastDisplayDevice}
          onOpenAccounts={() => setSettingsOpen(true)}
          onSaveSettings={saveCanonical}
          onLogout={logout}
          onPushed={applyPresence}
        />
        <SettingsSheet
          open={settingsOpen}
          settings={view}
          username={username}
          saved={saved}
          initialTab="accounts"
          activePage={activeWidgetPage}
          deviceId={activeDevice.id}
          onChooseDevice={chooseDevice}
          onClose={() => setSettingsOpen(false)}
          onChange={updateSettings}
        />
      </>
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
            <Standby settings={view} />
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

      <button className="remotebtn" onClick={() => chooseDevice("remote")} aria-label="use as remote" title="use as remote">
        remote
      </button>

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
        settings={view}
        username={username}
        saved={saved}
        activePage={activeWidgetPage}
        deviceId={activeDevice.id}
        onChooseDevice={chooseDevice}
        onClose={() => setSettingsOpen(false)}
        onChange={updateSettings}
      />

      {showAway && <AwayOverlay presence={view.presence} onBack={clearAway} />}

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
