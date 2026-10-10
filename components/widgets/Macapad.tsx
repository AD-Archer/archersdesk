"use client";

// Macapad — a stream-deck pad for the mac. A square panel shows the small
// pad (2×2), a dual row the big one (4×2); each pad has its own pages, swiped
// sideways inside the panel (or picked from the page dots). Keys look like
// home-screen tiles: rounded squares with a white glyph, or the app icon /
// site logo filling the tile, the label underneath. Tapping a key asks
// the desk server to press it; the server looks up the saved steps and runs
// them on the mac through macapad — the browser only ever sends a button id.
// Editing lives in settings → macapad; "Edit" (or an empty slot) opens it
// pointed at this pad and page.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MACAPAD_SLOTS, WIDGET_INFO, type MacapadButton, type MacapadSize } from "@/lib/types";
import { KeyTile, type MacapadFocus } from "../MacapadSettings";
import { Empty, MI, plainWords, Shell, useIntegration, useIntegrationAction } from "./kit";
import type { WidgetProps } from "./registry";

/** Ask the dashboard to open settings on the macapad tab (see Dashboard.tsx). */
export function openMacapadSettings(focus: MacapadFocus) {
  window.dispatchEvent(
    new CustomEvent("archersdesk:open-settings", {
      detail: { tab: "macapad", macapad: focus },
    })
  );
}

