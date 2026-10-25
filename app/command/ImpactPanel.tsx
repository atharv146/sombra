"use client";

import { impactOf } from "@/lib/impact";
import type { Crew, Field, HourlyRisk, ShiftPlan } from "@/lib/types";

// The "why it matters" panel: the usual day vs Sombra's day, in numbers anyone can read.
export function ImpactPanel({ before, after, crews, fields, risks }: { before: ShiftPlan; after: ShiftPlan; crews: Crew[]; fields: Field[]; risks: HourlyRisk[] }) {
  const a = impactOf(before, crews, risks);
  const b = impactOf(after, crews, risks);
  const workers = crews.reduce((n, c) => n + c.size, 0);
  const kept = a.workHoursPerWorker ? Math.round((b.workHoursPerWorker / a.workHoursPerWorker) * 100) : 100;
  const rows: { label: string; before: string; after: string; good: boolean }[] = [
    { label: "Worker-hours in extreme heat", before: `${a.extremeWorkerHours}`, after: `${b.extremeWorkerHours}`, good: b.extremeWorkerHours < a.extremeWorkerHours },
    { label: "Cal/OSHA violations", before: `${a.violations}`, after: `${b.violations}`, good: b.violations < a.violations },
    { label: "Hottest temperature worked", before: `${a.peakTempWorkedF}°F`, after: `${b.peakTempWorkedF}°F`, good: b.peakTempWorkedF < a.peakTempWorkedF },
    { label: "Work hours per worker", before: `${a.workHoursPerWorker}`, after: `${b.workHoursPerWorker} (${kept}% kept)`, good: kept >= 80 },
    { label: "Paid cool-down wages", before: `$${a.paidBreakUsd}`, after: `$${b.paidBreakUsd}`, good: b.paidBreakUsd > a.paidBreakUsd },
  ].filter((r) => !(r.before === "$0" && r.after === "$0"));
  const R1 = 52, R2 = 38, C1 = 2 * Math.PI * R1, C2 = 2 * Math.PI * R2;
  const max = Math.max(a.extremeWorkerHours, 1);
  return (
    <section className="rounded-xl border border-[var(--ink)] bg-[var(--card)] p-5">
      <div className="flex flex-wrap items-center gap-6">
      <figure className="flex shrink-0 items-center gap-4" aria-label={`Deadly-heat worker-hours: usual day ${a.extremeWorkerHours}, Sombra ${b.extremeWorkerHours}`}>
        <div className="relative h-36 w-36">
          <svg viewBox="0 0 128 128" className="h-36 w-36 -rotate-90">
            <circle cx="64" cy="64" r={R1} fill="none" stroke="var(--track)" strokeWidth="10" />
            <circle cx="64" cy="64" r={R1} fill="none" stroke="var(--heat-extreme)" strokeWidth="10" strokeDasharray={C1} strokeDashoffset={C1 * (1 - a.extremeWorkerHours / max)} className="ring" />
            <circle cx="64" cy="64" r={R2} fill="none" stroke="var(--track)" strokeWidth="10" />
            <circle cx="64" cy="64" r={R2} fill="none" stroke="var(--good-ink)" strokeWidth="10" strokeDasharray={C2} strokeDashoffset={C2 * (1 - b.extremeWorkerHours / max)} className="ring" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-display text-3xl leading-none text-[var(--good-ink)]">
              {a.extremeWorkerHours ? `−${Math.round((1 - b.extremeWorkerHours / a.extremeWorkerHours) * 100)}%` : "0"}
            </span>
            <span className="mt-1 text-[10px] leading-tight text-[var(--muted)]">deadly-heat
              <br />
              hours
            </span>
          </div>
        </div>
        <figcaption className="flex flex-col gap-2 text-sm">
          <span className="flex items-center gap-2">
            <i className="inline-block h-3 w-3 rounded-full" style={{ background: "var(--heat-extreme)" }} />
            Usual day: <b className="tabular">{a.extremeWorkerHours}</b> worker-hours
          </span>
          <span className="flex items-center gap-2">
            <i className="inline-block h-3 w-3 rounded-full" style={{ background: "var(--good-ink)" }} />
            Sombra: <b className="tabular">{b.extremeWorkerHours}</b> worker-hours
          </span>
        </figcaption>
      </figure>
      <div className="min-w-0 flex-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">What Sombra changed for {workers} workers</p>
      <p className="mt-1 font-display text-3xl leading-tight">
        {a.extremeWorkerHours > 0 ? (
          <>
            {a.extremeWorkerHours} worker-hours of deadly heat → <span className="text-[var(--good-ink)]">{b.extremeWorkerHours}</span>
          </>
        ) : (
          <>No extreme-heat hours today; the plan still meets every rule.</>
        )}
      </p>
      </div>
      </div>
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-[var(--muted)]">
            <th className="pb-1 font-medium" />
            <th className="pb-1 font-medium">Usual day</th>
            <th className="pb-1 font-medium">Sombra</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-[var(--line)]">
              <td className="py-2 pr-2">{r.label}</td>
              <td className="py-2 pr-2 font-mono tabular-nums text-[var(--bad-ink)]">{r.before}</td>
              <td className={`py-2 font-mono font-semibold tabular-nums ${r.good ? "text-[var(--good-ink)]" : ""}`}>{r.after}</td>
            </tr>
          ))}
        </tbody>
      </table>

    </section>
  );
}
