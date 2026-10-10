"use client";

// Multi-day agenda from the user's iCal feeds (+ optional Epic free-games
// events). Day columns across the top, each with its events beneath. Swipe /
// arrows page the window; tap the header to pick 3 / 5 / 7 days (stored per
// device in localStorage, like the chess/torrent view prefs). Reuses
// SwipeCarousel in row layout, one "item" per day.

import { useEffect, useState } from "react";
import { WIDGET_INFO } from "@/lib/types";
import EditablePopup from "../EditablePopup";
import { SwipeCarousel } from "./Carousel";
import { Shell, integrationGate, useIntegration } from "./kit";
import type { WidgetProps } from "./registry";

interface AgendaEvent {
  title: string;
  location: string;
  start: string; // ISO
  end: string;
  allDay: boolean;
  calendar: string;
}

interface AgendaData {
  events: AgendaEvent[];
}

interface Day {
  key: string;
  date: Date;
  events: AgendaEvent[];
}

const HORIZON = 28;
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_KEY = "archersdesk.agendaDays";
const DAY_CHOICES = [3, 5, 7] as const;

function localKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// group flat events into local calendar days across the horizon (grouping on
// the client so days line up with the *device's* local zone, not the server's)
function buildDays(events: AgendaEvent[]): Day[] {
  const byDay = new Map<string, AgendaEvent[]>();
  for (const e of events) {
    const k = localKey(new Date(e.start));
    (byDay.get(k) ?? byDay.set(k, []).get(k)!).push(e);
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days: Day[] = [];
  for (let i = 0; i < HORIZON; i++) {
    const date = new Date(today.getTime());
    date.setDate(date.getDate() + i);
    days.push({ key: localKey(date), date, events: byDay.get(localKey(date)) ?? [] });
  }
  return days;
}

function eventTime(e: AgendaEvent) {
  if (e.allDay) return "All day";
  return new Date(e.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase();
}

export function AgendaWidget({ wide, settings, integrationSettings }: WidgetProps) {
  const payload = useIntegration<AgendaData>("agenda", integrationSettings ?? settings, 10 * 60 * 1000);
  const [days, setDays] = useState(3);
  const [open, setOpen] = useState(false);
  const gate = integrationGate(payload, "reading your calendars…");

  useEffect(() => {
    const saved = Number(window.localStorage.getItem(DAYS_KEY));
    if (DAY_CHOICES.includes(saved as (typeof DAY_CHOICES)[number])) setDays(saved);
  }, []);

  function pick(n: number) {
    window.localStorage.setItem(DAYS_KEY, String(n));
    setDays(n);
    setOpen(false);
  }

  if (gate)
    return (
      <Shell icon={WIDGET_INFO.agenda.icon} label="Agenda">
        {gate}
      </Shell>
    );

  const dayList = buildDays(payload!.data!.events);
  const perView = wide ? days : Math.min(days, 5);

  return (
    <Shell icon={WIDGET_INFO.agenda.icon} label="Agenda">
      <div
        className="key wkey agenda-picker"
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        aria-label="choose how many days"
      >
        <span>{days} days</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M7.5 9.5L12 5l4.5 4.5M7.5 14.5L12 19l4.5-4.5" />
        </svg>
      </div>

      <SwipeCarousel
        items={dayList}
        perView={perView}
        layout="row"
        getKey={(d) => d.key}
        renderItem={(d) => {
          const isToday = localKey(new Date()) === d.key;
          return (
            <div className={`agenda-day${isToday ? " today" : ""}`}>
              <div className="agenda-head">
                <span className="agenda-dow">{DOW[d.date.getDay()]}</span>
                <span className="agenda-date">{d.date.getDate()}</span>
              </div>
              <div className="agenda-events">
                {d.events.length === 0 ? (
                  <span className="agenda-empty">Nothing planned</span>
                ) : (
                  d.events.slice(0, 6).map((e, i) => (
                    <div key={i} className="agenda-event">
                      <span className="agenda-event-time">{eventTime(e)}</span>
                      <span className="agenda-event-title">{e.title}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        }}
      />

      <EditablePopup open={open} title="Days to show" onClose={() => setOpen(false)}>
        <div className="mood-grid">
          {DAY_CHOICES.map((n) => (
            <button key={n} className={`mood-card${days === n ? " on" : ""}`} onClick={() => pick(n)}>
              <b>{n} days</b>
              <small>Show {n} days at a time</small>
            </button>
          ))}
        </div>
      </EditablePopup>
    </Shell>
  );
}
