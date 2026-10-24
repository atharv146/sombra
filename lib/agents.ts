// The Sombra swarm. Agents are config + a prompt; runSwarm() orchestrates them and emits AgentEvents.
import "server-only";
import { callModel, modelName, parseJSON, streamModel } from "./llm";
import { autoFix, checkPlan, dayPlan, RULES, toMin, usualPlan } from "./rules";
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
// If the model call fails, the agent says so and uses `fallback` (rules-based text) so the demo keeps going.
async function run(emit: Emit, agent: AgentId, system: string, prompt: string, maxTokens = 700, fallback = "") {
  emit({ type: "agent_start", agent, model: modelName() });
  let all = "";
  let shown = 0;
  try {
    for await (const chunk of streamModel({ system, prompt, maxTokens })) {
      all += chunk;
      const cut = all.indexOf(SPLIT);
      const visible = cut === -1 ? all.slice(0, Math.max(0, all.length - SPLIT.length)) : all.slice(0, cut);
      if (visible.length > shown) {
        emit({ type: "agent_delta", agent, text: visible.slice(shown) });
        shown = visible.length;
      }
    }
  } catch (err) {
    console.error(`[${agent}]`, err);
    const text = `Model unavailable, using the rules engine.\n${fallback}`.trim();
    emit({ type: "agent_delta", agent, text: (shown ? "\n" : "") + text });
    return { text, json: "", failed: true };
  }
  const cut = all.indexOf(SPLIT);
  const text = (cut === -1 ? all : all.slice(0, cut)).trim();
  if (cut === -1 && text.length > shown) emit({ type: "agent_delta", agent, text: text.slice(shown) });
  return { text, json: cut === -1 ? "" : all.slice(cut + SPLIT.length), failed: false };
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
    `Hourly conditions on ${input.date} (${input.mode === "replay" ? "real archived heat-wave data" : "today's live forecast"}):\n${table}\n\nIn 3 short lines (under 20 words each, use field names, not ids): when each field becomes dangerous, the worst hour, and which field stays coolest and why.`,
    300,
    skyFallback(risks, fields),
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
    crewInfo: crews,
  };
  plan.violations = checkPlan(plan, crews, risks);
  emit({ type: "plan", plan, revision: 0 });
  const usual = { crews: plan.crews, violations: plan.violations };

  const [, critique] = await Promise.all([
    run(
      emit,
      "ley",
      `You are Ley, a Cal/OSHA compliance checker. Only restate the violations you are given, citing the subsection shown. Never invent legal requirements. ${voice}`,
      `Violations found by the rules engine in the usual schedule:\n${violationText(plan.violations)}\n\nExplain them in at most 4 lines, most dangerous first.`,
      300,
      violationText(plan.violations),
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
      plan.violations.length ? `The usual day breaks ${plan.violations.length} rules.` : "No rule violations.",
    ),
  ]);
  const rejected = plan.violations.length > 0 || /VERDICT:\s*REJECT/i.test(critique.text);
  emit({ type: "agent_done", agent: "critico", summary: rejected ? "Rejected the usual schedule" : "Approved", verdict: rejected ? "reject" : "approve" });

  // 3. Cuadrilla rewrites the day.
  if (rejected) {
    // Cuadrilla answers in JSON (reasoning models ramble otherwise); its "why" lines go to the card.
    type Decision = { why?: string[]; summary?: string; crews: { crewId: string; fieldId: string; start: string; end: string }[] };
    emit({ type: "agent_start", agent: "cuadrilla", model: modelName() });
    let parsed: Decision | null = null;
    try {
      parsed = parseJSON<Decision>(
        await callModel({
          system: `You are Cuadrilla, the crew planner. You decide each crew's field and hours so the day is safe and still productive.`,
          prompt:
      `Options (latest safe end for each crew at each field):\n${crewOptions(crews, risks, fields)}\nUsual shift: ${input.start}-${input.end} (${(toMin(input.end) - toMin(input.start) - 30) / 60} work hours).\nCritic said:\n${critique.text}\n${input.note ? `Crew lead's note: ${input.note}\n` : ""}
Pick a field and hours for each crew. Start as early as 04:30 to recover hours. Prefer shaded fields for crews with new workers. Two crews may share a field. The rules engine adds the paid cool-downs, water and shade, so don't plan those.

Reply with JSON only, no working shown:
{"why": ["3 lines for the crew boss, under 20 words each"], "summary": "one sentence", "crews": [{"crewId": "c1", "fieldId": "french-camp", "start": "04:30", "end": "12:30"}]}`,
          json: true,
          maxTokens: 2500,
        }),
      );
      emit({ type: "agent_delta", agent: "cuadrilla", text: (parsed.why ?? []).join("\n") });
    } catch (err) {
      console.error("[cuadrilla]", err);
      emit({ type: "agent_delta", agent: "cuadrilla", text: "Model unavailable, using the rules engine.\nStarting early, ending new workers' day before extreme heat." });
    }
    let decided = 0;
    if (parsed) {
      const hhmm = /^\d{2}:\d{2}$/;
      const d0 = parsed;
      plan = {
        ...plan,
        summary: d0.summary || plan.summary,
        crews: crews.map((c) => {
          const d = d0.crews?.find((x) => x.crewId === c.id);
          const ok =
            d && fields.some((f) => f.id === d.fieldId) && hhmm.test(d.start) && hhmm.test(d.end) &&
            toMin(d.start) >= toMin("04:30") && toMin(d.end) - toMin(d.start) >= 120;
          if (!ok) return dayPlan(c, c.fieldId, input.start, input.end);
          decided++;
          return dayPlan(c, d.fieldId, d.start, d.end);
        }),
      };
    } else {
      // No model: start at 4:30 to win back the hours lost to the heat; the rules engine ends the day before deadly heat.
      const hours = toMin(input.end) - toMin(input.start);
      plan = {
        ...plan,
        summary: "Rebuilt by the rules engine: earlier start, done before deadly heat",
        crews: crews.map((c) => dayPlan(c, c.fieldId, "04:30", `${String(Math.floor((270 + hours) / 60)).padStart(2, "0")}:${String((270 + hours) % 60).padStart(2, "0")}`)),
      };
    }
    // The agent picks fields and hours; code inserts cool-downs and sizes water and shade, then re-checks.
    plan = autoFix(plan, crews, risks);
    const violations = checkPlan(plan, crews, risks);
    const cooldowns = plan.crews.reduce((n, p) => n + p.blocks.filter((b) => b.kind === "cooldown").length, 0);
    plan.violations = violations;
    emit({
      type: "agent_done",
      agent: "cuadrilla",
      summary: `${decided ? `Chose fields and hours for ${decided} crew${decided > 1 ? "s" : ""}` : "Kept usual hours"}; rules engine added ${cooldowns} paid cool-downs`,
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
      plan.violations.length ? "Still breaks a rule." : "Every rule passes. Watch new workers closely after 11am.",
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
    plan.briefings = templateBriefings(plan, crews);
  }
  emit({ type: "agent_done", agent: "voz", summary: `Briefings ready in ${Object.keys(plan.briefings).length} languages` });

  plan.usual = usual.crews;
  plan.usualViolations = usual.violations;
  plan.createdAt = new Date().toISOString();
  await savePlan(plan);
  emit({ type: "plan", plan, revision: 2 });
  return plan;
}

// Rules-based fallbacks, used only when the model call fails.
function skyFallback(risks: HourlyRisk[], fields: Field[]) {
  return fields
    .map((f) => {
      const rows = risks.filter((r) => r.fieldId === f.id);
      const danger = rows.find((r) => r.band === "high" || r.band === "extreme");
      const peak = rows.reduce((a, b) => (b.tempF > a.tempF ? b : a), rows[0]);
      return `${f.name}: ${danger ? `dangerous from ${danger.time.slice(11, 16)}` : "no dangerous hours"}, peak ${peak?.tempF}°F at ${peak?.time.slice(11, 16)}.`;
    })
    .join("\n");
}

function templateBriefings(plan: ShiftPlan, crews: Crew[]): Partial<Record<Lang, string>> {
  const line = (lang: "es" | "en") =>
    plan.crews
      .map((p) => {
        const c = crews.find((x) => x.id === p.crewId);
        const start = p.blocks[0]?.start;
        const cools = p.blocks.filter((b) => b.kind === "cooldown").map((b) => b.start).join(", ");
        return lang === "es"
          ? `${c?.name}: entrada a las ${start}.${cools ? ` Descansos pagados a las ${cools}.` : ""}`
          : `${c?.name}: start at ${start}.${cools ? ` Paid cool-down breaks at ${cools}.` : ""}`;
      })
      .join(" ");
  return {
    es: `${line("es")} Tome agua cada 15 minutos. Si siente mareo, dolor de cabeza, náusea o confusión, avise al mayordomo de inmediato.`,
    en: `${line("en")} Drink water every 15 minutes. If you feel dizzy, a headache, nausea or confusion, tell the mayordomo right away.`,
  };
}

function crewOptions(crews: Crew[], risks: HourlyRisk[], fields: Field[]) {
  const firstExtreme = (fieldId: string) => risks.find((r) => r.fieldId === fieldId && r.band === "extreme")?.time.slice(11, 16);
  return crews
    .map((c) => {
      const opts = fields.map((f) => {
        const ex = firstExtreme(f.id);
        const limit = c.newWorkers > 0 && ex ? `by ${ex}` : "any time";
        return `${f.id} (${f.shade} shade) ${limit}`;
      });
      return `${c.name} [${c.id}] ${c.size} workers, ${c.newWorkers} new: ${opts.join(", ")}`;
    })
    .join("\n");
}
