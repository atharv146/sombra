"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { QRCodeSVG } from "qrcode.react";
import type { AgentEvent, AgentId, Crew, Field, HourlyRisk, ShiftPlan, TriageLabel } from "@/lib/types";
import { AlertFeed } from "./AlertFeed";
import { AgentPanel, type AgentCard } from "./AgentPanel";
import { PlanView } from "./PlanView";
import { BAND_COLOR } from "./bands";

const FieldMap = dynamic(() => import("./FieldMap").then((m) => m.FieldMap), { ssr: false });

const AGENT_META: Record<AgentId, Omit<AgentCard, "status" | "text">> = {
  cielo: { id: "cielo", name: "Cielo", role: "sky scout", color: "#d97706" },
  ley: { id: "ley", name: "Ley", role: "Cal/OSHA rules", color: "#2563eb" },
  critico: { id: "critico", name: "Crítico", role: "tries to break the plan", color: "#dc2626" },
  cuadrilla: { id: "cuadrilla", name: "Cuadrilla", role: "crew planner", color: "#16a34a" },
  voz: { id: "voz", name: "Voz", role: "es · ਪੰਜਾਬੀ · en briefings", color: "#7c3aed" },
  medic: { id: "medic", name: "Medic", role: "check-in second opinion", color: "#be185d" },
};
const ORDER: AgentId[] = ["cielo", "ley", "critico", "cuadrilla", "voz"];

const DEFAULT_CREWS: Crew[] = [
  { id: "c1", name: "Crew 1", size: 38, newWorkers: 0, fieldId: "french-camp", lang: ["es"], pieceRateUsdPerHour: 22 },
  { id: "c2", name: "Crew 2", size: 24, newWorkers: 6, fieldId: "linden", lang: ["es", "pa"], pieceRateUsdPerHour: 20 },
  { id: "c3", name: "Crew 3", size: 30, newWorkers: 2, fieldId: "ripon", lang: ["pa", "en"], pieceRateUsdPerHour: 21 },
];

const fresh = () => ORDER.map((id) => ({ ...AGENT_META[id], status: "idle" as const, text: "" }));

