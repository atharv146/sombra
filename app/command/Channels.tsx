"use client";

import { useEffect, useRef, useState } from "react";
import { alarm } from "@/lib/alarm";
import type { Crew, Field, RadioMessage, TriageLabel } from "@/lib/types";

interface Medic {
  label: TriageLabel;
  reason: string;
  note?: string;
  agrees: boolean;
  model: string;
  steps: string[];
}

const LABEL: Record<TriageLabel, { text: string; color: string }> = {
  emergency: { text: "Emergency", color: "#b3261e" },
  heat_exhaustion: { text: "Heat exhaustion", color: "#c85f22" },
  warning: { text: "Early warning", color: "#b7862a" },
  ok: { text: "OK", color: "#3f6b3a" },
};
const INTENT = { health: "Health", request: "Request", question: "Question", other: "Off-topic" } as const;
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

// One channel per crew: worker messages (any language, triaged by our model) and the boss's replies and heat alerts.
export function Channels({
  planId,
  crews,
  fieldOf,
  fields,
  onAlert,
}: {
  planId: string;
  crews: Crew[];
  fieldOf: Record<string, string>; // crewId -> fieldId in Sombra's plan
  fields: Field[];
  onAlert: (crewId: string, label: TriageLabel, text: string) => void;
}) {
  const [msgs, setMsgs] = useState<RadioMessage[]>([]);
  const [sel, setSel] = useState(crews[0]?.id ?? "");
  const [medic, setMedic] = useState<Record<string, Medic>>({});
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"" | RadioMessage["kind"]>("");
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000); // refresh "no reply yet" ages
    return () => clearInterval(id);
  }, []);
  const [pending, setPending] = useState<RadioMessage | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const seen = useRef(new Set<string>());
  const first = useRef(true);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const list = (await fetch(`/api/radio/${planId}`, { cache: "no-store" }).then((r) => r.json())) as RadioMessage[];
        if (!alive) return;
        setMsgs(list);
        for (const m of list) {
          if (seen.current.has(m.id)) continue;
          seen.current.add(m.id);
          if (m.from !== "worker" || m.intent !== "health" || !m.triage || m.triage.label === "ok") continue;
          if (!first.current) {
            onAlert(m.crewId ?? "", m.triage.label, m.text.en);
            if (m.triage.label === "emergency" || m.triage.label === "heat_exhaustion") alarm(3);
            setSel(m.crewId ?? sel);
          }
          fetch("/api/medic", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ transcript: m.text.en, label: m.triage.label }),
          })
            .then((r) => r.json())
            .then((x: Medic) => setMedic((s) => ({ ...s, [m.id]: x })));
        }
        first.current = false;
      } catch {}
    };
    tick();
    const t = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [planId, onAlert, sel]);

  // The sent message shows at once (as "sending") and stays in the thread with its timestamp.
  async function send(kind: RadioMessage["kind"], crewId?: string) {
    if (kind === "chat" && !text.trim()) return;
    const draft = kind === "chat" ? text : "";
    const temp: RadioMessage = {
      id: `pending-${Date.now()}`,
      planId,
      from: "boss",
      crewId,
      lang: "en",
      kind,
      text: { en: draft || (kind === "checkin" ? "How do you feel? (sent to every phone in this crew)" : "Heat alert"), es: "", pa: "" },
      at: new Date().toISOString(),
    };
    setPending(temp);
    setText("");
    setBusy(kind);
    try {
      const res = await fetch(`/api/radio/${planId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: draft || undefined, lang: "en", crewId, kind }),
      });
      if (res.ok) {
        const m = (await res.json()) as RadioMessage;
        seen.current.add(m.id);
        setMsgs((x) => (x.some((y) => y.id === m.id) ? x : [...x, m]));
      } else if (draft) setText(draft);
    } finally {
      setPending(null);
      setBusy("");
    }
  }

  // Keep the newest message in view.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length, pending, sel]);

  const unread = (crewId: string) => msgs.filter((m) => m.from === "worker" && m.crewId === crewId && m.intent === "health" && m.triage?.label !== "ok").length;
  const thread = [...msgs.filter((m) => m.crewId === sel || (m.from === "boss" && !m.crewId)), ...(pending && (!pending.crewId || pending.crewId === sel) ? [pending] : [])];
  const crew = crews.find((c) => c.id === sel);
  const fieldName = fields.find((f) => f.id === fieldOf[sel])?.name;

  return (
    <section className="flex flex-col rounded-xl border border-[var(--line)] bg-[var(--card)]">
      <div className="flex items-center justify-between border-b border-[var(--line)] p-3">
        <div className="flex gap-1">
          {crews.map((c) => (
            <button
              key={c.id}
              onClick={() => setSel(c.id)}
              className={`relative rounded-full px-3 py-1.5 text-sm ${sel === c.id ? "bg-[var(--ink)] text-[var(--bg)]" : "border border-[var(--line)]"}`}
            >
              {c.name}
              {unread(c.id) > 0 && (
                <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#b3261e] px-1 text-[10px] text-white">{unread(c.id)}</span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={() => send("alert")}
          disabled={!!busy}
          className="rounded-full bg-[#b3261e] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-60"
          title="Every worker's phone in every crew sounds an alarm and shows a full-screen stop-work alert in their language"
        >
          {busy === "alert" ? "Sending…" : "Heat alert · all crews"}
        </button>
      </div>

      <p className="px-3 pt-2 text-xs text-[var(--muted)]">
        {crew?.name} · {crew?.size} workers{fieldName ? ` · ${fieldName}` : ""}. Workers write or speak in any language; you read English. Your replies reach them in Spanish or Punjabi, read aloud.
      </p>

      <ol ref={listRef} className="flex max-h-[420px] flex-col gap-2 overflow-y-auto p-3">
        {thread.length === 0 && <li className="text-sm text-[var(--muted)]">No messages yet. Scan the QR code with a phone and say how you feel.</li>}
        {thread.map((m) => {
          if (m.from === "boss")
            return (
              <li key={m.id} className={`self-end max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.kind === "alert" ? "bg-[#b3261e] text-white" : m.kind === "checkin" ? "bg-[#2f6f8f] text-white" : "bg-[var(--ink)] text-[var(--bg)]"}`}>
                <p>{m.text.en}</p>
                <p className="mt-1 text-[11px] opacity-70">
                  You · {time(m.at)} · {m.crewId ? "this crew" : "all crews"} · {m.id.startsWith("pending") ? "translating and sending…" : "delivered in Spanish and Punjabi"}
                </p>
              </li>
            );
          const label = medic[m.id]?.label ?? m.triage?.label ?? "ok";
          const health = m.intent === "health";
          const score = m.triage ? m.triage.scores?.[m.triage.label] : undefined;
          return (
            <li key={m.id} className="max-w-[90%] rounded-xl border-2 bg-[var(--bg)] px-3 py-2 text-sm" style={{ borderColor: health ? LABEL[label].color : "var(--line)" }}>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="rounded-full px-2 py-0.5 font-bold text-white" style={{ background: health ? LABEL[label].color : "#6f665b" }}>
                  {health ? LABEL[label].text : INTENT[m.intent ?? "other"]}
                </span>
                <span className="text-[var(--muted)]">
                  worker {m.workerId} · {time(m.at)}
                </span>
                {m.intent !== "other" && !thread.some((x) => x.from === "boss" && x.at > m.at) && Date.now() - +new Date(m.at) > 120_000 && (
                  <span className="rounded-full bg-[#f3e2b8] px-2 py-0.5 font-semibold text-[#6b4e10]">
                    No reply yet · {Math.round((Date.now() - +new Date(m.at)) / 60_000)} min
                  </span>
                )}
              </div>
              <p className="mt-1 font-medium">{m.text.en}</p>
              {m.original && m.original !== m.text.en && <p className="text-[var(--muted)]">“{m.original}”</p>}
              {m.autoReply && <p className="mt-1 text-xs text-[var(--muted)]">Sombra replied: {m.autoReply.en}</p>}
              {m.triage && (
                <p className="mt-1 font-mono text-[10px] text-[var(--muted)]">
                  {m.triage.model} → {m.triage.label}
                  {score !== undefined ? ` ${score.toFixed(2)}` : ""}
                  {m.triage.forcedByKeyword ? ` · safety keyword “${m.triage.forcedByKeyword}”` : ""}
                  {!health ? " · not health-related" : ""}
                </p>
              )}
              {health && medic[m.id] && label !== "ok" && (
                <>
                  <p className="font-mono text-[10px] text-[var(--muted)]">
                    Medic ({medic[m.id].model}) {medic[m.id].agrees ? "agrees" : `says ${medic[m.id].label}`}: {medic[m.id].reason}
                  </p>
                  {medic[m.id].note && <p className="mt-1 font-semibold">{medic[m.id].note}</p>}
                  <ol className="mt-1 list-decimal pl-5">
                    {medic[m.id].steps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                </>
              )}
            </li>
          );
        })}
      </ol>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send("chat", sel);
        }}
        className="flex gap-2 border-t border-[var(--line)] p-3"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Message ${crew?.name ?? "crew"} in English…`}
          className="min-w-0 flex-1 rounded border border-[var(--line)] bg-transparent px-3 py-2 text-sm"
        />
        <button disabled={!!busy} className="rounded-full bg-[var(--ink)] px-4 text-sm text-[var(--bg)] disabled:opacity-60">
          {busy === "chat" ? "Translating…" : "Send"}
        </button>
        <button type="button" onClick={() => send("checkin", sel)} disabled={!!busy} className="rounded-full border border-[#2f6f8f] px-3 text-xs font-semibold text-[#2f6f8f]" title="Every phone in this crew asks the worker how they feel">
          Ask how they feel
        </button>
        <button type="button" onClick={() => send("alert", sel)} disabled={!!busy} className="rounded-full border border-[#b3261e] px-3 text-xs font-semibold text-[#b3261e]">
          Alert crew
        </button>
      </form>
    </section>
  );
}