export function MacapadWidget({ wide, settings, integrationSettings }: WidgetProps) {
  const size: MacapadSize = wide ? "big" : "small";
  const status = useIntegration<{ online: boolean }>("macapad", integrationSettings ?? settings, 30 * 1000);
  const act = useIntegrationAction("macapad");

  const pages = settings.macapad?.[size] ?? [];
  const [pageIndex, setPageIndex] = useState(0);
  const current = Math.min(pageIndex, Math.max(0, pages.length - 1));
  const page = pages[current];

  // per-button press feedback: busy while the mac runs it, then ok/err briefly
  const [flash, setFlash] = useState<Record<string, "busy" | "ok" | "err">>({});
  const [message, setMessage] = useState<string | null>(null);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (messageTimer.current) clearTimeout(messageTimer.current);
    },
    []
  );

  // sideways swipe between pad pages. like SwipeCarousel: once a drag locks
  // horizontal it stops propagating so the desk doesn't change page, and the
  // click that follows a swipe is swallowed so it doesn't press a button.
  const drag = useRef<{
    x: number;
    y: number;
    id: number;
    axis: "h" | "v" | null;
  } | null>(null);
  const swiped = useRef(false);
  const [dragX, setDragX] = useState<number | null>(null);

  // tiles are squares sized to the panel: measure the pad's box and fit the
  // grid (tile + its label under it) the way a home screen does
  const viewport = useRef<HTMLDivElement>(null);
  const [tile, setTile] = useState<React.CSSProperties | undefined>(undefined);
  const cols = size === "big" ? 4 : 2;
  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const fit = () => {
      const w = el.clientWidth;
      // the dots / offline note under the pad take their share first
      const note = el.querySelector<HTMLElement>(".mpad-dots, .mpad-msg");
      const below = note ? note.offsetHeight + 8 : 0;
      const h = el.clientHeight - below;
      if (!w || !h) return;
      const rows = 2;
      const fitT = (lab: number) =>
        Math.min(w / (cols + (cols - 1) * 0.26), (h - rows * lab) / (rows + (rows - 1) * 0.12));
      let lab = 30;
      let t = fitT(lab);
      if (t < 120) t = fitT((lab = 22));
      t = Math.max(40, Math.floor(t));
      // the pad is exactly as tall as its grid, so the dots sit right under it
      const gh = Math.ceil(rows * (t + lab) + (rows - 1) * t * 0.12);
      setTile({
        "--t": `${t}px`,
        "--lab": `${lab}px`,
        "--gh": `${gh}px`,
      } as React.CSSProperties);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cols, status?.configured, status?.data?.online, pages.length]);

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, axis: null };
    swiped.current = false;
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || e.pointerId !== d.id || pages.length < 2) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 12) d.axis = Math.abs(dx) >= Math.abs(dy) ? "h" : "v";
    if (d.axis === "h") {
      e.stopPropagation();
      setDragX(dx);
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    setDragX(null);
    if (d.axis !== "h") return;
    e.stopPropagation();
    swiped.current = true;
    const dx = e.clientX - d.x;
    const threshold = Math.min(60, e.currentTarget.clientWidth * 0.15);
    if (dx < -threshold) setPageIndex(Math.min(pages.length - 1, current + 1));
    else if (dx > threshold) setPageIndex(Math.max(0, current - 1));
  }

  function say(text: string) {
    setMessage(text);
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage(null), 4000);
  }

  async function press(b: MacapadButton) {
    navigator.vibrate?.(10);
    setFlash((f) => ({ ...f, [b.id]: "busy" }));
    let ok = false;
    try {
      const res = await act("press", { id: b.id });
      ok = Boolean((res.data as { ok?: boolean } | undefined)?.ok);
      if (!ok) say(res.reason ?? "that didn't work");
    } catch {
      say("couldn't reach the desk");
    }
    setFlash((f) => ({ ...f, [b.id]: ok ? "ok" : "err" }));
    setTimeout(
      () =>
        setFlash((f) => {
          const next = { ...f };
          delete next[b.id];
          return next;
        }),
      ok ? 350 : 900
    );
  }

  function tap(b: MacapadButton | null, index: number) {
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    if (b) press(b);
    else openMacapadSettings({ size, page: page?.id, index });
  }

  if (!status) {
    return (
      <Shell icon={WIDGET_INFO.macapad.icon} label="macapad">
        <Empty>finding your mac…</Empty>
      </Shell>
    );
  }
  if (!status.configured) {
    return (
      <Shell icon={WIDGET_INFO.macapad.icon} label="macapad">
        <Empty>{status.reason}</Empty>
      </Shell>
    );
  }

  // configured but unreachable / bad token: keep the pad usable, say why
  const offline = !status.data?.online;
  // the heading names the page; a press that didn't work borrows it briefly
  const label = message ? (
    <span className="mpad-say" role="status">
      {message}
    </span>
  ) : (
    [page && pages.length > 1 ? page.name : "macapad", offline ? "offline" : null].filter(Boolean).join(" · ")
  );

  return (
    <Shell icon={WIDGET_INFO.macapad.icon} label={label}>
      <button
        className="mpad-edit"
        onClick={() => openMacapadSettings({ size, page: page?.id })}
        aria-label="edit keys"
      >
        Edit
      </button>
      <div ref={viewport} className="mpad-fit" style={tile}>
        <div
          className={`mpad-viewport ${size}${offline ? " offline" : ""}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div
            className={`mpad-track${dragX === null ? " animate" : ""}`}
            style={{
              transform: `translateX(calc(${-current * 100}% + ${dragX ?? 0}px))`,
            }}
          >
            {pages.map((pg) => (
              <div key={pg.id} className="mpad">
                {Array.from({ length: MACAPAD_SLOTS[size] }, (_, i) => pg.buttons[i] ?? null).map((b, i) =>
                  b ? (
                    <button
                      key={b.id}
                      className={`mpad-key${flash[b.id] ? ` ${flash[b.id]}` : ""}`}
                      onClick={() => tap(b, i)}
                      aria-label={b.label || "button"}
                    >
                      <KeyTile button={b} />
                      <span className="mpad-label">{b.label}</span>
                    </button>
                  ) : (
                    <button
                      key={`empty-${i}`}
                      className="mpad-key empty"
                      onClick={() => tap(null, i)}
                      aria-label="add a key"
                    >
                      <span className="mtile socket">
                        <MI name="add" />
                      </span>
                      <span className="mpad-label" />
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        </div>
        {offline && status.reason ? (
          <div className="mpad-msg" role="status">
            {plainWords(status.reason)}
          </div>
        ) : (
          pages.length > 1 && (
            <div className="mpad-dots">
              {pages.map((pg, i) => (
                <button
                  key={pg.id}
                  className={i === current ? "on" : ""}
                  onClick={() => setPageIndex(i)}
                  aria-label={`${pg.name} (page ${i + 1} of ${pages.length})`}
                />
              ))}
            </div>
          )
        )}
      </div>
    </Shell>
  );
}
