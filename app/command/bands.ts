import type { HourlyRisk } from "@/lib/types";

// Heat bands: data colors only (tokens in globals.css), always paired with a word.
export const BAND_COLOR: Record<HourlyRisk["band"], string> = {
  low: "var(--heat-low)",
  moderate: "var(--heat-moderate)",
  high: "var(--heat-high)",
  extreme: "var(--heat-extreme)",
};

export const BAND_LABEL: Record<HourlyRisk["band"], string> = {
  low: "Low",
  moderate: "Caution",
  high: "High",
  extreme: "Deadly",
};
