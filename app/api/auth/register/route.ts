import { NextRequest, NextResponse } from "next/server";
import { createSession, registerUser, SESSION_COOKIE, validateCredentials } from "@/lib/auth";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  if (env.disableRegistration)
    return NextResponse.json(
      { error: "registration is disabled on this desk — accounts come from the server env" },
      { status: 403 }
    );

  const body = await req.json().catch(() => ({}));
  const bad = validateCredentials(body.username, body.password);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });

  const user = await registerUser(body.username, body.password);
  if (user === "taken")
    return NextResponse.json({ error: "that username is taken" }, { status: 409 });

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
