import { NextRequest, NextResponse } from "next/server";
import { isUser, requireUser } from "@/lib/api";
import type { GeocodeResult } from "@/lib/types";

// City search for the tap-to-set location picker (Open-Meteo, no key).

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!isUser(user)) return user;

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`,
      { signal: AbortSignal.timeout(8000) }
    );
    const data = await res.json();
    const results: GeocodeResult[] = (data?.results ?? []).map(
      (r: { name: string; admin1?: string; country?: string; latitude: number; longitude: number }) => ({
        name: r.name,
        region: [r.admin1, r.country].filter(Boolean).join(" · "),
        latitude: r.latitude,
        longitude: r.longitude,
      })
    );
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [], error: "geocoder unreachable" }, { status: 502 });
  }
}
