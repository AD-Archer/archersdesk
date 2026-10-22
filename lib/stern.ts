// Client-safe: the shapes the stern proxy hands the widgets, and the small
// rules every stern widget shares (a program's colour, where it is in its
// run). The server half is the `stern` entry in lib/integrations.ts.
//
// Two sources meet here. Stern's platform api knows the programs that run on
// stern (people, reviews, hours, orders). Unified (hack club's airtable, read
// through stern's /me) knows every program you own, stern or not: its wps,
// fines, dates and spend. A program the desk shows is either or both.

/** One row of stern's /api/platform/v1/programs. */
export interface SternListRow {
  id: string;
  slug: string;
  name: string;
  url: string;
  hidden: boolean;
  startsAt: string | null;
  endsAt: string | null;
  submissionsClosed: boolean;
  currencyName: string | null;
  people: number;
  projects: number;
  awaitingReview: number;
  hoursShipped: number;
  ordersToShip: number;
  brand?: { color: string; logoUrl: string | null; bannerUrl: string | null };
}

/** One of your programs, as unified sees it (stern's /me). Money in dollars. */
export interface UnifiedProgram {
  id: string;
  name: string;
  sternSlug: string | null;
  websiteUrl: string | null;
  hcbUrl: string | null;
  iconUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  unlisted: boolean;
  mine: number;
  mineMonth: number;
  wps: { total: number; year: number; month: number; week: number };
  projects: number;
  shippers: number;
  owners: number;
  nps: number | null;
  money: {
    spent: number;
    budgetPerHour: number;
    hoursPerGrant: number;
    allowance: number;
    margin: number;
    costPerHour: number | null;
  };
  fines: { count: number; amount: number; open: number; openAmount: number };
}

/** stern's /api/platform/v1/me: you, across unified. */
export interface SternMe {
  generatedAt: string;
  days: number;
  author: { name: string; trustLevel: string | null; hcbUrl: string | null } | null;
  reason?: "unified_unavailable" | "no_author";
  wps: { total: number; year: number; thisMonth: number; lastMonth: number; excludingShared: number; usd: number } | null;
  wpDays: number[];
  programs: UnifiedProgram[];
  fines: { count: number; amount: number; byStatus: Array<{ status: string; count: number; amount: number }> };
}

/** stern's /api/platform/v1/programs/[slug] (lib/server/platform-api.ts over
 *  there). Per-day series are oldest first, the last entry today. */
export interface SternProgramStats {
  generatedAt: string;
  days: number;
  program: {
    slug: string;
    name: string;
    startsAt: string | null;
    endsAt: string | null;
    submissionsClosed: boolean;
    url?: string;
    currencyName?: string | null;
  };
  people: { total: number; week: number; hackatimeLinked: number; days: number[] };
  active: { today: number; yesterday: number; week: number; month: number; days: number[] };
  projects: {
    all: number;
    draft: number;
    review: number;
    finalChecks: number;
    changesNeeded: number;
    approved: number;
    rejected: number;
    week: number;
    days: number[];
  };
  review: { waiting: number; oldestWaitDays: number | null; hoursWaiting: number; approvalRate: number | null; days: number[] };
  hours: { shipped: number; granted: number; spent: number; outstanding: number; outstandingUsd: number; days: number[] };
  currency: { name: string; granted: number; spent: number; outstanding: number } | null;
  orders: {
    byStatus: Record<string, number>;
    toShip: number;
    toShipUnits: number;
    inTransit: number;
    week: number;
    days: number[];
  };
  shop: { items: number; active: number };
  funnel: Array<{ key: string; label: string; n: number }>;
}

/** An hcb org's public balances, in cents. */
export interface HcbBalances {
  balance: number;
  incoming: number;
  raised: number;
}

/** stern's /api/public/hcb-networth?u=…, in cents. "True" is your share:
 *  orgs you own whole, plus your split of shared ones. */
export interface NetWorth {
  hcbUserId: string;
  groupNetWorth: { balanceCents: number; totalRaisedCents: number };
  trueNetWorth: { balanceCents: number; totalRaisedCents: number };
  orgs: Array<{
    id: string;
    name: string;
    slug: string;
    balanceCents: number;
    totalRaisedCents: number;
    status: string;
    splitPercent: number | null;
    shareBalanceCents: number;
  }>;
}

/** A program as the desk knows it: stern's row and unified's, merged. */
export interface DeskProgram {
  /** what a page stores: the stern slug, else "unified:<airtable id>" */
  key: string;
  name: string;
  slug: string | null;
  /** readable on black (see programTint) */
  color: string;
  logoUrl: string | null;
  startsAt: string | null;
  endsAt: string | null;
  hidden: boolean;
  /** one of yours in unified */
  mine: boolean;
  stern: SternListRow | null;
  unified: UnifiedProgram | null;
}

/** Everything the stern proxy returns: one fetch feeds every stern widget. */
export interface SternDesk {
  generatedAt: string;
  /** yours first (most wps to you first), then the rest of stern's */
  programs: DeskProgram[];
  me: SternMe | null;
  meReason: string | null;
  /** stern figures for each program a page shows, by key */
  stats: Record<string, SternProgramStats | null>;
  /** each shown program's hcb org, by key */
  hcb: Record<string, HcbBalances | null>;
  netWorth: NetWorth | null;
  netWorthReason: string | null;
}

