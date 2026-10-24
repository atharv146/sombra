"use client";

import type { Crew, Field, HourlyRisk, ShiftPlan } from "@/lib/types";
import { toMin } from "@/lib/rules";
import { BAND_COLOR } from "./bands";

const DAY_START = 4 * 60;
const DAY_END = 19 * 60;
const pct = (m: number) => ((m - DAY_START) / (DAY_END - DAY_START)) * 100;
const ampm = (m: number) => {
  const h = Math.floor(m / 60);
  const mm = m % 60 ? `:${String(m % 60).padStart(2, "0")}` : "";
  return `${((h + 11) % 12) + 1}${mm}${h < 12 ? "am" : "pm"}`;
};
const TICKS = [4, 6, 8, 10, 12, 14, 16, 18].map((h) => h * 60);

// Each crew's day drawn over its field's hourly heat: you can see work blocks running into red, or ending before it.
export function PlanView({
  plan,
  crews,
  label,
  risks,
  fields,
  tone,
  nowMin = null,
  compare,
}: {
  plan: ShiftPlan;
  crews: Crew[];
  label: string;
  risks: HourlyRisk[];
  fields: Field[];
  tone: "before" | "after";
  nowMin?: number | null; // "Play the day" clock: draws a moving line
  compare?: ShiftPlan; // the usual day, for the before -> after table
}) {
  const hoursIn = (p: ShiftPlan["crews"][number], fieldId?: string) =>
    p.blocks.filter((b) => b.kind === "work").reduce((n, b) => {
      for (let m = toMin(b.start); m < toMin(b.end); m += 60)
        if (risks.find((r) => r.fieldId === (b.fieldId ?? fieldId) && Number(r.time.slice(11, 13)) === Math.floor(m / 60))?.band === "extreme") n++;
      return n;
    }, 0);
  return (
    <section className={`rounded-xl border bg-[var(--card)] p-4 ${tone === "after" ? "border-[#3f6b3a]" : "border-[var(--line)]"}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-2xl">{label}</h3>
        <span className={`text-sm font-semibold ${plan.violations.length ? "text-[#b3261e]" : "text-[#3f6b3a]"}`}>
          {plan.violations.length ? `Breaks ${plan.violations.length} heat-law rules` : "Meets every Cal/OSHA heat rule"}
        </span>
      </div>
      {tone === "after" && <p className="mt-1 text-sm">{plan.summary}</p>}
      {compare && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--muted)]">
                <th className="pb-1 font-medium">What changes</th>
                {plan.crews.map((p) => (
                  <th key={p.crewId} className="pb-1 font-medium">{crews.find((c) => c.id === p.crewId)?.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {([
                ["Starts", (p) => ampm(toMin(p.blocks[0].start))],
                ["Done by", (p) => ampm(toMin(p.blocks.filter((b) => b.kind === "work").at(-1)?.end ?? p.blocks.at(-1)!.end))],
                ["Hours in deadly heat", (p) => `${hoursIn(p, crews.find((c) => c.id === p.crewId)?.fieldId)} h`],
                ["Paid cool-downs", (p) => `${p.blocks.filter((b) => b.kind === "cooldown").length}`],
                ["Drinking water", (p) => `${p.waterGallons} gal`],
                ["Shade tents", (p) => `${p.shadeUnits}`],
                ["N95 masks", (p) => (p.respirators ? "yes" : "no")],
              ] as [string, (p: ShiftPlan["crews"][number]) => string][]).map(([label, get]) => (
                <tr key={label} className="border-t border-[var(--line)]">
                  <td className="py-1.5 pr-3">{label}</td>
                  {plan.crews.map((p) => {
                    const old = compare.crews.find((x) => x.crewId === p.crewId);
                    const a = old ? get(old) : "–";
                    const b = get(p);
                    return (
                      <td key={p.crewId} className="py-1.5 pr-3 tabular-nums">
                        {a === b ? (
                          <span>{b}</span>
                        ) : (
                          <>
                            <span className="text-[#8c1d17] line-through decoration-1">{a}</span> → <b className="text-[#2f5a2b]">{b}</b>
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-3">
        {plan.crews.map((p) => {
          const crew = crews.find((c) => c.id === p.crewId);
          const fieldId = p.blocks.find((b) => b.kind === "work")?.fieldId ?? crew?.fieldId;
          const field = fields.find((f) => f.id === fieldId);
          const hours = risks.filter((r) => r.fieldId === fieldId);
          return (
            <div key={p.crewId}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
                <span>
                  <b className="text-sm">{crew?.name}</b> · {crew?.size} workers{crew?.newWorkers ? `, ${crew.newWorkers} new` : ""} · {field?.name}
                </span>
                <span className="text-[var(--muted)]">
                  {p.waterGallons} gal water · {p.shadeUnits} shade tent{p.shadeUnits === 1 ? "" : "s"} (needs 1 per 10 workers)
                </span>
              </div>
              <div className="relative mt-1 h-9 overflow-hidden rounded-md">
                {/* heat underneath: one cell per hour, colored by danger */}
                <div className="absolute inset-0 flex">
                  {hours.map((r) => (
                    <div key={r.time} className="h-full flex-1" style={{ background: BAND_COLOR[r.band], opacity: 0.35 }} title={`${r.time.slice(11, 16)} ${r.tempF}°F`} />
                  ))}
                </div>
                {nowMin !== null && <div className="absolute inset-y-0 z-10 w-0.5 bg-[#b3261e]" style={{ left: `${pct(nowMin)}%` }} />}
                {/* the schedule on top */}
                {p.blocks.map((b, i) => {
                  const left = pct(toMin(b.start));
                  const width = pct(toMin(b.end)) - left;
                  const style =
                    b.kind === "work"
                      ? "bg-[var(--ink)] text-[var(--bg)]"
                      : b.kind === "cooldown"
                        ? "bg-[#2f6f8f] text-white"
                        : "bg-[#efe6d6] text-[var(--ink)] border border-[var(--line)]";
                  return (
                    <div
                      key={i}
                      title={`${ampm(toMin(b.start))}–${ampm(toMin(b.end))} ${b.kind}${b.paid ? " (paid)" : ""}`}
                      className={`absolute top-1.5 grid h-6 place-items-center overflow-hidden rounded text-[10px] font-semibold ${style}`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                    >
                      {width > 7 ? (b.kind === "work" ? `${ampm(toMin(b.start))}–${ampm(toMin(b.end))}` : b.kind === "meal" ? "lunch" : "") : ""}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div className="relative h-4 font-mono text-[10px] text-[var(--muted)]">
          {TICKS.map((m) => (
            <span key={m} className="absolute -translate-x-1/2" style={{ left: `${pct(m)}%` }}>
              {ampm(m)}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--muted)]">
          <span><i className="mr-1 inline-block h-2.5 w-4 rounded-sm bg-[var(--ink)] align-middle" />work</span>
          <span><i className="mr-1 inline-block h-2.5 w-4 rounded-sm bg-[#2f6f8f] align-middle" />paid 10-min cool-down in shade</span>
          <span><i className="mr-1 inline-block h-2.5 w-4 rounded-sm border border-[var(--line)] bg-[#efe6d6] align-middle" />lunch</span>
          <span><i className="mr-1 inline-block h-2.5 w-4 rounded-sm align-middle" style={{ background: BAND_COLOR.extreme, opacity: 0.5 }} />background = heat at that field (red = deadly)</span>
        </div>
      </div>

      {plan.violations.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 text-sm text-[#8c1d17]">
          {plan.violations.map((v, i) => (
            <li key={i}>· {v.message}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
