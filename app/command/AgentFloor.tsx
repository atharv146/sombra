"use client";

import { useEffect, useState } from "react";
import { speakAny } from "@/lib/speech";
import type { AgentId, HourlyRisk, Lang, ShiftPlan, TriageLabel } from "@/lib/types";
import type { AgentCard } from "./AgentPanel";
import { BAND_COLOR } from "./bands";

// The Agent Floor: Sombra's AI shown as colleagues on one line, in the order they really run.
// Every drawing is driven by real data (forecast bands, rule results, crew fields, verdicts, check-ins).
const ORDER: AgentId[] = ["cielo", "ley", "critico", "cuadrilla", "voz"];
const ROLE: Record<AgentId, string> = {
  cielo: "reads the sky",
  ley: "checks the law",
  critico: "tries to break it",
  cuadrilla: "plans the crews",
  voz: "speaks to workers",
  medic: "on check-in",
};
const RULES = ["cooldown_2h", "acclimatization_14d", "shade_80", "water_quart_hour", "smoke_151"];

function stateOf(c?: AgentCard) {
  if (!c || c.status === "idle") return "idle";
  if (c.status === "thinking") return "working";
  if (c.text.startsWith("AI busy")) return "fallback";
  return "settled";
}

export function AgentFloor({
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
  const [open, setOpen] = useState<AgentId | null>(null);
  const [lang, setLang] = useState<Lang>("es");
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  const card = (id: AgentId) => cards.find((c) => c.id === id);
  const hours = Array.from({ length: 16 }, (_, i) => i + 4).map((h) =>
    risks.filter((r) => Number(r.time.slice(11, 13)) === h).sort((a, b) => b.wbgtF - a.wbgtF)[0],
  );
  const peak = hours.reduce<HourlyRisk | undefined>((a, b) => (b && (!a || b.tempF > a.tempF) ? b : a), undefined);
  const medicOn = Object.values(alerts).some((l) => l !== "ok");
  const firstCrew = final?.crews[0]?.crewId ?? "";
  const briefing = final?.crewBriefings?.[firstCrew] ?? final?.briefings;

  const status = (id: AgentId) => {
    const c = card(id);
    const s = stateOf(c);
    if (id === "medic") {
      const n = Object.values(alerts).filter((l) => l !== "ok").length;
      return n ? `${n} crew${n > 1 ? "s" : ""} reported symptoms` : final ? "watching check-ins" : "ready";
    }
    if (s === "idle") return "waiting";
    if (s === "working") return id === "cielo" ? "reading the forecast" : id === "ley" ? "checking rules" : id === "critico" ? "looking for risks" : id === "cuadrilla" ? "rebuilding the day" : "writing briefings";
    if (s === "fallback") return "rules fallback";
    if (id === "critico") return c?.verdict === "reject" ? "rejected the usual day" : /REJECT|reject/.test(c?.text ?? "") || (draft?.violations.length ?? 0) > 0 ? "rejected, then approved" : "approved";
    if (id === "ley") return `${draft?.violations.length ?? 0} rules broken`;
    if (id === "cielo" && peak) return `peak ${peak.tempF}°F`;
    return "done";
  };

  const Vignette = ({ id }: { id: AgentId }) => {
    const s = id === "medic" ? (medicOn ? "working" : "settled") : stateOf(card(id));
    const active = s === "working";
    const ink = s === "idle" ? "var(--line)" : `var(--a-${id})`;
    const svg = { viewBox: "0 0 64 44", className: "h-11 w-16", fill: "none", stroke: ink, strokeWidth: 1.5, strokeLinecap: "round" as const };
    if (id === "cielo") {
      const angle = peak ? ((Number(peak.time.slice(11, 13)) - 4) / 15) * 180 : 90;
      return (
        <svg {...svg} aria-hidden>
          <path d="M8 30 A24 24 0 0 1 56 30" strokeDasharray="2 3" />
          <g className={active ? "sun-run" : ""} style={{ transformOrigin: "32px 30px", transform: active ? undefined : `rotate(${angle}deg)` }}>
            <circle cx="8" cy="30" r="3.5" fill={s === "idle" ? "none" : "var(--heat-moderate)"} stroke={ink} />
          </g>
          {hours.map((r, i) => (
            <rect key={i} x={4 + i * 3.6} y={35} width={2.6} height={8} stroke="none" fill={r && s !== "idle" ? BAND_COLOR[r.band] : "var(--track)"} />
          ))}
        </svg>
      );
    }
    if (id === "ley") {
      const broken = new Set<string>(draft?.violations.map((v) => v.rule));
      return (
        <svg {...svg} aria-hidden>
          <rect x="12" y="3" width="40" height="38" rx="2" />
          {RULES.map((r, i) => (
            <g key={r}>
              <path d={`M17 ${10 + i * 7}h18`} strokeWidth={1} />
              {s !== "idle" && (broken.has(r) ? <rect x="40" y={6 + i * 7} width="7" height="6" fill="var(--heat-extreme)" stroke="none" /> : <circle cx="43.5" cy={9 + i * 7} r="2.6" />)}
            </g>
          ))}
        </svg>
      );
    }
    if (id === "critico") {
      const rejected = card("critico")?.verdict === "reject";
      const revised = !rejected && s === "settled" && (draft?.violations.length ?? 0) > 0;
      return (
        <svg {...svg} aria-hidden>
          <path d="M4 22h56" strokeWidth={6} stroke="var(--track)" />
          <path d="M8 22h22M34 22h22" strokeWidth={6} stroke={ink} />
          {s !== "idle" && (
            <ellipse cx="45" cy="22" rx="14" ry="9" stroke={revised ? "var(--good-ink)" : "var(--alert)"} className={active ? "pen" : ""} strokeWidth={1.6} style={{ opacity: rejected || revised || active ? 1 : 0.3 }} />
          )}
          {(rejected || revised) && s !== "working" && (
            <text x="32" y="42" textAnchor="middle" fontSize="8" stroke="none" fill={rejected ? "var(--alert)" : "var(--good-ink)"} style={{ letterSpacing: 1 }}>
              {rejected ? "REJECTED" : "FIXED"}
            </text>
          )}
        </svg>
      );
    }
    if (id === "cuadrilla") {
      const fields = ["french-camp", "ripon", "linden"];
      return (
        <svg {...svg} aria-hidden>
          {fields.map((f, i) => (
            <rect key={f} x={4 + i * 20} y="14" width="16" height="16" rx="1" />
          ))}
          {(final?.crews ?? []).map((p, i) => {
            const fi = Math.max(0, fields.indexOf(p.blocks.find((b) => b.kind === "work")?.fieldId ?? ""));
            return <circle key={p.crewId} className={active ? "crew-dot" : ""} cx={9 + fi * 20 + (i % 2) * 6} cy={19 + Math.floor(i / 2) * 6} r="2.2" fill="var(--brand)" stroke="none" />;
          })}
          <path d="M4 38h56" strokeDasharray="1 3" />
        </svg>
      );
    }
    if (id === "voz") {
      return (
        <svg {...svg} aria-hidden>
          <path d="M6 14h22v12H16l-6 5v-5H6z" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <path key={i} className={active ? "wave" : ""} style={{ animationDelay: `${i * 90}ms`, transformOrigin: `${36 + i * 4}px 22px` }} d={`M${36 + i * 4} ${22 - [4, 8, 5, 9, 3, 6][i]}v${[8, 16, 10, 18, 6, 12][i]}`} />
          ))}
        </svg>
      );
    }
    return (
      <svg {...svg} aria-hidden>
        <path d={medicOn ? "M4 22h18l4-10 6 20 5-14 3 4h20" : "M4 22h20l3-5 4 10 3-5h26"} stroke="var(--a-medic)" className={medicOn ? "pen" : ""} />
      </svg>
    );
  };

  const all: AgentId[] = [...ORDER, "medic"];
  const doneUpTo = ORDER.filter((id) => stateOf(card(id)) === "settled" || stateOf(card(id)) === "fallback").length;
  const sel = open ? card(open) : undefined;

  return (
    <section className="border-y border-[var(--line)] py-3" aria-label="Sombra's AI at work">
      <div className="flex items-baseline justify-between">
        <h2 className="font-label text-xs text-[var(--muted)]">Sombra&apos;s AI at work</h2>
        <span className="text-xs text-[var(--muted)]">Click an agent to see what it&apos;s thinking</span>
      </div>
      <div className="relative mt-2">
        {/* the line the work travels along; it fills as each agent hands off */}
        <div className="absolute bottom-0 left-6 right-[19%] h-px bg-[var(--line)]" />
        <div className="absolute bottom-0 left-6 h-px bg-[var(--brand)] transition-[width] duration-[560ms]" style={{ width: `${Math.min(doneUpTo, 4) * 16}%` }} />
        {doneUpTo > 0 && doneUpTo < 5 && (
          <span
            className="token absolute -bottom-[4px] h-2.5 w-2.5 rounded-full bg-[var(--brand)] transition-[left] duration-[640ms]"
            style={{ left: `calc(24px + ${Math.min(doneUpTo, 4) * 16}%)` }}
            title="Data handed to the next agent"
          />
        )}
        <ol className="relative grid grid-cols-6 gap-1 pb-3">
          {all.map((id) => {
            const c = card(id);
            const s = id === "medic" ? (medicOn ? "working" : "idle") : stateOf(c);
            return (
              <li key={id} className={id === "medic" ? "border-l border-dashed border-[var(--line)] pl-1" : ""}>
                <button
                  onClick={() => setOpen(open === id ? null : id)}
                  aria-expanded={open === id}
                  className={`flex w-full flex-col items-center rounded-[6px] px-1 py-1 text-center transition-colors ${open === id ? "bg-[var(--track)]" : ""} ${s === "working" ? "agent-breathe" : ""}`}
                >
                  <Vignette id={id} />
                  <span className="mt-1 text-[13px] font-semibold" style={{ color: `var(--a-${id})` }}>{id === "critico" ? "Crítico" : id[0].toUpperCase() + id.slice(1)}</span>
                  <span className="text-[10px] leading-tight text-[var(--muted)]">{ROLE[id]}</span>
                  <span className={`mt-0.5 text-[10px] leading-tight ${status(id) === "rules fallback" ? "text-[var(--muted)] italic" : status(id).startsWith("rejected") ? "text-[var(--alert)]" : ""}`} aria-live="polite">
                    {status(id)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {open && (
        <div className="drawer mt-2 max-h-80 overflow-y-auto rounded-[6px] border border-[var(--line)] bg-[var(--card)] p-3 text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-semibold">
              {open === "critico" ? "Crítico" : open[0].toUpperCase() + open.slice(1)} <span className="font-normal text-[var(--muted)]">· {ROLE[open]}</span>
            </p>
            <button onClick={() => setOpen(null)} className="text-xs underline">
              Close
            </button>
          </div>
          {open === "cielo" && peak && (
            <p className="mt-1 text-[var(--muted)]">
              Hottest hour {peak.time.slice(11, 16)}: {peak.tempF}°F, humidity {peak.humidity}%, sun {peak.solarWm2} W/m², wind {peak.windMph} mph{peak.aqi !== undefined ? `, smoke AQI ${peak.aqi}` : ""}.
            </p>
          )}
          {open === "voz" && briefing && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {(["es", "pa", "en"] as Lang[]).map((l) => (
                <button key={l} onClick={() => setLang(l)} className={`rounded-full border px-2 py-0.5 text-xs ${lang === l ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--bg)]" : "border-[var(--line)]"}`}>
                  {l === "es" ? "Español" : l === "pa" ? "ਪੰਜਾਬੀ" : "English"}
                </button>
              ))}
              <button onClick={() => speakAny(briefing[lang] ?? "", lang)} className="rounded-full bg-[var(--brand)] px-3 py-0.5 text-xs text-[var(--brand-ink)]">
                Play
              </button>
              <p className="w-full">{briefing[lang]}</p>
            </div>
          )}
          {open === "medic" ? (
            <p className="mt-1">{medicOn ? "A worker reported symptoms. Medic's second opinion and first-aid steps are in that crew's channel." : "Medic wakes when a worker reports feeling sick. It can raise a health label, never lower it."}</p>
          ) : (
            <>
              <p className="mt-2 whitespace-pre-wrap leading-relaxed">{sel?.text?.replace(/VERDICT:\s*\w+\.?/gi, "").trim() || "Not started yet. Plan a safe day to wake the agents."}</p>
              {sel?.summary && <p className="mt-2 font-semibold">{sel.summary}</p>}
              {sel?.model && <p className="mt-2 text-[11px] text-[var(--muted)]">Model: {sel.model}</p>}
            </>
          )}
        </div>
      )}
    </section>
  );
}
