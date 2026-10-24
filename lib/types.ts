// Shared contract for everyone on the team. Atharv owns this file; ask before changing it.

export type Lang = "es" | "pa" | "en";

export interface Field {
  id: string;
  name: string; // "French Camp tomatoes"
  crop: string;
  lat: number;
  lon: number;
  shade: "none" | "partial" | "orchard"; // orchards give canopy shade
}

export interface Crew {
  id: string;
  name: string; // "Crew 2"
  size: number;
  newWorkers: number; // workers in their first 14 days (acclimatization, §3395(g))
  fieldId: string;
  lang: Lang[];
  pieceRateUsdPerHour?: number; // average piece-rate earnings, for paid-break display
}

// One hour of weather at one field, plus our derived risk.
export interface HourlyRisk {
  fieldId: string;
  time: string; // ISO local time, e.g. "2024-07-10T14:00"
  tempF: number;
  humidity: number; // %
  windMph: number;
  solarWm2: number;
  aqi?: number; // US AQI for PM2.5
  wbgtF: number; // from lib/heat.ts
  band: "low" | "moderate" | "high" | "extreme";
}

export type RuleId =
  | "shade_80"
  | "water_quart_hour"
  | "high_heat_95"
  | "cooldown_2h"
  | "acclimatization_14d"
  | "smoke_151"
  | "smoke_500";

export interface RuleViolation {
  rule: RuleId;
  crewId: string;
  time?: string;
  message: string; // plain English, cites the subsection
}

export interface ShiftBlock {
  start: string; // "04:30"
  end: string;
  kind: "work" | "cooldown" | "meal" | "travel";
  fieldId?: string;
  paid?: boolean; // cooldowns are paid rest for piece-rate workers
}

export interface CrewPlan {
  crewId: string;
  blocks: ShiftBlock[];
  waterGallons: number;
  shadeUnits: number;
  notes: string[];
}

export interface ShiftPlan {
  id: string;
  date: string; // "2024-07-10"
  mode: "live" | "replay";
  crews: CrewPlan[];
  violations: RuleViolation[]; // must be empty before the plan can be sent
  briefings: Partial<Record<Lang, string>>; // whole-plan summary (fallback)
  crewBriefings?: Record<string, Partial<Record<Lang, string>>>; // crewId -> what that crew's phones read aloud
  summary: string;
  crewInfo?: Crew[]; // names, sizes and pay rates, for the phone page
  usual?: CrewPlan[]; // the crew lead's usual day, kept so the before/after can be shown again later
  usualViolations?: RuleViolation[];
  createdAt?: string;
}

export type AgentId = "cielo" | "ley" | "cuadrilla" | "voz" | "critico" | "medic";

// Streamed over SSE from /api/plan, one JSON object per event.
export type AgentEvent =
  | { type: "agent_start"; agent: AgentId; model: string }
  | { type: "agent_delta"; agent: AgentId; text: string }
  | { type: "agent_done"; agent: AgentId; summary: string; verdict?: "approve" | "reject" }
  | { type: "risk"; risks: HourlyRisk[] }
  | { type: "plan"; plan: ShiftPlan; revision: number }
  | { type: "error"; message: string }
  | { type: "done"; planId: string };

export type TriageLabel = "ok" | "warning" | "heat_exhaustion" | "emergency";

export interface TriageResult {
  label: TriageLabel;
  scores: Record<TriageLabel, number>; // softmax probabilities from our classifier
  model: string; // "sombra-triage v1"
  forcedByKeyword?: string; // safety floor: an emergency keyword overrode the model
}

export interface CheckIn {
  id: string;
  planId: string;
  crewId: string;
  workerId: string; // no names stored
  lang: Lang;
  transcript: string;
  english?: string; // translation for the crew boss
  triage: TriageResult;
  medic?: { label: TriageLabel; steps: string[] }; // LLM second opinion + first aid
  at: string; // ISO
}

// Crew channel message: boss <-> one crew (or all crews), stored with all three translations.
export interface RadioMessage {
  id: string;
  planId: string;
  from: "boss" | "worker";
  crewId?: string; // boss messages without crewId go to every crew
  workerId?: string;
  lang: string; // language it was said in (any language for workers)
  original?: string; // exactly what the worker said
  text: Record<Lang, string>;
  kind: "chat" | "alert"; // alert = full-screen heat alarm on phones
  intent?: "health" | "request" | "question" | "other";
  triage?: TriageResult; // our model, on worker messages
  autoReply?: Record<Lang, string>; // Sombra's instant, specific reply to the worker while the boss reads it
  at: string;
}
