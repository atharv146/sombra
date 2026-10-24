"use client";

import { changes, impactOf } from "@/lib/impact";
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
  ];
  return (
    <section className="rounded-xl border-2 border-[var(--ink)] bg-[var(--card)] p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">What Sombra changed for {workers} workers</p>
      <p className="mt-1 font-display text-3xl leading-tight">
        {a.extremeWorkerHours > 0 ? (
          <>
            {a.extremeWorkerHours} worker-hours of deadly heat → <span className="text-[#3f6b3a]">{b.extremeWorkerHours}</span>
          </>
        ) : (
          <>No extreme-heat hours today; the plan still meets every rule.</>
        )}
      </p>
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
              <td className="py-2 pr-2 font-mono tabular-nums text-[#8c1d17]">{r.before}</td>
              <td className={`py-2 font-mono font-semibold tabular-nums ${r.good ? "text-[#3f6b3a]" : ""}`}>{r.after}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="mt-4 flex flex-col gap-1 text-sm">
        {changes(before, after, crews, fields).map((line) => (
          <li key={line}>· {line}</li>
        ))}
      </ul>
    </section>
  );
}
