// Before/after numbers a non-technical judge can read: heat exposure, violations, hours kept, paid breaks.
import { toMin } from "./rules";
import type { Crew, CrewPlan, Field, HourlyRisk, ShiftPlan } from "./types";

export interface Impact {
  extremeWorkerHours: number; // worker-hours worked at "extreme" WBGT
  dangerWorkerHours: number; // worker-hours at "high" or "extreme"
  violations: number;
  workHoursPerWorker: number; // average across crews
  paidBreakUsd: number; // total paid cool-down wages for the day
  peakTempWorkedF: number;
}

function workSlots(p: CrewPlan, crew: Crew, risks: HourlyRisk[], fn: (r: HourlyRisk | undefined, minutes: number) => void) {
  for (const b of p.blocks) {
    if (b.kind !== "work") continue;
    const fieldId = b.fieldId ?? crew.fieldId;
    for (let m = toMin(b.start); m < toMin(b.end); m += 10) {
      const hr = Math.floor(m / 60);
      fn(risks.find((r) => r.fieldId === fieldId && Number(r.time.slice(11, 13)) === hr), Math.min(10, toMin(b.end) - m));
    }
  }
}

export function impactOf(plan: ShiftPlan, crews: Crew[], risks: HourlyRisk[]): Impact {
  let extreme = 0;
  let danger = 0;
  let work = 0;
  let pay = 0;
  let peak = 0;
  for (const p of plan.crews) {
    const crew = crews.find((c) => c.id === p.crewId);
    if (!crew) continue;
    workSlots(p, crew, risks, (r, min) => {
      work += min / crews.length;
      if (!r) return;
      peak = Math.max(peak, r.tempF);
      if (r.band === "extreme") extreme += (crew.size * min) / 60;
      if (r.band === "extreme" || r.band === "high") danger += (crew.size * min) / 60;
    });
    for (const b of p.blocks) {
      if (b.kind === "cooldown") pay += crew.size * (crew.pieceRateUsdPerHour ?? 22) * ((toMin(b.end) - toMin(b.start)) / 60);
    }
  }
  return {
    extremeWorkerHours: Math.round(extreme),
    dangerWorkerHours: Math.round(danger),
    violations: plan.violations.length,
    workHoursPerWorker: Math.round((work / 60) * 10) / 10,
    paidBreakUsd: Math.round(pay),
    peakTempWorkedF: peak,
  };
}

// One plain-English line per crew: what Sombra changed and why.
export function changes(before: ShiftPlan, after: ShiftPlan, crews: Crew[], fields: Field[]): string[] {
  const name = (id?: string) => fields.find((f) => f.id === id)?.name ?? id;
  const fmt = (m: number) => {
    const h = Math.floor(m / 60);
    const mm = String(m % 60).padStart(2, "0");
    return `${((h + 11) % 12) + 1}:${mm}${h < 12 ? "am" : "pm"}`;
  };
  return crews.map((c) => {
    const a = before.crews.find((p) => p.crewId === c.id);
    const b = after.crews.find((p) => p.crewId === c.id);
    if (!a || !b) return `${c.name}: unchanged`;
    const parts: string[] = [];
    const s0 = toMin(a.blocks[0].start), s1 = toMin(b.blocks[0].start);
    const e0 = toMin(a.blocks[a.blocks.length - 1].end), e1 = toMin(b.blocks.filter((x) => x.kind === "work").at(-1)?.end ?? b.blocks[b.blocks.length - 1].end);
    if (s1 < s0) parts.push(`starts ${fmt(s1)} instead of ${fmt(s0)}`);
    if (e1 < e0) parts.push(`done by ${fmt(e1)}, before the worst heat`);
    const f0 = a.blocks.find((x) => x.kind === "work")?.fieldId, f1 = b.blocks.find((x) => x.kind === "work")?.fieldId;
    if (f0 !== f1) parts.push(`moved to ${name(f1)}`);
    const cools = b.blocks.filter((x) => x.kind === "cooldown").length;
    if (cools) parts.push(`${cools} paid cool-down${cools > 1 ? "s" : ""}`);
    if (b.shadeUnits > a.shadeUnits) parts.push(`${b.shadeUnits} shade canopies`);
    if (c.newWorkers) parts.push(`protects ${c.newWorkers} new worker${c.newWorkers > 1 ? "s" : ""}`);
    return `${c.name}: ${parts.join(", ") || "already safe"}.`;
  });
}
