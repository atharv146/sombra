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

// Worker-hours spent working in extreme heat from the start of the day up to `minute` (for the live counter).
export function extremeUntil(plan: ShiftPlan, crews: Crew[], risks: HourlyRisk[], minute: number): number {
  let total = 0;
  for (const p of plan.crews) {
    const crew = crews.find((c) => c.id === p.crewId);
    if (!crew) continue;
    for (const b of p.blocks) {
      if (b.kind !== "work") continue;
      const fieldId = b.fieldId ?? crew.fieldId;
      for (let m = toMin(b.start); m < Math.min(toMin(b.end), minute); m += 10) {
        const r = risks.find((x) => x.fieldId === fieldId && Number(x.time.slice(11, 13)) === Math.floor(m / 60));
        if (r?.band === "extreme") total += (crew.size * 10) / 60;
      }
    }
  }
  return Math.round(total);
}

export interface DayEvent {
  at: number; // minutes since midnight
  text: string;
  tone: "good" | "bad" | "alert" | "info";
}

// The story of the day, both versions, as timed events for "Play the day".
export function dayEvents(before: ShiftPlan, after: ShiftPlan, crews: Crew[], risks: HourlyRisk[], fields: Field[]): DayEvent[] {
  const ev: DayEvent[] = [];
  const name = (id?: string) => fields.find((f) => f.id === id)?.name ?? id;
  for (const p of after.crews) {
    const c = crews.find((x) => x.id === p.crewId);
    if (!c) continue;
    const work = p.blocks.filter((b) => b.kind === "work");
    if (work[0]) ev.push({ at: toMin(work[0].start), text: `${c.name} starts at ${name(work[0].fieldId)} while it's still cool`, tone: "good" });
    for (const b of p.blocks.filter((x) => x.kind === "cooldown"))
      ev.push({ at: toMin(b.start), text: `${c.name}: paid 10-minute cool-down in the shade (+$${Math.round(c.size * (c.pieceRateUsdPerHour ?? 22) / 6)} wages)`, tone: "good" });
    const last = work.at(-1);
    if (last) ev.push({ at: toMin(last.end), text: `${c.name} done for the day, before the worst heat`, tone: "good" });
  }
  for (const p of before.crews) {
    const c = crews.find((x) => x.id === p.crewId);
    if (!c) continue;
    const field = p.blocks.find((b) => b.kind === "work")?.fieldId ?? c.fieldId;
    const hot = p.blocks
      .filter((b) => b.kind === "work")
      .flatMap((b) => Array.from({ length: Math.ceil((toMin(b.end) - toMin(b.start)) / 60) }, (_, i) => toMin(b.start) + i * 60))
      .find((m) => risks.find((r) => r.fieldId === field && Number(r.time.slice(11, 13)) === Math.floor(m / 60))?.band === "extreme");
    if (hot !== undefined)
      ev.push({ at: hot, text: `Usual day: ${c.name}${c.newWorkers ? ` (${c.newWorkers} new workers)` : ""} would be picking in deadly heat right now`, tone: "bad" });
  }
  const firstExtreme = risks.filter((r) => r.band === "extreme").map((r) => Number(r.time.slice(11, 13)) * 60).sort((a, b) => a - b)[0];
  if (firstExtreme !== undefined) ev.push({ at: firstExtreme, text: "Deadly heat begins: heat alert sent to every worker's phone", tone: "alert" });
  return ev.sort((a, b) => a.at - b.at);
}
