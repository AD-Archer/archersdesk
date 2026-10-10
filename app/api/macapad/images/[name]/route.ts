import { NextRequest, NextResponse } from "next/server";
import { isUser, requireUser } from "@/lib/api";
import { readImage } from "@/lib/images";

// Serve a stored button image. Names are content hashes, so they never change.

export async function GET(req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const user = requireUser(req);
  if (!isUser(user)) return user;
  const image = readImage(user.id, (await ctx.params).name);
  if (!image) return NextResponse.json({ error: "no such image" }, { status: 404 });
  return new NextResponse(new Uint8Array(image), {
    headers: { "Content-Type": "image/webp", "Cache-Control": "private, max-age=31536000, immutable" },
  });
}
