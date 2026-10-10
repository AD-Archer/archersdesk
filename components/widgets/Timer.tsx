"use client";

import { useEffect, useRef, useState } from "react";
import { chime, unlockAudio } from "../audio";
import { BigTime } from "./kit";
import type { WidgetProps } from "./registry";

function fmt(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m >= 60
    ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export function TimerWidget({ wide }: WidgetProps) {
  const [total, setTotal] = useState(0);
  const [left, setLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const endAt = useRef(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const rest = Math.max(0, Math.round((endAt.current - Date.now()) / 1000));
      setLeft(rest);
      if (rest === 0) {
        setRunning(false);
        setDone(true);
        chime();
        setTimeout(chime, 900);
        setTimeout(chime, 1800);
      }
    }, 250);
    return () => clearInterval(id);
  }, [running]);

  function add(mins: number) {
    unlockAudio();
    setDone(false);
    const next = left + mins * 60;
    setLeft(next);
    setTotal((t) => Math.max(t + mins * 60, next));
    if (running) endAt.current += mins * 60 * 1000;
  }

  function start() {
    if (left <= 0) return;
    unlockAudio();
    endAt.current = Date.now() + left * 1000;
    setRunning(true);
    setDone(false);
  }

  function reset() {
    setRunning(false);
    setDone(false);
    setLeft(0);
    setTotal(0);
  }

  const R = 46;
  const C = 2 * Math.PI * R;
  const frac = total > 0 ? left / total : 0;

  return (
    <>
      <span className="w-label">Timer</span>
      <div className={`w-body tm${done ? " done" : ""}${running ? " running" : ""}${wide ? " wide" : ""}`}>
        <div className="tm-ring">
          <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden>
            <circle cx="50" cy="50" r={R} fill="none" stroke="var(--fill-2)" strokeWidth="5" />
            <circle
              className="tm-arc"
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke="var(--tint)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - frac)}
              transform="rotate(-90 50 50)"
              style={{ transition: "stroke-dashoffset 0.3s linear", opacity: frac > 0 ? 1 : 0 }}
            />
          </svg>
          <div className="tm-center">
            <BigTime className="tm-time" time={done ? "0:00" : fmt(left)} />
            <span className="tm-state">{done ? "Done" : running ? "Running" : left > 0 ? "Paused" : "Add time"}</span>
          </div>
        </div>
        <div className="tm-controls">
          <div className="tm-presets">
            {[1, 5, 10, 25].map((m) => (
              <button key={m} className="key wkey" onClick={() => add(m)}>
                +{m} min
              </button>
            ))}
          </div>
          <div className="tm-actions">
            {done ? (
              <button className="key wkey tm-go stop" onClick={reset}>
                Stop
              </button>
            ) : running ? (
              <button className="key wkey tm-go" onClick={() => setRunning(false)}>
                Pause
              </button>
            ) : (
              <button className="key wkey tm-go start" onClick={start} disabled={left <= 0}>
                Start
              </button>
            )}
            {(left > 0 || total > 0) && !done && (
              <button className="key wkey" onClick={reset}>
                Reset
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
