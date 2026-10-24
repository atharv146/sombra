"use client";

import { useEffect, useRef, useState } from "react";
import type { CheckIn, Crew, TriageLabel } from "@/lib/types";

interface Medic {
  label: TriageLabel;
  reason: string;
  agrees: boolean;
  model: string;
  steps: string[];
}

const LABEL: Record<TriageLabel, { text: string; color: string }> = {
  emergency: { text: "Emergency", color: "#b3261e" },
  heat_exhaustion: { text: "Heat exhaustion", color: "#e0702f" },
  warning: { text: "Early warning", color: "#d9a640" },
  ok: { text: "OK", color: "#3f6b3a" },
};

// Polls worker check-ins for the sent plan; each new one gets a Medic second opinion.
export function AlertFeed({ planId, crews, onAlert }: { planId: string; crews: Crew[]; onAlert: (crewId: string, label: TriageLabel) => void }) {
  const [items, setItems] = useState<CheckIn[]>([]);
  const [medic, setMedic] = useState<Record<string, Medic>>({});
  const seen = useRef(new Set<string>());

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch(`/api/alerts/${planId}`, { cache: "no-store" });
        const list = (await res.json()) as CheckIn[];
        if (!alive) return;
        setItems(list);
        for (const c of list) {
          if (seen.current.has(c.id)) continue;
          seen.current.add(c.id);
          onAlert(c.crewId, c.triage.label);
          fetch("/api/medic", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ transcript: c.transcript, label: c.triage.label }),
          })
            .then((r) => r.json())
            .then((m: Medic) => {
              setMedic((x) => ({ ...x, [c.id]: m }));
              onAlert(c.crewId, m.label);
            });
        }
      } catch {}
    };
    tick();
    const t = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [planId, onAlert]);

  if (!items.length)
    return <p className="rounded-xl border border-dashed border-[var(--line)] p-4 text-sm text-[var(--muted)]">Waiting for worker check-ins…</p>;

  return (
    <ol className="flex flex-col gap-3">
      {[...items].reverse().map((c) => {
        const m = medic[c.id];
        const label = m?.label ?? c.triage.label;
        const crew = crews.find((x) => x.id === c.crewId);
        const score = c.triage.scores?.[c.triage.label];
        return (
          <li key={c.id} className="alert-card rounded-xl border-2 bg-[var(--card)] p-4" style={{ borderColor: LABEL[label].color }}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: LABEL[label].color }}>
                {LABEL[label].text}
              </span>
              <span className="text-xs text-[var(--muted)]">
                {crew?.name ?? c.crewId} · worker {c.workerId} · {new Date(c.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </span>
            </div>
            <p className="mt-2 font-display text-lg leading-snug">“{c.transcript}”</p>
            <p className="mt-2 font-mono text-[11px] text-[var(--muted)]">
              {c.triage.model} → {c.triage.label}
              {score !== undefined ? ` ${score.toFixed(2)}` : ""}
              {c.triage.forcedByKeyword ? ` · safety keyword “${c.triage.forcedByKeyword}”` : ""}
            </p>
            {m ? (
              <>
                <p className="mt-1 font-mono text-[11px] text-[var(--muted)]">
                  Medic ({m.model}) {m.agrees ? "agrees" : `says ${m.label}`}: {m.reason}
                </p>
                <ol className="mt-2 list-decimal pl-5 text-sm">
                  {m.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </>
            ) : (
              <p className="mt-1 text-xs text-[var(--muted)]">Medic is reviewing…</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
