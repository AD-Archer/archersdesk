// Minimal, dependency-free iCalendar (RFC 5545) reader — enough for a
// dashboard agenda. Server-only. Handles line unfolding, VEVENT blocks,
// all-day (VALUE=DATE), UTC (Z), TZID (via an Intl offset helper), and
// floating times, plus basic RRULE (DAILY / WEEKLY+BYDAY / MONTHLY) with
// INTERVAL / COUNT / UNTIL and EXDATE. Recurrence is expanded only across the
// caller's window, so complex rules are best-effort, not spec-complete.

export interface VEvent {
  uid: string;
  summary: string;
  location: string;
  start: Date;
  end: Date;
  allDay: boolean;
  rrule: string | null;
  exdates: number[]; // ms timestamps to skip
}

export interface Occurrence {
  summary: string;
  location: string;
  start: Date;
  end: Date;
  allDay: boolean;
}

// ── date/time parsing ────────────────────────────────────────────────

const DAY_MS = 86_400_000;

/** Offset (ms) to add to a UTC-interpreted wall clock to get the true UTC
 *  instant for that wall clock in the given IANA zone. No tz library needed. */
function tzOffsetMs(utcGuess: number, tz: string): number {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = dtf.formatToParts(new Date(utcGuess));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    let hour = get("hour");
    if (hour === 24) hour = 0;
    const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second"));
    return asUtc - utcGuess;
  } catch {
    return 0;
  }
}

/** Parse an ICS DATE / DATE-TIME value with its parameters. */
function parseDateValue(value: string, params: Record<string, string>): { date: Date; allDay: boolean } {
  const isDate = params.VALUE === "DATE" || /^\d{8}$/.test(value);
  if (isDate) {
    const y = Number(value.slice(0, 4));
    const mo = Number(value.slice(4, 6));
    const d = Number(value.slice(6, 8));
    // all-day: anchor at local midnight so it lands on the right calendar day
    return { date: new Date(y, mo - 1, d), allDay: true };
  }
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) return { date: new Date(value), allDay: false };
  const [, y, mo, d, h, mi, s, z] = m;
  const wall = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  if (z) return { date: new Date(wall), allDay: false }; // already UTC
  if (params.TZID) return { date: new Date(wall - tzOffsetMs(wall, params.TZID)), allDay: false };
  // floating: interpret in the server's local zone
  const local = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  return { date: local, allDay: false };
}

// ── parsing ──────────────────────────────────────────────────────────

