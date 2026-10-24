"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { canListen, listen, speak, voiceFor } from "@/lib/speech";
import { toMin } from "@/lib/rules";
import type { CheckIn, Lang, RadioMessage, ShiftPlan, TriageLabel } from "@/lib/types";

// UI text per language. Punjabi strings should be checked by a Punjabi speaker.
const T = {
  es: {
    today: "Tu día", listen: "Escuchar", work: "Trabajo", meal: "Comida", cooldown: "Descanso pagado", travel: "Traslado",
    radio: "Mensajes del mayordomo", none: "Sin mensajes todavía", ask: "¿Cómo te sientes?", tap: "Toca y habla",
    listening: "Escuchando…", type: "O escribe aquí", send: "Enviar", sent: "Enviado a tu mayordomo", noVoice: "Este teléfono no tiene voz en este idioma.",
    loading: "Cargando tu plan…", missing: "No encontramos este plan. Pide un código nuevo a tu mayordomo.", crew: "Tu cuadrilla",
    result: {
      ok: "Gracias. Sigue tomando agua cada 15 minutos.",
      warning: "Toma un descanso pagado en la sombra ahora y toma agua.",
      heat_exhaustion: "Para de trabajar. Ve a la sombra. Tu mayordomo ya sabe.",
      emergency: "Avísale a tu mayordomo ahora. Llama al 911.",
    },
  },
  pa: {
    today: "ਤੁਹਾਡਾ ਦਿਨ", listen: "ਸੁਣੋ", work: "ਕੰਮ", meal: "ਖਾਣਾ", cooldown: "ਤਨਖਾਹ ਵਾਲਾ ਆਰਾਮ", travel: "ਸਫ਼ਰ",
    radio: "ਸੁਪਰਵਾਈਜ਼ਰ ਦੇ ਸੁਨੇਹੇ", none: "ਅਜੇ ਕੋਈ ਸੁਨੇਹਾ ਨਹੀਂ", ask: "ਤੁਸੀਂ ਕਿਵੇਂ ਮਹਿਸੂਸ ਕਰ ਰਹੇ ਹੋ?", tap: "ਦਬਾਓ ਅਤੇ ਬੋਲੋ",
    listening: "ਸੁਣ ਰਿਹਾ ਹੈ…", type: "ਜਾਂ ਇੱਥੇ ਲਿਖੋ", send: "ਭੇਜੋ", sent: "ਸੁਪਰਵਾਈਜ਼ਰ ਨੂੰ ਭੇਜਿਆ", noVoice: "ਇਸ ਫ਼ੋਨ ਵਿੱਚ ਪੰਜਾਬੀ ਆਵਾਜ਼ ਨਹੀਂ ਹੈ।",
    loading: "ਯੋਜਨਾ ਲੋਡ ਹੋ ਰਹੀ ਹੈ…", missing: "ਇਹ ਯੋਜਨਾ ਨਹੀਂ ਮਿਲੀ। ਸੁਪਰਵਾਈਜ਼ਰ ਤੋਂ ਨਵਾਂ ਕੋਡ ਮੰਗੋ।", crew: "ਤੁਹਾਡਾ ਕਰੂ",
    result: {
      ok: "ਧੰਨਵਾਦ। ਹਰ 15 ਮਿੰਟ ਪਾਣੀ ਪੀਂਦੇ ਰਹੋ।",
      warning: "ਹੁਣੇ ਛਾਂ ਵਿੱਚ ਤਨਖਾਹ ਵਾਲਾ ਆਰਾਮ ਕਰੋ ਅਤੇ ਪਾਣੀ ਪੀਓ।",
      heat_exhaustion: "ਕੰਮ ਬੰਦ ਕਰੋ। ਛਾਂ ਵਿੱਚ ਜਾਓ। ਸੁਪਰਵਾਈਜ਼ਰ ਨੂੰ ਪਤਾ ਹੈ।",
      emergency: "ਹੁਣੇ ਸੁਪਰਵਾਈਜ਼ਰ ਨੂੰ ਦੱਸੋ। 911 'ਤੇ ਕਾਲ ਕਰੋ।",
    },
  },
  en: {
    today: "Your day", listen: "Listen", work: "Work", meal: "Meal", cooldown: "Paid break", travel: "Travel",
    radio: "Messages from your crew boss", none: "No messages yet", ask: "How do you feel?", tap: "Tap and speak",
    listening: "Listening…", type: "Or type here", send: "Send", sent: "Sent to your crew boss", noVoice: "This phone has no voice for this language.",
    loading: "Loading your plan…", missing: "We couldn't find this plan. Ask your crew boss for a new code.", crew: "Your crew",
    result: {
      ok: "Thanks. Keep drinking water every 15 minutes.",
      warning: "Take a paid break in the shade now and drink water.",
      heat_exhaustion: "Stop working. Go to the shade. Your crew boss knows.",
      emergency: "Tell your crew boss now. Call 911.",
    },
  },
} satisfies Record<Lang, unknown>;

