import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isUser, requireUser } from "@/lib/api";
import { mutateUserSettings } from "@/lib/settings";

// Dedicated write channel for the embed widget's own tap-to-manage popup —
// mirrors /api/presence in spirit: a small, focused mutation so the widget
// doesn't need the full settings-editor round trip (fromView/sanitize the
// whole document/preserveSavedSecrets) just to add/edit/remove one embed.

export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!isUser(user)) return user;

  const body = (await req.json().catch(() => ({}))) as { action?: string; payload?: unknown };
  const { action, payload } = body;

  if (action === "add") {
    const { name, url } = (payload ?? {}) as { name?: string; url?: string };
    if (!url?.trim()) return NextResponse.json({ error: "url required" }, { status: 400 });
    const settings = mutateUserSettings(user.id, (current) => ({
      ...current,
      embeds: [...current.embeds, { id: crypto.randomUUID(), name: (name ?? "").trim() || "embed", url: url.trim() }],
    }));
    return NextResponse.json({ embeds: settings.embeds });
  }

  if (action === "update") {
    const { id, name, url } = (payload ?? {}) as { id?: string; name?: string; url?: string };
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const settings = mutateUserSettings(user.id, (current) => ({
      ...current,
      embeds: current.embeds.map((e) =>
        e.id === id
          ? { ...e, ...(name !== undefined ? { name } : {}), ...(url !== undefined ? { url } : {}) }
          : e
      ),
    }));
    return NextResponse.json({ embeds: settings.embeds });
  }

  if (action === "remove") {
    const { id } = (payload ?? {}) as { id?: string };
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const settings = mutateUserSettings(user.id, (current) => ({
      ...current,
      embeds: current.embeds.filter((e) => e.id !== id),
    }));
    return NextResponse.json({ embeds: settings.embeds });
  }

  return NextResponse.json({ error: `unknown action "${action}"` }, { status: 400 });
}
