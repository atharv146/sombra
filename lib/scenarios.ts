// Days the crew boss can plan for. Weather is real (Open-Meteo archive); the smoke drill adds simulated smoke.
export interface Scenario {
  id: string;
  date?: string; // archived day; omitted for live
  label: string;
  detail: string;
  smokeAqi?: number; // simulated wildfire smoke peak (drill only)
}

export const SCENARIOS: Scenario[] = [
  { id: "heat-2024", date: "2024-07-11", label: "Jul 11, 2024", detail: "Heat wave, 114°F" },
  { id: "record-2022", date: "2022-09-06", label: "Sep 6, 2022", detail: "Record heat, 118°F" },
  { id: "hot-2025", date: "2025-07-11", label: "Jul 11, 2025", detail: "Hot day, 104°F" },
  { id: "smoke-drill", date: "2022-09-10", label: "Smoke drill", detail: "Real Sep 10, 2022 weather + simulated wildfire smoke", smokeAqi: 190 },
  { id: "live", label: "Today", detail: "Live forecast" },
];

export const scenarioFor = (date: string, smoke?: boolean) =>
  SCENARIOS.find((s) => s.date === date && !!s.smokeAqi === !!smoke) ?? SCENARIOS.find((s) => s.id === "live")!;
