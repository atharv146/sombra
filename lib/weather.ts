// Hourly weather + air quality per field from Open-Meteo (no key; CC BY 4.0, credited in the UI).
import type { Field, HourlyRisk } from "./types";
import { band, wbgtF } from "./heat";

export const REPLAY_DATE = "2024-07-11"; // 114°F in Manteca, the hottest July 2024 weekday in the ERA5 archive

const HOURLY = "temperature_2m,relative_humidity_2m,wind_speed_10m,shortwave_radiation";

export async function fetchRisks(fields: Field[], mode: "live" | "replay", date: string, smokeAqi?: number): Promise<HourlyRisk[]> {
  const all = (await Promise.all(fields.map((f) => fieldRisks(f, mode, date)))).flat();
  if (!smokeAqi) return all;
  // Smoke drill: wildfire smoke builds through the morning and peaks mid-afternoon.
  return all.map((r) => {
    const h = Number(r.time.slice(11, 13));
    return { ...r, aqi: Math.round(Math.max(r.aqi ?? 0, smokeAqi * (0.55 + 0.45 * Math.sin((Math.PI * (h - 5)) / 14)))) };
  });
}

async function fieldRisks(field: Field, mode: "live" | "replay", date: string): Promise<HourlyRisk[]> {
  const base = mode === "replay" ? "https://archive-api.open-meteo.com/v1/archive" : "https://api.open-meteo.com/v1/forecast";
  const q = `latitude=${field.lat}&longitude=${field.lon}&start_date=${date}&end_date=${date}&timezone=America%2FLos_Angeles`;
  const [wx, aq] = await Promise.all([
    getJSON(`${base}?${q}&hourly=${HOURLY}&temperature_unit=fahrenheit&wind_speed_unit=mph`),
    getJSON(`https://air-quality-api.open-meteo.com/v1/air-quality?${q}&hourly=us_aqi_pm2_5`).catch(() => null),
  ]);
  const h = wx.hourly;
  return (h.time as string[])
    .map((time, i) => {
      const tempF = h.temperature_2m[i];
      const humidity = h.relative_humidity_2m[i];
      const windMph = h.wind_speed_10m[i];
      const solarWm2 = h.shortwave_radiation[i] ?? 0;
      const w = wbgtF(tempF, humidity, solarWm2, windMph);
      return {
        fieldId: field.id,
        time,
        tempF: Math.round(tempF),
        humidity: Math.round(humidity),
        windMph: Math.round(windMph),
        solarWm2: Math.round(solarWm2),
        aqi: aq?.hourly?.us_aqi_pm2_5?.[i] ?? undefined,
        wbgtF: Math.round(w * 10) / 10,
        band: band(w),
      };
    })
    .filter((r) => {
      const hr = Number(r.time.slice(11, 13));
      return hr >= 4 && hr <= 19;
    });
}

async function getJSON(url: string) {
  const res = await fetch(url, { next: { revalidate: 1800 } });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  return res.json();
}
