// The Sombra swarm. Agents are config + a prompt; runSwarm() orchestrates them and emits AgentEvents.
import "server-only";
import { modelName, parseJSON, streamModel } from "./llm";
import { autoFix, checkPlan, usualPlan } from "./rules";
import { savePlan } from "./store";
import { fetchRisks } from "./weather";
import type { AgentEvent, AgentId, Crew, CrewPlan, Field, HourlyRisk, Lang, RuleViolation, ShiftPlan } from "./types";

export const AGENTS: Record<AgentId, { name: string; role: string; color: string }> = {
  cielo: { name: "Cielo", role: "Sky scout: heat, sun, smoke by the hour", color: "#d97706" },
  ley: { name: "Ley", role: "Law: checks Cal/OSHA §3395 and §5141.1", color: "#2563eb" },
  critico: { name: "Crítico", role: "Critic: tries to break the plan", color: "#dc2626" },
  cuadrilla: { name: "Cuadrilla", role: "Crew planner: hours, fields, water, shade", color: "#16a34a" },
  voz: { name: "Voz", role: "Voice: briefings in Spanish, Punjabi, English", color: "#7c3aed" },
  medic: { name: "Medic", role: "Second opinion on worker check-ins", color: "#be185d" },
};

export interface SwarmInput {
  mode: "live" | "replay";
  date: string;
  start: string; // crew lead's usual start, "06:00"
  end: string; // usual end, "14:30"
  crews: Crew[];
  fields: Field[];
  note?: string; // free text from the crew lead
}

type Emit = (e: AgentEvent) => void;
const SPLIT = "###JSON";

// Streams an agent's visible reasoning; anything after ###JSON is hidden and returned as `json`.
async function run(emit: Emit, agent: AgentId, system: string, prompt: string, maxTokens = 700) {
  emit({ type: "agent_start", agent, model: modelName() });
  let all = "";
  let shown = 0;
  for await (const chunk of streamModel({ system, prompt, maxTokens })) {
    all += chunk;
    const cut = all.indexOf(SPLIT);
    const visible = cut === -1 ? all.slice(0, Math.max(0, all.length - SPLIT.length)) : all.slice(0, cut);
    if (visible.length > shown) {
      emit({ type: "agent_delta", agent, text: visible.slice(shown) });
      shown = visible.length;
    }
  }
  const cut = all.indexOf(SPLIT);
  const text = (cut === -1 ? all : all.slice(0, cut)).trim();
  if (cut === -1 && text.length > shown) emit({ type: "agent_delta", agent, text: text.slice(shown) });
  return { text, json: cut === -1 ? "" : all.slice(cut + SPLIT.length) };
}

function riskTable(risks: HourlyRisk[], fields: Field[]) {
  return fields
    .map((f) => {
      const rows = risks
        .filter((r) => r.fieldId === f.id)
        .map((r) => `${r.time.slice(11, 16)} ${r.tempF}°F WBGT ${r.wbgtF} ${r.band}${r.aqi !== undefined ? ` AQI ${r.aqi}` : ""}`);
      return `${f.name} [${f.id}] (shade: ${f.shade})\n${rows.join("\n")}`;
    })
    .join("\n\n");
}

function planText(crews: CrewPlan[], all: Crew[]) {
  return crews
    .map((p) => {
      const c = all.find((x) => x.id === p.crewId)!;
      const blocks = p.blocks.map((b) => `${b.start}-${b.end} ${b.kind}${b.fieldId ? ` @${b.fieldId}` : ""}`).join(", ");
      return `${c.name} [${c.id}] ${c.size} workers, ${c.newWorkers} new: ${blocks}; water ${p.waterGallons} gal; shade ${p.shadeUnits}`;
    })
    .join("\n");
}

const violationText = (v: RuleViolation[]) => (v.length ? v.map((x) => `- ${x.message}`).join("\n") : "None.");

