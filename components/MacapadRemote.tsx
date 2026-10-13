"use client";

// The macapad pad on the phone remote: the same keys as the desk's pads, as
// Control Center tiles sized for a thumb. Presses go through the desk server
// like the widget (only a key id leaves the phone); "Edit keys" opens
// settings → macapad. Also home to the remote's small shared pieces: icons,
// the large-title page head and the iOS sheet.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { buttonMode, padOf, screenPad } from "@/lib/macapad";
import {
  MACAPAD_REMOTE,
  type IntegrationPayload,
  type MacapadButton,
  type MacapadPadId,
  type MacapadStatus,
  type Settings,
} from "@/lib/types";
import { usePoll } from "./hooks";
import { KeyFace } from "./MacapadSettings";
import { openMacapadSettings } from "./widgets/Macapad";
import { useIntegrationAction } from "./widgets/kit";

// the remote's own pad page first (its own grid and keys), then the desk's widget pads
const REMOTE_PAD = screenPad(MACAPAD_REMOTE);
const PAD_ORDER: MacapadPadId[] = [REMOTE_PAD, "big", "small"];
const PAD_NAMES: Record<string, string> = { [REMOTE_PAD]: "Remote", big: "Big pad", small: "Small pad" };

/* ── shared remote pieces ─────────────────────────────────────────────── */

