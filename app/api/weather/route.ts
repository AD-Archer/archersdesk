import { NextRequest, NextResponse } from "next/server";
import { isUser, requireUser } from "@/lib/api";
import { getUserConfig } from "@/lib/config";

// Open-Meteo: free, no API key. Geocode the configured city, then fetch
// current conditions + today's range. Cached in-memory for 10 minutes.

interface WeatherPayload {
  city: string;
  temp: number;
  feels: number;
  hi: number;
  lo: number;
  humidity: number;
  wind: number;
  code: number;
  isDay: boolean;
  kind: string;
  label: string;
  units: string;
}

const g = globalThis as typeof globalThis & {
  __deskWeather?: Map<string, { at: number; data: WeatherPayload }>;
};
const cache = (g.__deskWeather ??= new Map());
const TTL = 10 * 60 * 1000;

function describe(code: number): { kind: string; label: string } {
  if (code === 0) return { kind: "clear", label: "clear" };
  if (code <= 2) return { kind: "partly", label: "partly cloudy" };
  if (code === 3) return { kind: "cloudy", label: "overcast" };
  if (code === 45 || code === 48) return { kind: "fog", label: "foggy" };
  if (code <= 57) return { kind: "rain", label: "drizzle" };
  if (code <= 67) return { kind: "rain", label: "rain" };
  if (code <= 77) return { kind: "snow", label: "snow" };
  if (code <= 82) return { kind: "rain", label: "showers" };
  if (code <= 86) return { kind: "snow", label: "snow showers" };
  return { kind: "storm", label: "thunderstorm" };
}

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!isUser(user)) return user;

  const { config } = getUserConfig(user.id);
  const city = req.nextUrl.searchParams.get("city") || config.city;
  const units = config.units;
  const key = `${city.toLowerCase()}|${units}`;

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.data);

  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`,
      { signal: AbortSignal.timeout(8000) }
    );
    const geo = await geoRes.json();
    const place = geo?.results?.[0];
    if (!place)
      return NextResponse.json({ error: `couldn't find "${city}" — check the city in your config` }, { status: 404 });

    const unitParam = units === "celsius" ? "celsius" : "fahrenheit";
    const windParam = units === "celsius" ? "kmh" : "mph";
    const wxRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
        `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day` +
        `&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto` +
        `&temperature_unit=${unitParam}&wind_speed_unit=${windParam}`,
      { signal: AbortSignal.timeout(8000) }
    );
    const wx = await wxRes.json();
    const cur = wx?.current;
    if (!cur) return NextResponse.json({ error: "weather service unavailable" }, { status: 502 });

    const { kind, label } = describe(cur.weather_code);
    const data: WeatherPayload = {
      city: place.name,
      temp: Math.round(cur.temperature_2m),
      feels: Math.round(cur.apparent_temperature),
      hi: Math.round(wx.daily.temperature_2m_max[0]),
      lo: Math.round(wx.daily.temperature_2m_min[0]),
      humidity: cur.relative_humidity_2m,
      wind: Math.round(cur.wind_speed_10m),
      code: cur.weather_code,
      isDay: cur.is_day === 1,
      kind,
      label,
      units,
    };
    cache.set(key, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "weather service unreachable" }, { status: 502 });
  }
}