const LANGS: { id: Lang; label: string }[] = [
  { id: "es", label: "Español" },
  { id: "pa", label: "ਪੰਜਾਬੀ" },
  { id: "en", label: "English" },
];

const TONE: Record<TriageLabel, string> = { ok: "#3f6b3a", warning: "#b7862a", heat_exhaustion: "#c85f22", emergency: "#b3261e" };

function stored(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

export function CrewView() {
  const { planId } = useParams<{ planId: string }>();
  const [plan, setPlan] = useState<ShiftPlan | null>(null);
  const [missing, setMissing] = useState(false);
  const [lang, setLangState] = useState<Lang>("es");
  const [crewId, setCrewId] = useState<string>("");
  const [workerId, setWorkerId] = useState("w-anon");
  const [radio, setRadio] = useState<RadioMessage[]>([]);
  const [listening, setListening] = useState(false);
  const [typed, setTyped] = useState("");
  const [last, setLast] = useState<CheckIn | null>(null);
  const [hasVoice, setHasVoice] = useState(true);
  const [now, setNow] = useState(0);
  const heard = useRef(new Set<string>());
  const t = T[lang];

  useEffect(() => {
    setLangState((stored("sombra-lang", "es") as Lang) || "es");
    let id = stored("sombra-worker", "");
    if (!id) {
      id = `w-${Math.random().toString(36).slice(2, 6)}`;
      store("sombra-worker", id);
    }
    setWorkerId(id);
    const d = new Date();
    setNow(d.getHours() * 60 + d.getMinutes());
    fetch(`/api/crew/${planId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((p: ShiftPlan) => {
        setPlan(p);
        setCrewId(stored(`sombra-crew-${planId}`, p.crews[0]?.crewId ?? ""));
      })
      .catch(() => setMissing(true));
  }, [planId]);

  useEffect(() => {
    const check = () => setHasVoice(!!voiceFor(lang));
    check();
    window.speechSynthesis?.addEventListener?.("voiceschanged", check);
    return () => window.speechSynthesis?.removeEventListener?.("voiceschanged", check);
  }, [lang]);

  // Poll the crew radio; read new boss messages aloud in my language.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const list = (await fetch(`/api/radio/${planId}`, { cache: "no-store" }).then((r) => r.json())) as RadioMessage[];
        if (!alive) return;
        const mine = list.filter((m) => !m.crewId || m.crewId === crewId);
        const fresh = mine.filter((m) => !heard.current.has(m.id));
        const first = heard.current.size === 0;
        fresh.forEach((m) => heard.current.add(m.id));
        if (!first && fresh.length) speak(fresh[fresh.length - 1].text[lang], lang);
        setRadio(mine);
      } catch {}
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [planId, crewId, lang]);

  function setLang(l: Lang) {
    setLangState(l);
    store("sombra-lang", l);
  }

  async function checkIn(text: string) {
    if (!text.trim() || !plan) return;
    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ planId, crewId, workerId, lang, transcript: text }),
    });
    if (res.ok) {
      const c = (await res.json()) as CheckIn;
      setLast(c);
      speak(t.result[c.triage.label], lang);
      setTyped("");
    }
  }

  async function talk() {
    setListening(true);
    try {
      await checkIn(await listen(lang));
    } catch {
      // No recognition on this phone or nothing heard: the text box below still works.
    } finally {
      setListening(false);
    }
  }

  if (missing) return <main className="p-6 text-xl">{t.missing}</main>;
  if (!plan) return <main className="p-6 text-xl">{t.loading}</main>;

  const mine = plan.crews.find((c) => c.crewId === crewId) ?? plan.crews[0];
  const info = plan.crewInfo?.find((c) => c.id === mine?.crewId);
  const rate = info?.pieceRateUsdPerHour ?? 22;
  const briefing = plan.briefings[lang] ?? plan.briefings.en ?? "";

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pb-16 pt-5 text-[var(--ink)]">
      <header className="flex items-center justify-between">
        <span className="font-display text-3xl">Sombra</span>
        <div className="flex rounded-full border border-[var(--line)] p-1">
          {LANGS.map((l) => (
            <button key={l.id} onClick={() => setLang(l.id)} className={`rounded-full px-3 py-2 text-sm ${lang === l.id ? "bg-[var(--ink)] text-[var(--bg)]" : ""}`}>
              {l.label}
            </button>
          ))}
        </div>
      </header>

      {plan.crews.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-[var(--muted)]">{t.crew}:</span>
          {plan.crews.map((c) => {
            const name = plan.crewInfo?.find((x) => x.id === c.crewId)?.name ?? c.crewId;
            return (
              <button
                key={c.crewId}
                onClick={() => {
                  setCrewId(c.crewId);
                  store(`sombra-crew-${planId}`, c.crewId);
                }}
                className={`rounded-full border px-3 py-1.5 ${c.crewId === mine?.crewId ? "border-[var(--ink)] bg-[var(--card)] font-semibold" : "border-[var(--line)]"}`}
              >
                {name}
              </button>
            );
          })}
        </div>
      )}

      <section className="rounded-2xl bg-[var(--card)] p-5 shadow-[0_1px_0_var(--line)]">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-4xl leading-none">{t.today}</h1>
          <button onClick={() => speak(briefing, lang)} className="rounded-full bg-[var(--accent)] px-5 py-3 text-lg font-semibold text-white">
            ▶ {t.listen}
          </button>
        </div>
        {!hasVoice && <p className="mt-2 text-sm text-[var(--muted)]">{t.noVoice}</p>}
        <p className="mt-3 text-lg leading-snug">{briefing}</p>
        <ol className="mt-4 flex flex-col">
          {mine?.blocks.map((b, i) => {
            const active = now >= toMin(b.start) && now < toMin(b.end);
            const pay = b.kind === "cooldown" ? ((toMin(b.end) - toMin(b.start)) / 60) * rate : 0;
            return (
              <li key={i} className={`flex items-baseline justify-between gap-3 border-t border-[var(--line)] py-3 ${active ? "-mx-2 rounded-lg bg-[var(--track)] px-2" : ""}`}>
                <span className="font-mono text-lg tabular-nums">
                  {b.start}–{b.end}
                </span>
                <span className={`text-right text-lg ${b.kind === "cooldown" ? "font-semibold text-[#2f6f8f]" : ""}`}>
                  {t[b.kind]}
                  {b.kind === "cooldown" && <span className="block text-sm">${pay.toFixed(2)}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="flex flex-col items-center gap-3 rounded-2xl bg-[var(--card)] p-5 text-center">
        <h2 className="font-display text-3xl">{t.ask}</h2>
        {canListen() && (
          <button
            onClick={talk}
            disabled={listening}
            className={`mic h-36 w-36 rounded-full text-lg font-semibold text-white ${listening ? "is-listening" : ""}`}
            aria-label={t.tap}
          >
            {listening ? t.listening : t.tap}
          </button>
        )}
        <form
          className="flex w-full gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            checkIn(typed);
          }}
        >
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={t.type} className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-transparent px-3 py-3 text-lg" />
          <button className="rounded-xl bg-[var(--ink)] px-4 text-[var(--bg)]">{t.send}</button>
        </form>
        {last && (
          <div className="w-full rounded-xl p-4 text-left text-white" style={{ background: TONE[last.triage.label] }}>
            <p className="text-xl font-semibold leading-snug">{t.result[last.triage.label]}</p>
            <p className="mt-2 text-sm opacity-90">
              “{last.transcript}” · {t.sent}
            </p>
            {last.triage.label === "emergency" && (
              <a href="tel:911" className="mt-3 block rounded-lg bg-white py-3 text-center text-lg font-bold text-[#b3261e]">
                911
              </a>
            )}
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-[var(--card)] p-5">
        <h2 className="font-display text-2xl">{t.radio}</h2>
        {radio.length === 0 ? (
          <p className="mt-2 text-[var(--muted)]">{t.none}</p>
        ) : (
          <ol className="mt-3 flex flex-col gap-3">
            {[...radio].reverse().map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-3">
                <p className="text-lg leading-snug">{m.text[lang]}</p>
                <button onClick={() => speak(m.text[lang], lang)} className="shrink-0 rounded-full border border-[var(--line)] px-3 py-1.5" aria-label={t.listen}>
                  ▶
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
