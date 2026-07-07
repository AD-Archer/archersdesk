import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, SESSION_COOKIE, type User } from "./auth";

export function requireUser(req: NextRequest): User | NextResponse {
  const user = getSessionUser(req.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  return user;
}

export function isUser(u: User | NextResponse): u is User {
  return !(u instanceof NextResponse);
}
