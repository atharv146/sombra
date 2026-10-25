"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { AgentId, HourlyRisk, ShiftPlan, TriageLabel } from "@/lib/types";
import type { AgentCard } from "./AgentPanel";
import { AgentFloor } from "./AgentFloor";

const NAME: Record<AgentId, string> = { cielo: "Cielo", ley: "Ley", critico: "Crítico", cuadrilla: "Cuadrilla", voz: "Voz", medic: "Medic" };
const JOB: Record<AgentId, string> = {
  cielo: "Reads hourly heat, humidity, sun, wind and smoke for every field",
  ley: "Checks the day against Cal/OSHA §3395 and §5141.1, citing each rule",
  critico: "A skeptical safety officer that tries to break the plan, and can reject it",
  cuadrilla: "Chooses each crew's field and hours; the rules engine then adds breaks, water and shade",
  voz: "Writes each crew's spoken briefing in Spanish, Punjabi and English",
  medic: "Second opinion on worker check-ins, with first-aid steps",
};
const ORDER: AgentId[] = ["cielo", "ley", "critico", "cuadrilla", "voz"];

function chip(c?: AgentCard) {
  if (!c || c.status === "idle") return { text: "waiting", cls: "text-[var(--muted)] border-[var(--line)]" };
  if (c.status === "thinking") return { text: "thinking", cls: "text-[var(--brand)] border-[var(--brand)]" };
  if (c.text.startsWith("AI busy")) return { text: "rules fallback", cls: "text-[var(--muted)] border-[var(--line)]" };
  if (c.verdict === "reject") return { text: "rejected", cls: "text-[var(--bad-ink)] border-[var(--bad-ink)]" };
  return { text: "done", cls: "text-[var(--good-ink)] border-[var(--good-ink)]" };
}

