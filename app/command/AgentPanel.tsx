"use client";

import type { AgentId } from "@/lib/types";

export interface AgentCard {
  id: AgentId;
  name: string;
  role: string;
  color: string;
  model?: string;
  status: "idle" | "thinking" | "done";
  text: string;
  summary?: string;
  verdict?: "approve" | "reject";
}

export function AgentPanel({ cards }: { cards: AgentCard[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {cards.map((c, i) => (
        <li
          key={c.id}
          className="agent-card rounded-xl border border-[var(--line)] bg-[var(--card)] p-4"
          data-status={c.status}
          style={{ "--agent": c.color, animationDelay: `${i * 60}ms` } as React.CSSProperties}
        >
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <span className="agent-pip" aria-hidden />
              <span className="font-display text-xl leading-none">{c.name}</span>
              <span className="text-xs text-[var(--muted)]">{c.role}</span>
            </div>
            <span className="shrink-0 font-mono text-[11px] text-[var(--muted)]">
              {c.status === "thinking" ? "thinking…" : c.status === "done" ? "done" : "waiting"}
            </span>
          </div>
          {c.verdict && (
            <p className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${c.verdict === "reject" ? "bg-[#b3261e] text-white" : "bg-[#3f6b3a] text-white"}`}>
              {c.verdict === "reject" ? "REJECTED" : "APPROVED"}
            </p>
          )}
          {c.text && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{c.text}</p>}
          {c.summary && <p className="mt-2 text-sm font-medium">{c.summary}</p>}
          {c.model && <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">model · {c.model}</p>}
        </li>
      ))}
    </ol>
  );
}
