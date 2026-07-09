import { NextRequest, NextResponse } from "next/server";
import { isUser, requireUser } from "@/lib/api";
import { getUserSettings, setPresence } from "@/lib/settings";
import { VIBES, type Presence } from "@/lib/types";

// Live presence (away/vibe) — the phone "remote" pushes here, and every display
// polls it (~3-4s). Kept separate from /api/settings so a remote push and a
// desk's settings autosave never clobber each other, and so this hot loop stays
// cheap (it returns only presence, plus the settings `version` the desk watches
// to know when to refetch the full doc for remote-side alarm/layout edits).

function presenceList(userId: number) {
  const settings = getUserSettings(userId);
  return {
    version: settings.version,
    devices: settings.devices.map((d) => ({ id: d.id, name: d.name, presence: d.presence })),
  };
}

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!isUser(user)) return user;
  return NextResponse.json(presenceList(user.id));
}

export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!isUser(user)) return user;

  const body = (await req.json().catch(() => ({}))) as {
    deviceIds?: unknown;
    presence?: Record<string, unknown>;
  };
  const deviceIds = Array.isArray(body.deviceIds)
    ? body.deviceIds.map((d) => String(d)).slice(0, 32)
    : [];
  if (!deviceIds.length)
    return NextResponse.json({ error: "deviceIds required" }, { status: 400 });

  const p = body.presence ?? {};
  const patch: Partial<Presence> = {};
  if ("awayUntil" in p) patch.awayUntil = p.awayUntil == null ? null : String(p.awayUntil);
  if ("awayLocation" in p) patch.awayLocation = String(p.awayLocation ?? "");
  if ("vibe" in p && (VIBES as readonly string[]).includes(String(p.vibe)))
    patch.vibe = String(p.vibe) as Presence["vibe"];

  setPresence(user.id, deviceIds, patch);
  return NextResponse.json(presenceList(user.id));
}
