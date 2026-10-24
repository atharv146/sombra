"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { QRCodeSVG } from "qrcode.react";
import type { AgentEvent, AgentId, Crew, Field, HourlyRisk, ShiftPlan, TriageLabel } from "@/lib/types";
import { Channels } from "./Channels";
import { unlockAudio } from "@/lib/alarm";
import { ImpactPanel } from "./ImpactPanel";
import { PlayDay } from "./PlayDay";
import { SCENARIOS, scenarioFor } from "@/lib/scenarios";
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

export function Command({ fields }: { fields: Field[] }) {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const scenario = SCENARIOS.find((x) => x.id === scenarioId) ?? SCENARIOS[0];
  const mode = scenario.date ? "replay" : "live";
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
  const [playMin, setPlayMin] = useState<number | null>(null);
  const onMinute = useCallback((m: number | null) => {
    setPlayMin(m);
    if (m !== null) setHour(Math.min(19, Math.floor(m / 60)));
  }, []);
  const [shared, setShared] = useState<boolean | null>(null);
  const [lan, setLan] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((h) => {
        setShared(!!h.shared);
        setLan(h.lan ?? null);
      })
      .catch(() => {});
  }, []);
  async function endDay() {
    await fetch("/api/crew/latest", { method: "DELETE" });
    setDraft(null);
    setFinal(null);
    setCards(fresh());
    setAlerts({});
    setBanner(null);
    setCrews(DEFAULT_CREWS);
  }
  const [banner, setBanner] = useState<{ crewId: string; label: TriageLabel; text: string } | null>(null);
  const onAlert = useCallback((crewId: string, label: TriageLabel, text: string) => {
    setAlerts((a) => ({ ...a, [crewId]: label }));
    if (label === "emergency" || label === "heat_exhaustion") setBanner({ crewId, label, text });
  }, []);

  // Load the day's weather as soon as the mode changes, so the map and heat strip work before planning.
  useEffect(() => {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
    fetch(`/api/risks?scenario=${scenarioId}&date=${today}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((r: HourlyRisk[]) => {
        setRisks(r);
        // A plan made for another day no longer matches this weather.
        const matches = (p: ShiftPlan | null) => p && scenarioFor(p.date, p.smoke).id === scenarioId;
        setDraft((d) => (matches(d) ? d : null));
        setFinal((f) => (matches(f) ? f : null));
      })
      .catch(() => {});
  }, [scenarioId]);

  // Open on the active plan (if one exists) so channels, the QR code and "Play the day" work without re-planning.
  useEffect(() => {
    fetch("/api/crew/latest", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((p: ShiftPlan | null) => {
        if (!p?.usual || !p.crewInfo) return;
        setScenarioId(scenarioFor(p.date, p.smoke).id);
        setCrews(p.crewInfo);
        setDraft({ ...p, crews: p.usual, violations: p.usualViolations ?? [], summary: "Your usual schedule" });
        setFinal(p);
      })
      .catch(() => {});
  }, []);

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
    unlockAudio();
    if (start < "04:00" || end > "19:00" || end <= start) {
      setError("The shift has to start after 4:00 AM and end by 7:00 PM.");
      return;
    }
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
        body: JSON.stringify({ mode, date: scenario.date ?? today, smokeAqi: scenario.smokeAqi, start, end, crews, note }),
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
  // Phones can't open "localhost". On a laptop dev server, point them at the laptop's Wi-Fi address instead
  // (same server, so same plan); if there isn't one, fall back to the deployed site.
  const local = typeof window !== "undefined" && window.location.hostname === "localhost";
  const base =
    typeof window === "undefined"
      ? ""
      : local && lan
        ? `http://${lan}:${window.location.port || "3000"}`
        : local && shared && process.env.NEXT_PUBLIC_SITE_URL
          ? process.env.NEXT_PUBLIC_SITE_URL
          : window.location.origin;
  const crewUrl = final ? `${base}/crew/${final.id}` : "";
  const fieldOf = Object.fromEntries(
    (final?.crews ?? []).map((p) => [p.crewId, p.blocks.find((b) => b.kind === "work")?.fieldId ?? ""]),
  );

  return (
    <div className="grid min-h-dvh grid-cols-1 gap-5 p-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,1fr)] lg:p-6">
      {banner && (
        <div className="alert-banner fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-4 bg-[#b3261e] px-5 py-4 text-white shadow-lg">
          <p className="text-lg font-semibold">
            {banner.label === "emergency" ? "EMERGENCY" : "Heat exhaustion"} · {crews.find((c) => c.id === banner.crewId)?.name}: “{banner.text}”
          </p>
          <button onClick={() => setBanner(null)} className="rounded-full bg-white px-4 py-2 text-sm font-bold text-[#b3261e]">
            On it
          </button>
        </div>
      )}
      <div className="flex flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-5xl leading-none">Sombra</h1>
            <p className="mt-2 max-w-xl text-[15px] leading-snug">
              {scenario.smokeAqi ? "Drill: wildfire smoke rolls over Manteca on a hot day." : scenario.date ? `${scenario.label}: ${scenario.detail.toLowerCase()} outside Manteca.` : "Today's live forecast for Manteca."} Enter tomorrow&apos;s crews and Sombra&apos;s AI agents rebuild the day so nobody
              works through deadly heat, prove it follows California&apos;s heat law, and talk to every worker in Spanish or Punjabi.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm" role="tablist" aria-label="Day to plan">
            {SCENARIOS.map((x) => (
              <button
                key={x.id}
                onClick={() => setScenarioId(x.id)}
                disabled={!!final && x.id !== scenarioId}
                title={final && x.id !== scenarioId ? "End the day to plan a different one" : x.detail}
                className={`rounded-xl border px-3 py-1.5 text-left leading-tight disabled:cursor-not-allowed disabled:opacity-35 ${scenarioId === x.id ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--bg)]" : "border-[var(--line)]"}`}
              >
                <span className="block font-semibold">{x.label}</span>
                <span className="block text-[11px] opacity-75">{x.detail.split(" + ")[0]}</span>
              </button>
            ))}
          </div>
        </header>

        <div className="relative h-[420px] overflow-hidden rounded-xl border border-[var(--line)] lg:h-[500px]">
          <FieldMap fields={fields} risks={risks} hour={hour} crewLabels={crewLabels} alerts={Object.fromEntries(Object.entries(alerts).flatMap(([crewId, label]) => { const c = crews.find((x) => x.id === crewId); return c && label !== "ok" ? [[c.fieldId, label]] : []; }))} />
        </div>
        <p className="-mt-3 text-xs text-[var(--muted)]">
          Dots are the 3 fields, colored by heat danger at the hour you pick below. A pulsing ring means it&apos;s dangerous to work there at that hour; a large flashing red dot means a worker on that crew just reported feeling sick.
        </p>

        {risks.length > 0 && (
          <section className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">Heat danger by hour at each field</span>
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
            <p className="mt-2 text-xs text-[var(--muted)]">
              Each square is one hour, 4am to 7pm. Color is heat danger from temperature, humidity and sun (WBGT): green safe, yellow caution, orange high, red deadly for hard work. Drag the slider to move through the day; map dots change color and pulse when a field is dangerous at that hour.
            </p>
            <input type="range" min={4} max={19} value={hour} onChange={(e) => setHour(Number(e.target.value))} className="mt-3 w-full" aria-label="Hour of day" />
          </section>
        )}

        <section className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
          <h2 className="font-semibold">Tomorrow&apos;s crews</h2>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            {crews.map((c, i) => (
              <div key={c.id} className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{c.name}</span>
                <select
                  value={c.fieldId}
                  style={{ flexBasis: "11rem" }}
                  onChange={(e) => setCrews(crews.map((x, j) => (j === i ? { ...x, fieldId: e.target.value } : x)))}
                  className="min-w-0 flex-1 rounded border border-[var(--line)] bg-transparent px-2 py-1"
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
            <div className="flex gap-3 text-xs">
              {crews.length < 4 && (
                <button
                  onClick={() =>
                    setCrews([...crews, { id: `c${crews.length + 1}`, name: `Crew ${crews.length + 1}`, size: 25, newWorkers: 0, fieldId: fields[crews.length % fields.length].id, lang: ["es"], pieceRateUsdPerHour: 21 }])
                  }
                  className="underline"
                >
                  + Add crew
                </button>
              )}
              {crews.length > 1 && (
                <button onClick={() => setCrews(crews.slice(0, -1))} className="text-[var(--muted)] underline">
                  Remove last crew
                </button>
              )}
            </div>
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

        {draft && final && risks.length > 0 && final.violations.length === 0 && (
          <PlayDay before={draft} after={final} crews={crews} fields={fields} risks={risks} planId={final.id} onMinute={onMinute} />
        )}
        {draft && final && risks.length > 0 && <ImpactPanel before={draft} after={final} crews={crews} fields={fields} risks={risks} />}
        {draft && <PlanView plan={draft} crews={crews} label="Your usual day" risks={risks} fields={fields} tone="before" nowMin={playMin} />}
        {final && <PlanView plan={final} crews={crews} label="Sombra's plan" risks={risks} fields={fields} tone="after" nowMin={playMin} compare={draft ?? undefined} />}
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        <section className="rounded-xl border-2 border-[var(--ink)] bg-[var(--card)] p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-2xl">Worker phones</h2>
            {final && (
              <button onClick={endDay} className="text-xs font-semibold text-[#b3261e] underline">
                End day
              </button>
            )}
          </div>
          {!final ? (
            <p className="mt-1 text-sm text-[var(--muted)]">Plan a safe day first. Then workers scan the code here to get their crew&apos;s schedule.</p>
          ) : local && !lan && shared === false ? (
            <p className="mt-1 text-sm text-[#b3261e]">
              This laptop is running locally, so phones can&apos;t see its plans. For phone testing use <b>{process.env.NEXT_PUBLIC_SITE_URL ?? "the live site"}</b>.
            </p>
          ) : (
            <div className="mt-2 flex items-center gap-4">
              <QRCodeSVG value={crewUrl} size={120} bgColor="transparent" fgColor="currentColor" />
              <div className="text-sm">
                <p>Scan with a phone camera, or type:</p>
                <p className="mt-1 break-all font-mono text-xs">{base.replace(/^https?:\/\//, "")}/crew/latest</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {local && lan ? "Phone must be on the same Wi-Fi as this laptop. " : ""}Phones follow whichever plan is active. End day clears them.
                </p>
              </div>
            </div>
          )}
        </section>
        {final && final.violations.length === 0 && (
          <>
            <h2 className="font-display text-2xl">Crew channels</h2>
            <p className="-mt-2 text-xs text-[var(--muted)]">The day ({scenario.label}) is locked while this plan is active. Use End day to switch.</p>
            {final.createdAt && (
              <p className="-mt-2 text-xs text-[var(--muted)]">
                Active plan since {new Date(final.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}. Workers&apos; phones follow it automatically; planning again replaces it and clears these channels.
              </p>
            )}
            <Channels key={final.id} planId={final.id} crews={crews} fields={fields} fieldOf={fieldOf} onAlert={onAlert} />
          </>
        )}
        <h2 className="font-display text-2xl">Agents</h2>
        <AgentPanel cards={cards} />

        <p className="text-[11px] text-[var(--muted)]">
          Weather: Open-Meteo (CC BY 4.0). Map © OpenStreetMap contributors, OpenFreeMap. Rules: Cal/OSHA §3395, §5141.1. <a href="/about" className="underline">How it works &amp; credits</a>
        </p>
      </aside>
    </div>
  );
}