const ICONS = {
  // tab bar
  control: (
    <>
      <rect x="3" y="4.5" width="18" height="6.5" rx="3.25" />
      <circle cx="17.75" cy="7.75" r="1.9" fill="currentColor" />
      <rect x="3" y="13" width="18" height="6.5" rx="3.25" />
      <circle cx="6.25" cy="16.25" r="1.9" fill="currentColor" />
    </>
  ),
  pad: (
    <>
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2.2" />
      <rect x="13" y="3.5" width="7.5" height="7.5" rx="2.2" />
      <rect x="3.5" y="13" width="7.5" height="7.5" rx="2.2" />
      <rect x="13" y="13" width="7.5" height="7.5" rx="2.2" />
    </>
  ),
  alarm: (
    <>
      <circle cx="12" cy="13" r="7.5" />
      <path d="M12 9v4l2.6 1.6M5 3.8 2.8 6M19 3.8 21.2 6" />
    </>
  ),
  tv: (
    <>
      <rect x="2.5" y="4.5" width="19" height="12.5" rx="2.6" />
      <path d="M8.5 20.5h7" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="12" cy="10" r="3.2" />
      <path d="M6.2 18.6c1.3-2.3 3.4-3.5 5.8-3.5s4.5 1.2 5.8 3.5" />
    </>
  ),
  // nav + rows
  plus: <path d="M12 4.5v15M4.5 12h15" />,
  chevron: <path d="M9.5 5.5 16 12l-6.5 6.5" />,
  walk: (
    <>
      <circle cx="13.5" cy="4.5" r="1.8" fill="currentColor" />
      <path d="M10 21l2.2-6 2.6 2.4V21M9 11.5l2.5-3.5 3 1 2 3 2.5 1M11.5 8 10 13.5l2.2 1.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  // vibes
  joyful: (
    <>
      <circle cx="12" cy="12" r="4.2" fill="currentColor" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M5.3 18.7l1.5-1.5M17.2 6.8l1.5-1.5" />
    </>
  ),
  sad: (
    <>
      <path d="M7 15.5h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.2A3.4 3.4 0 0 0 7 15.5z" fill="currentColor" />
      <path d="M8.5 18.5 7.8 20.5M12.5 18.5l-.7 2M16.5 18.5l-.7 2" />
    </>
  ),
  stressed: <path d="M13.5 2.5 5 13.5h6l-1 8 8.5-11h-6z" fill="currentColor" />,
  calm: <path d="M5 19.5C5 11 10.5 5 19.5 4.5c.5 9-5 15-13.5 15M5 19.5l8-8" />,
  busy: (
    <>
      <rect x="3" y="7.5" width="18" height="12.5" rx="2.5" fill="currentColor" />
      <path d="M9 7.5V5.8c0-.7.6-1.3 1.3-1.3h3.4c.7 0 1.3.6 1.3 1.3v1.7" />
    </>
  ),
  mysterious: (
    <>
      <path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.3 6.3 0 0 0 10 10z" fill="currentColor" />
      <path d="M17 3.5v3M15.5 5h3" />
    </>
  ),
} as const;

export type RIconName = keyof typeof ICONS;

/** Icons in the SF Symbols manner (no font dependency). */
export function RIcon({ name, className }: { name: RIconName; className?: string }) {
  return (
    <svg
      className={`ricon${className ? ` ${className}` : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ICONS[name]}
    </svg>
  );
}

/** A page's top: a slim row for the blue text buttons, then the large title. */
export function PageHead({
  title,
  left,
  right,
  children,
}: {
  title: string;
  left?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="rm-head">
      <div className="rm-navrow">
        <div className="rm-nav-l">{left}</div>
        <div className="rm-nav-r">{right}</div>
      </div>
      <h1 className="large-title">{title}</h1>
      {children}
    </header>
  );
}

/** An iOS sheet: grabber, a nav bar with the title and a blue Done. */
export function Sheet({ title, onDone, children }: { title: string; onDone: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDone();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);
  return (
    <div
      className="remote-sheet"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => e.target === e.currentTarget && onDone()}
    >
      <div className="rm-sheet">
        <i className="rm-grabber" aria-hidden />
        <div className="rm-sheet-nav">
          <span />
          <h2>{title}</h2>
          <button className="rm-navbtn strong" onClick={onDone}>
            Done
          </button>
        </div>
        <div className="rm-sheet-body">{children}</div>
      </div>
    </div>
  );
}

/* ── the pad ──────────────────────────────────────────────────────────── */

export function RemotePad({ settings, onClose }: { settings: Settings; onClose: () => void }) {
  const act = useIntegrationAction("macapad", MACAPAD_REMOTE);
  const has = (s: MacapadPadId) => padOf(settings.macapad, s)?.pages.some((p) => p.buttons.some(Boolean)) ?? false;
  const [size, setSize] = useState<MacapadPadId>(() => PAD_ORDER.find(has) ?? REMOTE_PAD);
  const [pageIndex, setPageIndex] = useState(0);
  const [flash, setFlash] = useState<Record<string, "busy" | "ok" | "err">>({});
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // which of the mac's modes are on, so keep-awake / jiggler keys light up;
  // a press of one bumps `poke` to refetch straight away
  const [poke, setPoke] = useState(0);
  const status = usePoll<IntegrationPayload<MacapadStatus>>(
    `/api/integrations/macapad?device=${MACAPAD_REMOTE}`,
    30 * 1000,
    [poke]
  );
  const modes = status?.data?.modes;
  const modeOn = (b: MacapadButton) => {
    const m = buttonMode(b);
    return Boolean(m && modes?.[m]?.on);
  };

  const pad = padOf(settings.macapad, size);
  const pages = pad?.pages ?? [];
  const cols = pad?.cols ?? 2;
  const page = pages[Math.min(pageIndex, pages.length - 1)];
  const slots = Array.from({ length: pad?.slots ?? 0 }, (_, i) => page?.buttons[i] ?? null);

  function say(text: string) {
    setMessage(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 4000);
  }

  async function press(b: MacapadButton) {
    navigator.vibrate?.(10);
    setFlash((f) => ({ ...f, [b.id]: "busy" }));
    let ok = false;
    try {
      const res = await act("press", { id: b.id });
      ok = Boolean((res.data as { ok?: boolean } | undefined)?.ok);
      if (!ok) say(res.reason ?? "That didn't work.");
    } catch {
      say("Couldn't reach the desk.");
    }
    setFlash((f) => ({ ...f, [b.id]: ok ? "ok" : "err" }));
    if (ok && buttonMode(b)) setPoke((n) => n + 1);
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

  function edit(index?: number) {
    onClose();
    openMacapadSettings({ pad: size, page: page?.id, index });
  }

  return (
    <div className="rm-page" aria-label="Pad">
      <PageHead
        title="Pad"
        right={
          <button className="rm-navbtn" onClick={() => edit()}>
            Edit keys
          </button>
        }
      />

      <div className="rm-seg" role="tablist" aria-label="Which pad">
        {PAD_ORDER.map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={s === size}
            className={s === size ? "on" : undefined}
            onClick={() => {
              setSize(s);
              setPageIndex(0);
            }}
          >
            {PAD_NAMES[s]}
          </button>
        ))}
      </div>

      {pages.length > 1 && (
        <div className="rpad-pages" aria-label="Pages">
          {pages.map((p, i) => (
            <button
              key={p.id}
              className={`rm-pill${p.id === page?.id ? " on" : ""}`}
              aria-pressed={p.id === page?.id}
              onClick={() => setPageIndex(i)}
            >
              {p.name || `Page ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      <div
        className={`rpad-grid ${size === REMOTE_PAD ? "screen" : size}${cols >= 4 && size === REMOTE_PAD ? " dense" : ""}`}
        style={size === REMOTE_PAD ? ({ "--cols": cols } as React.CSSProperties) : undefined}
      >
        {slots.map((b, i) =>
          b ? (
            <button
              key={b.id}
              className={`rpad-key${flash[b.id] ? ` ${flash[b.id]}` : modeOn(b) ? " on" : ""}`}
              onClick={() => press(b)}
              aria-label={b.label || "key"}
              aria-pressed={buttonMode(b) && modes ? modeOn(b) : undefined}
            >
              <span className="rpad-face">
                <KeyFace button={b} />
              </span>
              {b.label && <span className="rpad-label">{b.label}</span>}
            </button>
          ) : (
            <button key={`empty-${i}`} className="rpad-key empty" onClick={() => edit(i)} aria-label="Add a key here">
              <RIcon name="plus" />
            </button>
          )
        )}
      </div>

      <p className="rpad-foot">Tap a key to press it on your Mac.</p>

      <p className={`rm-toast${message ? " show" : ""}`} role="status">
        {message}
      </p>
    </div>
  );
}