/** Unfold RFC5545 folded lines (continuation lines start with space/tab). */
function unfold(text: string): string[] {
  const raw = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const lines: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

/** Split "NAME;PARAM=x:value" into name, params, value. */
function parseLine(line: string): { name: string; params: Record<string, string>; value: string } | null {
  const colon = line.indexOf(":");
  if (colon === -1) return null;
  const left = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const segs = left.split(";");
  const name = segs[0].toUpperCase();
  const params: Record<string, string> = {};
  for (const seg of segs.slice(1)) {
    const eq = seg.indexOf("=");
    if (eq !== -1) params[seg.slice(0, eq).toUpperCase()] = seg.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name, params, value };
}

function unescapeText(v: string): string {
  return v
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

export function parseIcs(text: string): VEvent[] {
  const events: VEvent[] = [];
  let cur: Partial<VEvent> & { exdates?: number[] } = {};
  let inEvent = false;

  for (const line of unfold(text)) {
    const parsed = parseLine(line);
    if (!parsed) continue;
    const { name, params, value } = parsed;

    if (name === "BEGIN" && value === "VEVENT") {
      inEvent = true;
      cur = { exdates: [] };
      continue;
    }
    if (name === "END" && value === "VEVENT") {
      if (cur.start) {
        const start = cur.start;
        const end = cur.end ?? new Date(start.getTime() + (cur.allDay ? DAY_MS : 60 * 60_000));
        events.push({
          uid: cur.uid ?? "",
          summary: cur.summary ?? "(busy)",
          location: cur.location ?? "",
          start,
          end,
          allDay: cur.allDay ?? false,
          rrule: cur.rrule ?? null,
          exdates: cur.exdates ?? [],
        });
      }
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;

    switch (name) {
      case "UID":
        cur.uid = value;
        break;
      case "SUMMARY":
        cur.summary = unescapeText(value);
        break;
      case "LOCATION":
        cur.location = unescapeText(value);
        break;
      case "DTSTART": {
        const { date, allDay } = parseDateValue(value, params);
        cur.start = date;
        cur.allDay = allDay;
        break;
      }
      case "DTEND": {
        cur.end = parseDateValue(value, params).date;
        break;
      }
      case "RRULE":
        cur.rrule = value;
        break;
      case "EXDATE": {
        for (const part of value.split(",")) {
          cur.exdates!.push(parseDateValue(part, params).date.getTime());
        }
        break;
      }
    }
  }
  return events;
}

// ── recurrence expansion ─────────────────────────────────────────────

const BYDAY: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function parseRule(rrule: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of rrule.split(";")) {
    const eq = part.indexOf("=");
    if (eq !== -1) out[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  }
  return out;
}

/** Expand a single event across [windowStart, windowEnd] into occurrences. */
function expandOne(ev: VEvent, windowStart: number, windowEnd: number): Occurrence[] {
  const durationMs = ev.end.getTime() - ev.start.getTime();
  const mk = (startMs: number): Occurrence => ({
    summary: ev.summary,
    location: ev.location,
    start: new Date(startMs),
    end: new Date(startMs + durationMs),
    allDay: ev.allDay,
  });

  if (!ev.rrule) {
    // non-recurring: include if it overlaps the window
    if (ev.end.getTime() >= windowStart && ev.start.getTime() <= windowEnd) return [mk(ev.start.getTime())];
    return [];
  }

  const rule = parseRule(ev.rrule);
  const freq = rule.FREQ;
  const interval = Math.max(1, Number(rule.INTERVAL) || 1);
  const count = rule.COUNT ? Number(rule.COUNT) : Infinity;
  const until = rule.UNTIL ? parseDateValue(rule.UNTIL, {}).date.getTime() : Infinity;
  const byday = rule.BYDAY ? rule.BYDAY.split(",").map((d) => BYDAY[d.replace(/^[+-]?\d+/, "")]).filter((n) => n !== undefined) : null;
  const exset = new Set(ev.exdates);

  const out: Occurrence[] = [];
  const first = ev.start.getTime();
  let emitted = 0;
  // hard cap the iteration so a malformed/endless rule can't spin forever
  const MAX_STEPS = 1500;

  if (freq === "WEEKLY" && byday && byday.length) {
    // step week-by-week from the DTSTART's week, emit each selected weekday
    const startOfWeek = new Date(first);
    startOfWeek.setHours(ev.start.getHours(), ev.start.getMinutes(), ev.start.getSeconds(), 0);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    for (let step = 0; step < MAX_STEPS; step++) {
      const weekBase = new Date(startOfWeek.getTime());
      weekBase.setDate(weekBase.getDate() + step * interval * 7);
      if (weekBase.getTime() - 7 * DAY_MS > windowEnd) break;
      for (const dow of byday) {
        const occ = new Date(weekBase.getTime());
        occ.setDate(occ.getDate() + dow);
        const t = occ.getTime();
        if (t < first) continue;
        if (t > until || emitted >= count) return out;
        emitted++;
        if (exset.has(t)) continue;
        if (t + durationMs >= windowStart && t <= windowEnd) out.push(mk(t));
      }
    }
    return out;
  }

  // DAILY / WEEKLY(no byday) / MONTHLY / YEARLY: step from DTSTART
  for (let step = 0; step < MAX_STEPS; step++) {
    const occ = new Date(first);
    if (freq === "DAILY") occ.setDate(occ.getDate() + step * interval);
    else if (freq === "WEEKLY") occ.setDate(occ.getDate() + step * interval * 7);
    else if (freq === "MONTHLY") occ.setMonth(occ.getMonth() + step * interval);
    else if (freq === "YEARLY") occ.setFullYear(occ.getFullYear() + step * interval);
    else break; // unsupported freq → just the base instance handled below
    const t = occ.getTime();
    if (t > until || emitted >= count) break;
    if (t - durationMs > windowEnd) break;
    emitted++;
    if (exset.has(t)) continue;
    if (t + durationMs >= windowStart && t <= windowEnd) out.push(mk(t));
  }
  return out;
}

export function expandEvents(events: VEvent[], windowStart: Date, windowEnd: Date): Occurrence[] {
  const ws = windowStart.getTime();
  const we = windowEnd.getTime();
  const out: Occurrence[] = [];
  for (const ev of events) out.push(...expandOne(ev, ws, we));
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}
