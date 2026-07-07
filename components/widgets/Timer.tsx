"use client";

import { useEffect, useRef, useState } from "react";
import { chime, unlockAudio } from "../audio";
import type { WidgetProps } from "./registry";

function fmt(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m >= 60
    ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export function TimerWidget(_: WidgetProps) {
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
      <span className="w-label">timer</span>
      <div className={`w-body tm${done ? " done" : ""}`}>
        <div className="tm-ring">
          <svg viewBox="0 0 100 100" width="100%" height="100%">
            <circle cx="50" cy="50" r={R} fill="none" stroke="var(--line)" strokeWidth="3" />
            <circle
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke="var(--amber)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - frac)}
              style={{ transition: "stroke-dashoffset 0.3s linear" }}
            />
          </svg>
          <div className="tm-time">{done ? "0:00" : fmt(left)}</div>
        </div>
        <div className="tm-presets">
          {[1, 5, 10, 25].map((m) => (
            <button key={m} className="tm-chip" onClick={() => add(m)}>
              +{m}m
            </button>
          ))}
        </div>
        <div className="tm-actions">
          {done ? (
            <button className="tm-go" onClick={reset}>
              done
            </button>
          ) : running ? (
            <button className="tm-go" onClick={() => setRunning(false)}>
              pause
            </button>
          ) : (
            <button className="tm-go" onClick={start} disabled={left <= 0}>
              start
            </button>
          )}
          {(left > 0 || total > 0) && !done && (
            <button className="tm-ghost" onClick={reset}>
              reset
            </button>
          )}
        </div>
      </div>
    </>
  );
}
