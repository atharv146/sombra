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
const RULE_ROWS: { label: string; cite: string; rules: string[] }[] = [
  { label: "10-min cool-down every 2 h above 95°F", cite: "§3395(e)", rules: ["cooldown_2h"] },
  { label: "New workers kept out of deadly heat", cite: "§3395(g)", rules: ["acclimatization_14d"] },
  { label: "Shade for the whole crew", cite: "§3395(d)", rules: ["shade_80"] },
  { label: "1 quart of water per worker per hour", cite: "§3395(c)", rules: ["water_quart_hour"] },
  { label: "N95 masks in wildfire smoke", cite: "§5141.1", rules: ["smoke_151", "smoke_500"] },
];
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
        <span className="flex items-center gap-3">
          {tone === "before" && plan.violations.length > 0 && <span className="stamp">Rejected by Crítico</span>}
          <span className={`text-sm font-semibold ${plan.violations.length ? "text-[var(--alert)]" : "text-[var(--ok)]"}`}>
            {plan.violations.length ? `Breaks ${plan.violations.length} heat-law rules` : "Meets every Cal/OSHA heat rule"}
          </span>
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
                {nowMin !== null && <div className="absolute inset-y-0 z-10 w-0.5 bg-[var(--ink)]" style={{ left: `${pct(nowMin)}%` }} />}
                {/* deadly hours that the schedule works through: hatched on top of the work block */}
                {p.blocks
                  .filter((b) => b.kind === "work")
                  .flatMap((b) => hours.filter((r) => r.band === "extreme" && Number(r.time.slice(11, 13)) * 60 >= toMin(b.start) - 59 && Number(r.time.slice(11, 13)) * 60 < toMin(b.end)).map((r) => ({ r, b })))
                  .map(({ r, b }) => {
                    const h0 = Math.max(Number(r.time.slice(11, 13)) * 60, toMin(b.start));
                    const h1 = Math.min(Number(r.time.slice(11, 13)) * 60 + 60, toMin(b.end));
                    return <div key={r.time + b.start} className="hatch absolute top-1.5 z-[5] h-6 rounded-sm" title="Working in deadly heat" style={{ left: `${pct(h0)}%`, width: `${pct(h1) - pct(h0)}%` }} />;
                  })}
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
          <span><i className="mr-1 inline-block h-2.5 w-4 rounded-sm align-middle" style={{ background: BAND_COLOR.extreme, opacity: 0.5 }} />background = heat at that field</span>
          <span><i className="hatch mr-1 inline-block h-2.5 w-4 rounded-sm align-middle" />working in deadly heat</span>
        </div>
      </div>

      {tone === "before" && plan.violations.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--muted)]">
                <th className="pb-1 font-medium">California heat law</th>
                {plan.crews.map((p) => (
                  <th key={p.crewId} className="pb-1 font-medium">{crews.find((c) => c.id === p.crewId)?.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RULE_ROWS.filter((row) => row.rules.some((r) => plan.violations.some((v) => v.rule === r))).map((row) => (
                <tr key={row.label} className="border-t border-[var(--line)]">
                  <td className="py-1.5 pr-3">
                    {row.label} <span className="text-xs text-[var(--muted)]">{row.cite}</span>
                  </td>
                  {plan.crews.map((p) => {
                    const v = plan.violations.find((x) => x.crewId === p.crewId && row.rules.includes(x.rule));
                    return (
                      <td key={p.crewId} className={`py-1.5 pr-3 ${v ? "font-semibold text-[#8c1d17]" : "text-[#2f5a2b]"}`} title={v?.message}>
                        {v ? `✗ ${v.short ?? "broken"}` : "✓"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
