"use client";

import { useState } from "react";
import type { Crew, RadioMessage } from "@/lib/types";

// Crew boss → workers. Typed in English, delivered in Spanish and Punjabi, read aloud on their phones.
export function RadioBox({ planId, crews }: { planId: string; crews: Crew[] }) {
  const [text, setText] = useState("");
  const [crewId, setCrewId] = useState("");
  const [sent, setSent] = useState<RadioMessage[]>([]);
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/radio/${planId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, lang: "en", crewId: crewId || undefined }),
      });
      if (res.ok) {
        const m = (await res.json()) as RadioMessage;
        setSent((s) => [m, ...s]);
        setText("");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
      <h3 className="font-semibold">Crew radio</h3>
      <p className="text-xs text-[var(--muted)]">Type in English. Workers hear it in Spanish or Punjabi.</p>
      <form onSubmit={send} className="mt-3 flex flex-col gap-2">
        <div className="flex gap-2">
          <select value={crewId} onChange={(e) => setCrewId(e.target.value)} className="rounded border border-[var(--line)] bg-transparent px-2 py-2 text-sm">
            <option value="">All crews</option>
            {crews.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Water truck is at the north gate"
            className="min-w-0 flex-1 rounded border border-[var(--line)] bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <button disabled={busy} className="self-end rounded-full bg-[var(--ink)] px-4 py-2 text-sm text-[var(--bg)] disabled:opacity-60">
          {busy ? "Translating…" : "Send"}
        </button>
      </form>
      {sent.length > 0 && (
        <ol className="mt-3 flex flex-col gap-2 text-sm">
          {sent.map((m) => (
            <li key={m.id} className="border-t border-[var(--line)] pt-2">
              <p className="font-medium">{m.text.en}</p>
              <p className="text-[var(--muted)]">es · {m.text.es}</p>
              <p className="text-[var(--muted)]">pa · {m.text.pa}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