export function Command({ fields, replayDate }: { fields: Field[]; replayDate: string }) {
  const [mode, setMode] = useState<"replay" | "live">("replay");
  const [crews, setCrews] = useState(DEFAULT_CREWS);
  const [start, setStart] = useState("06:00");
  const [end, setEnd] = useState("14:30");
  const [note, setNote] = useState("");
  const [cards, setCards] = useState<AgentCard[]>(fresh);
  const [risks, setRisks] = useState<HourlyRisk[]>([]);
  const [draft, setDraft] = useState<ShiftPlan | null>(null);
  const [final, setFinal] = useState<ShiftPlan | null>(null);
  const [hour, setHour] = useState(14);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<Record<string, TriageLabel>>({});
  const [lastRun, setLastRun] = useState<{ at: number; e: AgentEvent }[] | null>(null);
  const [replaying, setReplaying] = useState(false);
  const onAlert = useCallback(
    (crewId: string, label: TriageLabel) => setAlerts((a) => ({ ...a, [crewId]: label })),
    [],
  );

  const patch = (id: AgentId, f: (c: AgentCard) => AgentCard) =>
    setCards((cs) => (cs.some((c) => c.id === id) ? cs.map((c) => (c.id === id ? f(c) : c)) : [...cs, f({ ...AGENT_META[id], status: "idle", text: "" })]));

  function handle(e: AgentEvent) {
    switch (e.type) {
      case "agent_start":
        return patch(e.agent, (c) => ({ ...c, status: "thinking", model: e.model, text: c.text ? c.text + "\n\n" : "", summary: undefined, verdict: undefined }));
      case "agent_delta":
        return patch(e.agent, (c) => ({ ...c, text: c.text + e.text }));
      case "agent_done":
        return patch(e.agent, (c) => ({ ...c, status: "done", summary: e.summary, verdict: e.verdict }));
      case "risk":
        return setRisks(e.risks);
      case "plan":
        return e.revision === 0 ? setDraft(e.plan) : setFinal(e.plan);
      case "error":
        return setError(e.message);
    }
  }

  // ?demo=1: replay a recorded real run at its original pace, for when wifi or the model API fails.
  async function replay() {
    setReplaying(true);
    const events = (await fetch("/demo/run.json").then((r) => r.json())) as { at: number; e: AgentEvent }[];
    const finalPlan = [...events].reverse().find((x) => x.e.type === "plan")?.e;
    if (finalPlan?.type === "plan") {
      fetch("/api/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "restore", plan: finalPlan.plan }) }).catch(() => {});
    }
    let prev = 0;
    for (const { at, e } of events) {
      await new Promise((r) => setTimeout(r, Math.min(at - prev, 1200)));
      prev = at;
      handle(e);
    }
  }

  async function saveDemo() {
    const res = await fetch("/api/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "record", events: lastRun }) });
    setError(res.ok ? null : "Couldn't save the demo run");
    setLastRun(null);
  }

  async function run() {
    setRunning(true);
    setError(null);
    setCards(fresh());
    setDraft(null);
    setFinal(null);
    setAlerts({});
    setReplaying(false);
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
    const t0 = performance.now();
    const log: { at: number; e: AgentEvent }[] = [];
    const take = (e: AgentEvent) => {
      log.push({ at: Math.round(performance.now() - t0), e });
      handle(e);
    };
    try {
      if (new URLSearchParams(window.location.search).has("demo")) return await replay();
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, date: mode === "replay" ? replayDate : today, start, end, crews, note }),
      });
      if (!res.body) throw new Error(`Server error ${res.status}`);
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const p of parts) if (p.startsWith("data: ")) take(JSON.parse(p.slice(6)));
      }
      setLastRun(log);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  const strip = useMemo(
    () => fields.map((f) => ({ f, hours: risks.filter((r) => r.fieldId === f.id) })),
    [fields, risks],
  );
  // Which crews work each field: Sombra's plan once it exists, otherwise the crew editor.
  const crewLabels = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const c of crews) {
      const p = final?.crews.find((x) => x.crewId === c.id);
      const fieldId = p?.blocks.find((b) => b.kind === "work")?.fieldId ?? c.fieldId;
      (out[fieldId] ??= []).push(c.name);
    }
    return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.join(" + ")]));
  }, [crews, final]);
  const crewUrl = final && typeof window !== "undefined" ? `${window.location.origin}/crew/${final.id}` : "";

  return (
    <div className="grid min-h-dvh grid-cols-1 gap-5 p-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,1fr)] lg:p-6">
      <div className="flex flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-5xl leading-none">Sombra</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">Heat and smoke safety command center for Central Valley farm crews</p>
          </div>
          <div className="flex rounded-full border border-[var(--line)] p-1 text-sm">
            {(["replay", "live"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-full px-3 py-1 ${mode === m ? "bg-[var(--ink)] text-[var(--bg)]" : ""}`}
              >
                {m === "replay" ? `Heat wave · ${replayDate}` : `Live · today`}
              </button>
            ))}
          </div>
        </header>

        <div className="relative h-[420px] overflow-hidden rounded-xl border border-[var(--line)] lg:h-[500px]">
          <FieldMap fields={fields} risks={risks} hour={hour} crewLabels={crewLabels} alerts={Object.fromEntries(Object.entries(alerts).flatMap(([crewId, label]) => { const c = crews.find((x) => x.id === crewId); return c && label !== "ok" ? [[c.fieldId, label]] : []; }))} />
        </div>

        {risks.length > 0 && (
          <section className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">Heat by hour (WBGT estimate)</span>
              <span className="font-mono">{String(hour).padStart(2, "0")}:00</span>
            </div>
            <div className="mt-2 flex flex-col gap-1">
              {strip.map(({ f, hours }) => (
                <div key={f.id} className="grid grid-cols-[150px_1fr] items-center gap-2 text-xs">
                  <span className="truncate">{f.name}</span>
                  <div className="flex h-4 gap-px">
                    {hours.map((r) => (
                      <div
                        key={r.time}
                        title={`${r.time.slice(11, 16)} ${r.tempF}°F · WBGT ${r.wbgtF}°F`}
                        className="flex-1 rounded-[2px]"
                        style={{ background: BAND_COLOR[r.band], outline: Number(r.time.slice(11, 13)) === hour ? "2px solid var(--ink)" : "none" }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <input type="range" min={4} max={19} value={hour} onChange={(e) => setHour(Number(e.target.value))} className="mt-3 w-full" aria-label="Hour of day" />
          </section>
        )}

        <section className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
          <h2 className="font-semibold">Tomorrow&apos;s crews</h2>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            {crews.map((c, i) => (
              <div key={c.id} className="grid grid-cols-[70px_1fr_80px_90px] items-center gap-2">
                <span className="font-semibold">{c.name}</span>
                <select
                  value={c.fieldId}
                  onChange={(e) => setCrews(crews.map((x, j) => (j === i ? { ...x, fieldId: e.target.value } : x)))}
                  className="rounded border border-[var(--line)] bg-transparent px-2 py-1"
                >
                  {fields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1">
                  <input type="number" value={c.size} min={1} onChange={(e) => setCrews(crews.map((x, j) => (j === i ? { ...x, size: Number(e.target.value) } : x)))} className="w-12 rounded border border-[var(--line)] bg-transparent px-1 py-1" />
                  <span className="text-[var(--muted)]">ppl</span>
                </label>
                <label className="flex items-center gap-1">
                  <input type="number" value={c.newWorkers} min={0} onChange={(e) => setCrews(crews.map((x, j) => (j === i ? { ...x, newWorkers: Number(e.target.value) } : x)))} className="w-12 rounded border border-[var(--line)] bg-transparent px-1 py-1" />
                  <span className="text-[var(--muted)]">new</span>
                </label>
              </div>
            ))}
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span>Usual shift</span>
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="rounded border border-[var(--line)] bg-transparent px-2 py-1" />
              <span>to</span>
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded border border-[var(--line)] bg-transparent px-2 py-1" />
            </div>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything else? e.g. Crew 2 must finish the Linden block today" className="rounded border border-[var(--line)] bg-transparent px-3 py-2" />
            <button onClick={run} disabled={running} className="mt-1 rounded-full bg-[var(--accent)] px-5 py-3 font-semibold text-white disabled:opacity-60">
              {running ? "Agents working…" : "Plan a safe day"}
            </button>
            {error && <p className="text-sm text-[#b3261e]">Something failed: {error}</p>}
            {replaying && <p className="text-xs text-[var(--muted)]">Demo mode: replaying a recorded real run.</p>}
            {lastRun && process.env.NODE_ENV === "development" && (
              <button onClick={saveDemo} className="self-start text-xs underline">
                Save this run as the demo recording
              </button>
            )}
          </div>
        </section>

        {draft && <PlanView plan={draft} crews={crews} label="Your usual day" />}
        {final && <PlanView plan={final} crews={crews} label="Sombra's plan" />}
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        {final && final.violations.length === 0 && (
          <>
            <h2 className="font-display text-2xl">Crew check-ins</h2>
            <AlertFeed planId={final.id} crews={crews} onAlert={onAlert} />
          </>
        )}
        <h2 className="font-display text-2xl">Agents</h2>
        <AgentPanel cards={cards} />
        {final && final.violations.length === 0 && crewUrl && (
          <section className="flex items-center gap-4 rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
            <QRCodeSVG value={crewUrl} size={112} bgColor="transparent" fgColor="currentColor" />
            <div className="text-sm">
              <p className="font-semibold">Send to crew phones</p>
              <p className="text-[var(--muted)]">Scan to open the plan in Spanish, Punjabi or English, read aloud.</p>
              <a href={`/crew/${final.id}`} target="_blank" className="mt-1 inline-block underline">
                Open crew view
              </a>
            </div>
          </section>
        )}
        <p className="text-[11px] text-[var(--muted)]">
          Weather: Open-Meteo (CC BY 4.0). Map © OpenStreetMap contributors, OpenFreeMap. Rules: Cal/OSHA §3395, §5141.1. <a href="/about" className="underline">How it works &amp; credits</a>
        </p>
      </aside>
    </div>
  );
}
