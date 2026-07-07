import { NextRequest, NextResponse } from "next/server";
import { isUser, requireUser } from "@/lib/api";
import { getUserSettings } from "@/lib/settings";
import type { DayForecast, WeatherData } from "@/lib/types";

// Open-Meteo current conditions + 5-day forecast + sun times, keyed off the
// user's tap-picked location (lat/lon, no geocoding round-trip). Cached 10min.

const g = globalThis as typeof globalThis & {
  __deskWeather?: Map<string, { at: number; data: WeatherData }>;
};
const cache = (g.__deskWeather ??= new Map());
const TTL = 10 * 60 * 1000;

const DOW = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

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

  const { location, units } = getUserSettings(user.id);
  const key = `${location.latitude.toFixed(2)},${location.longitude.toFixed(2)}|${units}`;

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.data);

  try {
    const unitParam = units === "celsius" ? "celsius" : "fahrenheit";
    const windParam = units === "celsius" ? "kmh" : "mph";
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}` +
        `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day` +
        `&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset` +
        `&forecast_days=6&timezone=auto&temperature_unit=${unitParam}&wind_speed_unit=${windParam}`,
      { signal: AbortSignal.timeout(8000) }
    );
    const wx = await res.json();
    const cur = wx?.current;
    const daily = wx?.daily;
    if (!cur || !daily)
      return NextResponse.json({ error: "weather service unavailable" }, { status: 502 });

    const days: DayForecast[] = daily.time.slice(1, 6).map((date: string, i: number) => ({
      date,
      dow: DOW[new Date(`${date}T12:00:00`).getDay()],
      hi: Math.round(daily.temperature_2m_max[i + 1]),
      lo: Math.round(daily.temperature_2m_min[i + 1]),
      kind: describe(daily.weather_code[i + 1]).kind,
    }));

    const { kind, label } = describe(cur.weather_code);
    const data: WeatherData = {
      city: location.name,
      temp: Math.round(cur.temperature_2m),
      feels: Math.round(cur.apparent_temperature),
      hi: Math.round(daily.temperature_2m_max[0]),
      lo: Math.round(daily.temperature_2m_min[0]),
      humidity: cur.relative_humidity_2m,
      wind: Math.round(cur.wind_speed_10m),
      isDay: cur.is_day === 1,
      kind,
      label,
      units,
      sunrise: daily.sunrise[0],
      sunset: daily.sunset[0],
      days,
    };
    cache.set(key, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "weather service unreachable" }, { status: 502 });
  }
}
