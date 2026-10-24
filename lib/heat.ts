// Outdoor WBGT estimate from standard weather fields.
// WBGT = 0.7·Tw + 0.2·Tg + 0.1·Ta (ISO 7243 weighting), with
//   Tw: Stull (2011) wet-bulb from air temp + RH,
//   Tg: simplified globe temperature, air temp plus a solar-load term damped by wind.
// It's an estimate, not a sensor reading; the UI says so.
import type { HourlyRisk } from "./types";

const fToC = (f: number) => ((f - 32) * 5) / 9;
const cToF = (c: number) => (c * 9) / 5 + 32;

export function wetBulbC(tC: number, rh: number): number {
  return (
    tC * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) +
    Math.atan(tC + rh) -
    Math.atan(rh - 1.676331) +
    0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) -
    4.686035
  );
}

export function wbgtF(tempF: number, rh: number, solarWm2: number, windMph: number): number {
  const ta = fToC(tempF);
  const tw = wetBulbC(ta, rh);
  const windMs = Math.max(windMph * 0.447, 0.5);
  const tg = ta + (0.0252 * solarWm2) / (1 + 0.3 * windMs);
  return cToF(0.7 * tw + 0.2 * tg + 0.1 * ta);
}

// Bands for heavy work by acclimatized workers (ACGIH-style action levels, °F).
export function band(wbgt: number): HourlyRisk["band"] {
  if (wbgt >= 85) return "extreme";
  if (wbgt >= 81.5) return "high";
  if (wbgt >= 77) return "moderate";
  return "low";
}