export async function runSwarm(input: SwarmInput, emit: Emit): Promise<ShiftPlan> {
  const { crews, fields } = input;
  const id = Math.random().toString(36).slice(2, 8);
  const voice = "Write like a calm field safety lead texting a crew boss: short lines, no markdown headers, no emoji.";

  // 1. Cielo reads the sky.
  const risks = await fetchRisks(fields, input.mode, input.date);
  emit({ type: "risk", risks });
  const table = riskTable(risks, fields);
  await run(
    emit,
    "cielo",
    `You are Cielo, the weather scout for a Central Valley farm labor crew. ${voice}`,
    `Hourly conditions on ${input.date} (${input.mode === "replay" ? "real archived heat-wave data" : "today's live forecast"}):\n${table}\n\nIn 3 short lines: when each field becomes dangerous, the worst hour, and which field stays coolest and why.`,
    300,
  );
  emit({ type: "agent_done", agent: "cielo", summary: "Heat windows mapped for every field" });

  // 2. Start from the crew lead's usual day and audit it.
  let plan: ShiftPlan = {
    id,
    date: input.date,
    mode: input.mode,
    crews: usualPlan(crews, input.start, input.end),
    violations: [],
    briefings: {},
    summary: "Your usual schedule",
  };
  plan.violations = checkPlan(plan, crews, risks);
  emit({ type: "plan", plan, revision: 0 });

  const [, critique] = await Promise.all([
    run(
      emit,
      "ley",
      `You are Ley, a Cal/OSHA compliance checker. Only restate the violations you are given, citing the subsection shown. Never invent legal requirements. ${voice}`,
      `Violations found by the rules engine in the usual schedule:\n${violationText(plan.violations)}\n\nExplain them in at most 4 lines, most dangerous first.`,
      300,
    ).then((r) => {
      emit({ type: "agent_done", agent: "ley", summary: `${plan.violations.length} rule violations in the usual schedule` });
      return r;
    }),
    run(
      emit,
      "critico",
      `You are Crítico, a skeptical safety officer. Your job is to find how this plan could put a worker in the hospital. ${voice}`,
      `Schedule:\n${planText(plan.crews, crews)}\n\nConditions:\n${table}\n\nRules engine violations:\n${violationText(plan.violations)}\n\nName the 2-3 most dangerous problems in one line each, then end with exactly "VERDICT: REJECT" or "VERDICT: APPROVE".`,
      300,
    ),
  ]);
  const rejected = plan.violations.length > 0 || /VERDICT:\s*REJECT/i.test(critique.text);
  emit({ type: "agent_done", agent: "critico", summary: rejected ? "Rejected the usual schedule" : "Approved", verdict: rejected ? "reject" : "approve" });

  // 3. Cuadrilla rewrites the day.
  if (rejected) {
    const draft = await run(
      emit,
      "cuadrilla",
      `You are Cuadrilla, the crew planner. You rebuild a farm crew's day to be safe and still productive. ${voice}`,
      `Crews: ${JSON.stringify(crews)}\nFields: ${JSON.stringify(fields)}\nUsual schedule:\n${planText(plan.crews, crews)}\nConditions:\n${table}\nProblems:\n${violationText(plan.violations)}\nCritic:\n${critique.text}\n${input.note ? `Crew lead's note: ${input.note}\n` : ""}
Rules you must meet: at 95°F+ a 10-minute paid "cooldown" block at least every 2 hours of work; water >= workers x work hours / 4 gallons; 1 shade canopy per 10 workers; crews with new workers must not work "extreme" WBGT hours. You may start as early as 04:30, move crews to cooler or shaded fields, and end early. Keep roughly the same total work hours where it's safe.

First write 3 short lines explaining your changes. Then write ${SPLIT} on its own line, then one JSON object:
{"summary": "one sentence", "crews": [{"crewId": "...", "blocks": [{"start":"HH:MM","end":"HH:MM","kind":"work|cooldown|meal|travel","fieldId":"... (work only)","paid": true}], "waterGallons": 0, "shadeUnits": 0, "notes": ["..."]}]}`,
      2000,
    );
    try {
      const parsed = parseJSON<{ summary: string; crews: CrewPlan[] }>(draft.json || draft.text);
      plan = { ...plan, crews: parsed.crews, summary: parsed.summary };
    } catch {
      plan = { ...plan, summary: "Rebuilt by the rules engine" };
    }
    let violations = checkPlan(plan, crews, risks);
    let patched = 0;
    if (violations.length) {
      patched = violations.length;
      plan = autoFix(plan, crews, risks);
      violations = checkPlan(plan, crews, risks);
    }
    plan.violations = violations;
    emit({
      type: "agent_done",
      agent: "cuadrilla",
      summary: patched ? `New plan; rules engine patched ${patched} leftover issue${patched > 1 ? "s" : ""}` : "New plan passes every rule",
    });
    emit({ type: "plan", plan, revision: 1 });
  }

  // 4. Crítico re-checks while Voz writes the briefings.
  const [, briefing] = await Promise.all([
    run(
      emit,
      "critico",
      `You are Crítico, a skeptical safety officer. ${voice}`,
      `Revised schedule:\n${planText(plan.crews, crews)}\nRules engine violations: ${violationText(plan.violations)}\nIn 2 lines: what's still the riskiest moment, and what the crew boss should watch for. End with "VERDICT: APPROVE" if there are no violations, else "VERDICT: REJECT".`,
      200,
    ).then(() =>
      emit({
        type: "agent_done",
        agent: "critico",
        summary: plan.violations.length ? "Still unsafe" : "Approved the revised plan",
        verdict: plan.violations.length ? "reject" : "approve",
      }),
    ),
    run(
      emit,
      "voz",
      `You are Voz. You write spoken safety briefings for farmworkers at a 5th-grade reading level. Natural Mexican Spanish, Punjabi in Gurmukhi script, plain English.`,
      `Plan:\n${planText(plan.crews, crews)}\nWrite one line saying which languages you're writing. Then ${SPLIT} on its own line, then JSON {"es": "...", "pa": "...", "en": "..."}. Each briefing under 70 words: start time per crew, when cool-down breaks are, that cool-down breaks are paid, drink water every 15 minutes, and to tell the mayordomo right away about dizziness, headache, nausea or confusion.`,
      1500,
    ),
  ]);
  try {
    plan.briefings = parseJSON<Partial<Record<Lang, string>>>(briefing.json || briefing.text);
  } catch {
    plan.briefings = {};
  }
  emit({ type: "agent_done", agent: "voz", summary: `Briefings ready in ${Object.keys(plan.briefings).length} languages` });

  await savePlan(plan);
  emit({ type: "plan", plan, revision: 2 });
  return plan;
}