export const unifiedKey = (id: string) => `unified:${id}`;

/** Programs whose colour the desk already wears elsewhere (phantom's own
 *  widgets), so a page of either reads as the same program. */
const KNOWN_COLORS: Record<string, string> = { phantom: "#966eff" };

/** Hues for programs with no brand of their own, far enough apart to tell
 *  at a glance: red, orange, yellow, green, mint, cyan, blue, indigo,
 *  purple, pink. */
const PALETTE = [4, 28, 48, 135, 170, 195, 214, 240, 280, 330];

const hueGap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

/** A program's brand colour, lifted until it reads on pure black: a navy
 *  turns a clear blue, a near-white keeps a little colour. null when it has
 *  none (see tintPrograms). */
export function programTint(name: string, brand?: string | null): { css: string; hue: number } | null {
  const known = KNOWN_COLORS[name.trim().toLowerCase()];
  const hex = brand && /^#?[0-9a-f]{6}$/i.test(brand) ? brand.replace(/^#?/, "#") : (known ?? null);
  if (!hex) return null;
  const [hue, sat, light] = hexToHsl(hex);
  // greys stay grey; everything else keeps enough colour to be told apart
  const s = sat < 0.08 ? sat : Math.max(sat, 0.55);
  const l = Math.min(Math.max(light, 0.6), 0.78);
  return { css: `hsl(${Math.round(hue)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`, hue };
}

/** Every program's colour: its brand's when it has one, else a palette hue
 *  picked from its name, stepping past hues another program already wears.
 *  Programs are taken in key order, so a program keeps its colour from one
 *  read to the next. */
export function tintPrograms(programs: Array<{ key: string; name: string; brand: string | null }>): Map<string, string> {
  const out = new Map<string, string>();
  const used: number[] = [];
  const plain: typeof programs = [];
  for (const p of programs) {
    const t = programTint(p.name, p.brand);
    if (t) {
      out.set(p.key, t.css);
      if (!t.css.includes(" 0% ")) used.push(t.hue);
    } else plain.push(p);
  }
  for (const p of [...plain].sort((a, b) => a.key.localeCompare(b.key))) {
    let h = 0;
    for (const ch of p.name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    // the first free hue from the name's own, else (a full desk) the one
    // furthest from every hue taken
    const start = h % PALETTE.length;
    const order = PALETTE.map((_, i) => PALETTE[(start + i) % PALETTE.length]);
    const room = (hue: number) => Math.min(360, ...used.map((u) => hueGap(u, hue)));
    const pick = order.find((hue) => room(hue) >= 22) ?? order.reduce((a, b) => (room(b) > room(a) ? b : a));
    used.push(pick);
    out.set(p.key, `hsl(${pick} 85% 66%)`);
  }
  return out;
}

function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

const DAY = 86_400_000;

/** A date-only "2026-10-05" as local midnight; an ISO time as itself. */
export function parseDay(v: string | null): Date | null {
  if (!v) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00`) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type RunPhase = "upcoming" | "live" | "ended" | "undated";

/** Where a program is in its run, and how far through. An end date is the
 *  last day it runs, so it's live until that day is over. */
export function programRun(p: Pick<DeskProgram, "startsAt" | "endsAt">, now = new Date()) {
  const start = parseDay(p.startsAt);
  const endDay = parseDay(p.endsAt);
  const end = endDay && /^\d{4}-\d{2}-\d{2}$/.test(p.endsAt ?? "") ? new Date(endDay.getTime() + DAY) : endDay;
  const t = now.getTime();
  const phase: RunPhase =
    start && t < start.getTime() ? "upcoming" : end && t >= end.getTime() ? "ended" : start || end ? "live" : "undated";
  const daysLeft = end ? Math.ceil((end.getTime() - t) / DAY) : null;
  const daysToStart = start ? Math.ceil((start.getTime() - t) / DAY) : null;
  const progress = start && end ? Math.min(1, Math.max(0, (t - start.getTime()) / (end.getTime() - start.getTime()))) : null;
  return { phase, start, end: endDay, daysLeft, daysToStart, progress };
}

/** "Oct 5", or "Oct 5, 2027" when it isn't this year. */
export function shortDate(d: Date | null, now = new Date()): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

/** What a glance needs to know about where a program is: "12 days left",
 *  "Ended Oct 5", "Starts in 3 days". */
export function runLine(p: Pick<DeskProgram, "startsAt" | "endsAt">, now = new Date()): string {
  const r = programRun(p, now);
  const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;
  if (r.phase === "upcoming") return r.daysToStart! <= 1 ? "Starts tomorrow" : `Starts in ${days(r.daysToStart!)}`;
  if (r.phase === "ended") return `Ended ${shortDate(r.end, now)}`;
  if (r.phase === "live") {
    if (r.daysLeft === null) return "Running, no end date";
    return r.daysLeft <= 1 ? "Last day" : `${days(r.daysLeft)} left`;
  }
  return "No dates set";
}
