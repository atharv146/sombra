// Deterministic compliance engine. The LLM agents draft and explain; this file decides.
// Thresholds from Cal/OSHA §3395 (heat) and §5141.1 (wildfire smoke). Teammate verifies against dir.ca.gov.
import type { Crew, CrewPlan, HourlyRisk, RuleViolation, ShiftBlock, ShiftPlan } from "./types";

export const RULES = {
  shadeF: 80, // §3395(d): shade up at or above 80°F
  highHeatF: 95, // §3395(e): high-heat procedures at or above 95°F
  cooldownEveryMin: 120, // §3395(e)(6) agriculture: 10-min net cool-down rest every 2 hours at 95°F+
  cooldownMin: 10,
  quartsPerWorkerHour: 1, // §3395(c): at least 1 quart per employee per hour
  workersPerShade: 10, // Sombra sizing: one canopy per 10 workers
  smokeAqi: 151, // §5141.1: respirators provided at AQI 151+
  smokeAqiRequired: 500, // §5141.1: respirator use required above 500
};

export const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
export const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function riskAt(risks: HourlyRisk[], fieldId: string, minute: number): HourlyRisk | undefined {
  const hr = Math.floor(minute / 60);
  return risks.find((r) => r.fieldId === fieldId && Number(r.time.slice(11, 13)) === hr);
}

function workMinutes(p: CrewPlan) {
  return p.blocks.filter((b) => b.kind === "work").reduce((s, b) => s + toMin(b.end) - toMin(b.start), 0);
}

export function required(crew: Crew, p: CrewPlan) {
  return {
    waterGallons: Math.ceil((crew.size * (workMinutes(p) / 60) * RULES.quartsPerWorkerHour) / 4),
    shadeUnits: Math.ceil(crew.size / RULES.workersPerShade),
  };
}

export function checkPlan(plan: ShiftPlan, crews: Crew[], risks: HourlyRisk[]): RuleViolation[] {
  const out: RuleViolation[] = [];
  for (const p of plan.crews) {
    const crew = crews.find((c) => c.id === p.crewId);
    if (!crew) continue;
    const need = required(crew, p);
    let maxTemp = 0;
    let sinceRest = 0;
    let cooldownFlagged = false;
    let acclimFlagged = false;
    const blocks = [...p.blocks].sort((a, b) => toMin(a.start) - toMin(b.start));
    for (const b of blocks) {
      if (b.kind !== "work") {
        if (toMin(b.end) - toMin(b.start) >= RULES.cooldownMin) sinceRest = 0;
        continue;
      }
      const fieldId = b.fieldId ?? crew.fieldId;
      for (let m = toMin(b.start); m < toMin(b.end); m += 10) {
        const r = riskAt(risks, fieldId, m);
        if (!r) continue;
        maxTemp = Math.max(maxTemp, r.tempF);
        sinceRest += 10;
        if (r.tempF >= RULES.highHeatF && sinceRest > RULES.cooldownEveryMin && !cooldownFlagged) {
          cooldownFlagged = true;
          out.push({
            rule: "cooldown_2h",
            crewId: crew.id,
            time: toHHMM(m),
            message: `${crew.name} works over 2 hours without a 10-minute cool-down at ${r.tempF}°F (§3395(e)(6)).`,
          });
        }
        if (crew.newWorkers > 0 && r.band === "extreme" && !acclimFlagged) {
          acclimFlagged = true;
          out.push({
            rule: "acclimatization_14d",
            crewId: crew.id,
            time: toHHMM(m),
            message: `${crew.name} has ${crew.newWorkers} workers in their first 14 days working at WBGT ${r.wbgtF}°F. §3395(g) requires close observation; Sombra keeps new workers out of extreme hours.`,
          });
        }
        if (r.aqi !== undefined && r.aqi > RULES.smokeAqiRequired) {
          out.push({ rule: "smoke_500", crewId: crew.id, time: toHHMM(m), message: `AQI ${r.aqi}: respirators required (§5141.1).` });
        }
      }
    }
    if (maxTemp >= RULES.shadeF && p.shadeUnits < need.shadeUnits) {
      out.push({
        rule: "shade_80",
        crewId: crew.id,
        message: `${crew.name} needs ${need.shadeUnits} shade canopies for ${crew.size} workers at ${maxTemp}°F; plan has ${p.shadeUnits} (§3395(d)).`,
      });
    }
    if (p.waterGallons < need.waterGallons) {
      out.push({
        rule: "water_quart_hour",
        crewId: crew.id,
        message: `${crew.name} needs ${need.waterGallons} gal of water (1 qt per worker per hour); plan has ${p.waterGallons} (§3395(c)).`,
      });
    }
  }
  return out;
}

