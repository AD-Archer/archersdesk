import { NextRequest, NextResponse } from "next/server";
import { isUser, requireUser } from "@/lib/api";
import { getUserSettings, mutateUserSettings, sanitizeSettings } from "@/lib/settings";

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!isUser(user)) return user;
  return NextResponse.json({ settings: getUserSettings(user.id) });
}

export async function PUT(req: NextRequest) {
  const user = requireUser(req);
  if (!isUser(user)) return user;

  const body = await req.json().catch(() => ({}));
  if (!body.settings || typeof body.settings !== "object")
    return NextResponse.json({ error: "settings object required" }, { status: 400 });

  // A settings write may come from any device and must never clobber live
  // presence (that is owned solely by /api/presence). Read-modify-write:
  // take the incoming doc but keep each device's presence from the server copy.
  const settings = mutateUserSettings(user.id, (current) => {
    const incoming = sanitizeSettings(body.settings);
    const presenceById = new Map(current.devices.map((d) => [d.id, d.presence]));
    incoming.devices = incoming.devices.map((d) => ({
      ...d,
      presence: presenceById.get(d.id) ?? d.presence,
    }));
    return incoming;
  });
  return NextResponse.json({ settings });
}
