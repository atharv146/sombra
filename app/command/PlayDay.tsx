"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { dayEvents, extremeUntil } from "@/lib/impact";
import { alarm, unlockAudio } from "@/lib/alarm";
import type { Crew, Field, HourlyRisk, ShiftPlan } from "@/lib/types";

const START = 4 * 60;
const END = 19 * 60;
const STEP_MS = 280; // 10 simulated minutes per tick: the whole day in about 25 seconds
const ampm = (m: number) => `${((Math.floor(m / 60) + 11) % 12) + 1}:${String(m % 60).padStart(2, "0")}${m < 720 ? "am" : "pm"}`;

// Replays the day from 4am to 7pm: clock, live counters, a story ticker, and a real heat alert to phones.
export function PlayDay({
  before,
  after,
  crews,
  fields,
  risks,
  planId,
  onMinute,
}: {
  before: ShiftPlan;
  after: ShiftPlan;
  crews: Crew[];
  fields: Field[];
  risks: HourlyRisk[];
  planId: string;
  onMinute: (m: number | null) => void;
}) {
  const [min, setMin] = useState<number | null>(null);
  const alerted = useRef(false);
  const events = useMemo(() => dayEvents(before, after, crews, risks, fields), [before, after, crews, risks, fields]);

  useEffect(() => {
    if (min === null) return;
    onMinute(min);
    if (min >= END) return;
    const t = setTimeout(() => setMin(min + 10), STEP_MS);
    return () => clearTimeout(t);
  }, [min, onMinute]);

  useEffect(() => {
    if (min === null || alerted.current) return;
    const alert = events.find((e) => e.tone === "alert");
    if (alert && min >= alert.at) {
      alerted.current = true;
      alarm(2);
      fetch(`/api/radio/${planId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "alert" }) }).catch(() => {});
    }
  }, [min, events, planId]);

  const play = () => {
    unlockAudio();
    alerted.current = false;
    setMin(START);
  };
  const stop = () => {
    setMin(null);
    onMinute(null);
  };

  const shown = min === null ? [] : events.filter((e) => e.at <= min);
  const usual = min === null ? 0 : extremeUntil(before, crews, risks, min);
  const ours = min === null ? 0 : extremeUntil(after, crews, risks, min);
  const hottest = min === null ? null : risks.filter((r) => Number(r.time.slice(11, 13)) === Math.floor(min / 60)).sort((a, b) => b.tempF - a.tempF)[0];

  return (
    <section className="rounded-xl border-2 border-[var(--accent)] bg-[var(--card)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl leading-none">Play the day</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">Watch July 11 unfold, 4am to 7pm, with the usual schedule and Sombra&apos;s side by side. At the first deadly hour it sends a real heat alert to every phone on this plan.</p>
        </div>
        <button onClick={min === null || min >= END ? play : stop} className="rounded-full bg-[var(--accent)] px-5 py-2.5 font-semibold text-white">
          {min === null ? "▶ Play the day" : min >= END ? "↻ Replay" : "■ Stop"}
        </button>
      </div>

      {min !== null && (
        <>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-[var(--track)] p-3">
              <p className="font-mono text-2xl tabular-nums">{ampm(min)}</p>
              <p className="text-xs text-[var(--muted)]">{hottest ? `${hottest.tempF}°F at the hottest field` : ""}</p>
            </div>
            <div className="rounded-lg bg-[var(--bad-wash)] p-3">
              <p className="font-mono text-2xl tabular-nums text-[var(--bad-ink)]">{usual}</p>
              <p className="text-xs">deadly-heat worker-hours, usual day</p>
            </div>
            <div className="rounded-lg bg-[var(--good-wash)] p-3">
              <p className="font-mono text-2xl tabular-nums text-[var(--good-ink)]">{ours}</p>
              <p className="text-xs">deadly-heat worker-hours, Sombra</p>
            </div>
          </div>
          <ol className="mt-3 flex max-h-48 flex-col-reverse gap-1 overflow-y-auto text-sm">
            {shown.map((e, i) => (
              <li
                key={i}
                className={`play-event rounded px-2 py-1 ${e.tone === "bad" ? "bg-[var(--bad-wash)] text-[var(--bad-ink)]" : e.tone === "alert" ? "bg-[#b3261e] font-semibold text-white" : "bg-[var(--track)]"}`}
              >
                <span className="mr-2 font-mono text-xs">{ampm(e.at)}</span>
                {e.text}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
