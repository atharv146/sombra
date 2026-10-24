import type { HourlyRisk } from "@/lib/types";

export const BAND_COLOR: Record<HourlyRisk["band"], string> = {
  low: "#7f9c76",
  moderate: "#d9a640",
  high: "#e0702f",
  extreme: "#b3261e",
};