// One crew's day at one field: a work block, a 30-minute meal in the middle, a work block. No cool-downs yet.
export function dayPlan(crew: Crew, fieldId: string, start: string, end: string): CrewPlan {
  const s = toMin(start);
  const e = toMin(end);
  const meal = s + Math.round((e - s) / 2 / 30) * 30;
  return {
    crewId: crew.id,
    blocks: [
      { start: toHHMM(s), end: toHHMM(meal), kind: "work", fieldId },
      { start: toHHMM(meal), end: toHHMM(meal + 30), kind: "meal" },
      { start: toHHMM(meal + 30), end: toHHMM(e), kind: "work", fieldId },
    ],
    waterGallons: Math.ceil(crew.size * 2),
    shadeUnits: 1,
    notes: [],
  };
}

// The crew lead's usual day: one long block with a meal, no cool-downs. Sombra audits this.
export function usualPlan(crews: Crew[], start: string, end: string): CrewPlan[] {
  return crews.map((c) => dayPlan(c, c.fieldId, start, end));
}

// Safety net: if the agents' revision still breaks a rule, fix it in code so a non-compliant plan can't ship.
export function autoFix(plan: ShiftPlan, crews: Crew[], risks: HourlyRisk[]): ShiftPlan {
  const crewsOut = plan.crews.map((p) => {
    const crew = crews.find((c) => c.id === p.crewId)!;
    const blocks: ShiftBlock[] = [];
    let sinceRest = 0;
    for (const b of [...p.blocks].sort((a, b) => toMin(a.start) - toMin(b.start))) {
      if (b.kind !== "work") {
        blocks.push(b);
        if (toMin(b.end) - toMin(b.start) >= RULES.cooldownMin) sinceRest = 0;
        continue;
      }
      const fieldId = b.fieldId ?? crew.fieldId;
      let cur = toMin(b.start);
      const end = toMin(b.end);
      while (cur < end) {
        const r = riskAt(risks, fieldId, cur);
        if (r?.band === "extreme") break; // Sombra policy: no hard work in deadly (extreme WBGT) heat, for any crew
        const hot = (r?.tempF ?? 0) >= RULES.highHeatF;
        if (hot && sinceRest >= RULES.cooldownEveryMin) {
          // Already at the 2-hour limit when the heat arrives: cool down before working on.
          blocks.push({ start: toHHMM(cur), end: toHHMM(cur + RULES.cooldownMin), kind: "cooldown", paid: true });
          cur += RULES.cooldownMin;
          sinceRest = 0;
          continue;
        }
        const nextHour = (Math.floor(cur / 60) + 1) * 60; // step at most an hour so every hour's band is checked
        const room = hot ? RULES.cooldownEveryMin - sinceRest : nextHour - cur;
        const stop = Math.min(end, cur + room, nextHour);
        blocks.push({ ...b, start: toHHMM(cur), end: toHHMM(stop), fieldId });
        sinceRest += stop - cur;
        cur = stop;
        if (hot && sinceRest >= RULES.cooldownEveryMin && cur < end) {
          blocks.push({ start: toHHMM(cur), end: toHHMM(cur + RULES.cooldownMin), kind: "cooldown", paid: true });
          cur += RULES.cooldownMin;
          sinceRest = 0;
        }
      }
      if (cur < end) break;
    }
    const fixed: CrewPlan = { ...p, blocks: mergeAdjacent(blocks) };
    const need = required(crew, fixed);
    return { ...fixed, waterGallons: Math.max(fixed.waterGallons, need.waterGallons), shadeUnits: Math.max(fixed.shadeUnits, need.shadeUnits) };
  });
  return { ...plan, crews: crewsOut };
}

function mergeAdjacent(blocks: ShiftBlock[]): ShiftBlock[] {
  const out: ShiftBlock[] = [];
  for (const b of blocks) {
    const last = out[out.length - 1];
    if (last && last.kind === "work" && b.kind === "work" && last.end === b.start && last.fieldId === b.fieldId) {
      last.end = b.end;
    } else out.push({ ...b });
  }
  return out;
}
