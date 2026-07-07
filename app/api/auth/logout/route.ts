import { NextRequest, NextResponse } from "next/server";
import { destroySession, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  destroySession(req.cookies.get(SESSION_COOKIE)?.value);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
  return res;
}
