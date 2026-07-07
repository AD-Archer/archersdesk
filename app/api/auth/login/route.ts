import { NextRequest, NextResponse } from "next/server";
import { createSession, SESSION_COOKIE, verifyUser } from "@/lib/auth";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (typeof body.username !== "string" || typeof body.password !== "string")
    return NextResponse.json({ error: "username and password required" }, { status: 400 });

  const user = await verifyUser(body.username, body.password);
  if (!user) {
    // soften brute force a touch
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: "wrong username or password" }, { status: 401 });
  }

  const { token, maxAge } = createSession(user.id);
  const res = NextResponse.json({ user });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.cookieSecure,
    maxAge,
    path: "/",
  });
  return res;
}
