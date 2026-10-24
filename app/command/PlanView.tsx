"use client";

import type { Crew, ShiftPlan } from "@/lib/types";
import { toMin } from "@/lib/rules";

const DAY_START = 4 * 60;
const DAY_END = 19 * 60;
const pct = (m: number) => `${((m - DAY_START) / (DAY_END - DAY_START)) * 100}%`;

const KIND_STYLE: Record<string, string> = {
  work: "bg-[var(--ink)]",
  cooldown: "bg-[#5b8fb0]",
  meal: "bg-[#c9bfae]",
  travel: "bg-[#a39a8c]",
};

// A per-crew timeline from 4am to 7pm, with violations listed underneath.
export function PlanView({ plan, crews, label }: { plan: ShiftPlan; crews: Crew[]; label: string }) {
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-xl">{label}</h3>
        <span className={`text-xs font-semibold ${plan.violations.length ? "text-[#b3261e]" : "text-[#3f6b3a]"}`}>
          {plan.violations.length ? `${plan.violations.length} violations` : "Passes every rule"}
        </span>
      </div>
      <p className="mt-1 text-sm text-[var(--muted)]">{plan.summary}</p>
      <div className="mt-3 flex flex-col gap-2">
        {plan.crews.map((p) => {
          const crew = crews.find((c) => c.id === p.crewId);
          return (
            <div key={p.crewId} className="grid grid-cols-[88px_1fr] items-center gap-3">
              <div className="text-xs">
                <div className="font-semibold">{crew?.name}</div>
                <div className="text-[var(--muted)]">
                  {p.waterGallons} gal · {p.shadeUnits} shade
                </div>
              </div>
              <div className="relative h-6 rounded bg-[var(--track)]">
                {p.blocks.map((b, i) => (
                  <div
                    key={i}
                    title={`${b.start}–${b.end} ${b.kind}${b.paid ? " (paid)" : ""}`}
                    className={`absolute top-0 h-full rounded-sm ${KIND_STYLE[b.kind] ?? "bg-gray-400"}`}
                    style={{ left: pct(toMin(b.start)), width: `calc(${pct(toMin(b.end))} - ${pct(toMin(b.start))})` }}
                  />
                ))}
              </div>
            </div>
          );
        })}
        <div className="grid grid-cols-[88px_1fr] gap-3 font-mono text-[10px] text-[var(--muted)]">
          <span />
          <div className="flex justify-between">
            {["4a", "7a", "10a", "1p", "4p", "7p"].map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
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
