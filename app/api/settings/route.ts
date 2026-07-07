import { NextRequest, NextResponse } from "next/server";
import { isUser, requireUser } from "@/lib/api";
import { getUserSettings, sanitizeSettings, saveUserSettings } from "@/lib/settings";

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

  const settings = sanitizeSettings(body.settings);
  saveUserSettings(user.id, settings);
  return NextResponse.json({ settings });
}
