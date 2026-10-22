import { NextRequest, NextResponse } from "next/server";
import { isUser, requireUser } from "@/lib/api";
import { revokeToken } from "@/lib/mcp/tokens";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = requireUser(req);
  if (!isUser(user)) return user;
  const { id } = await params;
  if (!revokeToken(user.id, id)) return NextResponse.json({ error: "no such token" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