// The AI "brain": the live agent line, every agent's full reasoning, and an expandable map of how work flows between models.
export function AIBrain({
  cards,
  risks,
  draft,
  final,
  alerts,
}: {
  cards: AgentCard[];
  risks: HourlyRisk[];
  draft: ShiftPlan | null;
  final: ShiftPlan | null;
  alerts: Record<string, TriageLabel>;
}) {
  const [big, setBig] = useState(false);
  const [focus, setFocus] = useState<AgentId>("critico");
  // While the brain is open, the page behind it stays still.
  useEffect(() => {
    document.body.style.overflow = big ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [big]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setBig(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);
  const card = (id: AgentId) => cards.find((c) => c.id === id);
  const cooldowns = final?.crews.reduce((n, p) => n + p.blocks.filter((b) => b.kind === "cooldown").length, 0) ?? 0;
  const briefings = final?.crewBriefings ? Object.keys(final.crewBriefings).length : 0;
  const crit = card("critico");

  // What travels along each link, from real data.
  const links = {
    weather: risks.length ? `${risks.length} hourly readings` : "forecast",
    cielo: risks.length ? `${risks.filter((r) => r.band === "extreme").length} deadly field-hours` : "heat bands",
    ley: draft ? `${draft.violations.length} violations` : "rule report",
    critico: crit?.verdict ? `verdict: ${crit.verdict === "reject" ? "reject" : "approve"}` : "verdict",
    cuadrilla: final ? `${final.crews.length} crew decisions` : "fields + hours",
    rules: final ? `+${cooldowns} cool-downs, ${final.violations.length} violations` : "checked plan",
    voz: briefings ? `${briefings} briefings × 3 languages` : "briefings",
  };

  const Node = ({ id, label, sub, kind = "agent" }: { id?: AgentId; label: string; sub: string; kind?: "agent" | "data" | "code" }) => {
    const c = id ? card(id) : undefined;
    const st = id ? chip(c) : null;
    return (
      <button
        onClick={() => id && setFocus(id)}
        style={id ? { borderTop: `3px solid var(--a-${id})` } : undefined}
        className={`w-full rounded-[6px] border p-3 text-left transition-colors ${kind === "code" ? "border-dashed border-[var(--brand)]" : kind === "data" ? "border-[var(--line)] bg-[var(--track)]" : focus === id ? "border-[var(--ink)] bg-[var(--card)]" : "border-[var(--line)] bg-[var(--card)]"} ${c?.status === "thinking" ? "agent-breathe" : ""}`}
      >
        <p className="font-display text-xl leading-none" style={{ color: id ? `var(--a-${id})` : undefined }}>{label}</p>
        <p className="mt-1 text-[11px] leading-snug text-[var(--muted)]">{sub}</p>
        {st && <span className={`mt-2 inline-block rounded-[4px] border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${st.cls}`}>{st.text}</span>}
        {c?.model && <p className="mt-1 truncate text-[10px] text-[var(--muted)]">{c.model}</p>}
      </button>
    );
  };
  const Arrow = ({ label }: { label: string }) => (
    <div className="flex flex-col items-center justify-center px-1 text-center">
      <span className="text-[10px] leading-tight text-[var(--brand)]">{label}</span>
      <span className="mt-1 h-px w-full bg-[var(--brand)]" />
      <span className="text-[var(--brand)]">›</span>
    </div>
  );

  return (
    <section className="flex flex-col gap-4 rounded-[6px] border border-[var(--line)] bg-[var(--card)] p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-label text-[11px] text-[var(--muted)]">Inside Sombra&apos;s AI</p>
          <h2 className="font-display text-3xl leading-none">
            Five <span style={{ color: "var(--brand)" }}>agentic AI</span> models, one safe day
          </h2>
        </div>
        <button onClick={() => setBig(true)} className="rounded-[6px] border border-[var(--brand)] px-3 py-1.5 text-sm text-[var(--brand)]">
          Expand the brain
        </button>
      </div>

      <AgentFloor cards={cards} risks={risks} draft={draft} final={final} alerts={alerts} />

      <ol className="flex flex-col divide-y divide-[var(--line)]">
        {ORDER.map((id) => {
          const c = card(id);
          const st = chip(c);
          return (
            <li key={id} className="py-3">
              <div className="flex items-baseline justify-between gap-2">
                <p>
                  <i className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: `var(--a-${id})` }} />
                  <span className="font-display text-2xl" style={{ color: `var(--a-${id})` }}>{NAME[id]}</span> <span className="text-xs text-[var(--muted)]">{JOB[id]}</span>
                </p>
                <span className={`shrink-0 rounded-[4px] border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${st.cls}`}>{st.text}</span>
              </div>
              {c?.text ? <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed">{c.text.replace(/VERDICT:\s*\w+\.?/gi, "").trim()}</p> : <p className="mt-1.5 text-[13px] text-[var(--muted)]">Waiting for its turn.</p>}
              {c?.summary && <p className="mt-1 text-[13px] font-semibold" style={{ color: `var(--a-${id})` }}>{c.summary}</p>}
              {c?.model && <p className="mt-1 text-[10px] text-[var(--muted)]">model · {c.model}</p>}
            </li>
          );
        })}
      </ol>

      {big &&
        createPortal(
        <div className="cmd drawer fixed inset-0 z-[100] overflow-y-auto bg-[var(--bg)] p-6 lg:p-10" role="dialog" aria-label="Inside Sombra's AI">
          <div className="flex items-end justify-between">
            <div>
              <p className="font-label text-xs text-[var(--muted)]">Inside Sombra&apos;s AI</p>
              <h2 className="font-display text-5xl leading-none">How five agentic AI models build a safe day</h2>
              <p className="mt-2 max-w-2xl text-[var(--muted)]">
                Each model does one job and hands real data to the next. The rules engine is plain code: it has the final say on the law, so an AI mistake can&apos;t ship an unsafe plan.
              </p>
            </div>
            <button onClick={() => setBig(false)} className="rounded-[6px] border border-[var(--line)] px-4 py-2">
              Close
            </button>
          </div>

          <div className="mt-8 grid grid-cols-[1fr_70px_1fr_70px_1fr_70px_1fr_70px_1fr_70px_1fr_70px_1fr] items-stretch gap-0">
            <Node label="Weather" sub="Open-Meteo archive and forecast, 3 fields" kind="data" />
            <Arrow label={links.weather} />
            <Node id="cielo" label="Cielo" sub="sky scout" />
            <Arrow label={links.cielo} />
            <div className="flex flex-col gap-2">
              <Node id="ley" label="Ley" sub="the law" />
              <Node id="critico" label="Crítico" sub="the critic" />
            </div>
            <Arrow label={`${links.ley} · ${links.critico}`} />
            <Node id="cuadrilla" label="Cuadrilla" sub="crew planner" />
            <Arrow label={links.cuadrilla} />
            <Node label="Rules engine" sub="plain code, Cal/OSHA thresholds, final say" kind="code" />
            <Arrow label={links.rules} />
            <div className="flex flex-col gap-2">
              <Node id="critico" label="Crítico" sub="re-checks the new plan" />
              <Node id="voz" label="Voz" sub="the voice" />
            </div>
            <Arrow label={links.voz} />
            <Node label="Worker phones" sub="Spanish, Punjabi, English, read aloud" kind="data" />
          </div>
          <div className="mt-3 flex items-center gap-3 text-sm text-[var(--muted)]">
            <span className="h-px w-10 bg-[var(--bad-ink)]" /> Crítico can send the plan back to Cuadrilla once (revision 1 of 1). Medic joins later, only when a worker reports feeling sick.
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <p className="font-label text-xs text-[var(--muted)]">Selected</p>
              <h3 className="font-display text-6xl" style={{ color: `var(--a-${focus})` }}>{NAME[focus]}</h3>
              <p className="mt-1 text-[var(--muted)]">{JOB[focus]}</p>
              {card(focus)?.model && <p className="mt-2 text-sm">Model: {card(focus)?.model}</p>}
              {card(focus)?.summary && <p className="mt-4 font-display text-2xl leading-snug text-[var(--brand)]">{card(focus)?.summary}</p>}
            </div>
            <div className="rounded-[6px] border border-[var(--line)] bg-[var(--card)] p-5">
              <p className="font-label text-xs text-[var(--muted)]">What it wrote</p>
              <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed">{card(focus)?.text?.replace(/VERDICT:\s*\w+\.?/gi, "").trim() || "Plan a safe day to see it think."}</p>
            </div>
          </div>
        </div>
      , document.body)}
    </section>
  );
}
