"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { alarm, chime, sent, unlockAudio } from "@/lib/alarm";
import { canListen, listen, speakAny, startRecording } from "@/lib/speech";
import { toMin } from "@/lib/rules";
import type { Lang, RadioMessage, ShiftPlan, TriageLabel } from "@/lib/types";

// UI text per language. Punjabi strings should be checked by a Punjabi speaker.
const T = {
  es: {
    newPlan: "Tu mayordomo hizo un plan nuevo.", waiting: "No hay plan activo. Esperando a tu mayordomo…", micBlocked: "Permite el micrófono para este sitio en la configuración del navegador.", secs: "seg",
    quick: ["Estoy bien", "Necesito agua", "Me siento mal"], coolAsk: "Hora de tu descanso pagado. ¿Cómo te sientes?",
    privacy: "Privacidad",
    nowL: "Ahora", nextL: "Sigue", inL: "en", untilL: "hasta", doneL: "Terminaste por hoy. Descansa y toma agua.", voiceNote: "Tu voz se convierte en texto y solo la ve tu mayordomo. Sombra ayuda, pero no reemplaza las reglas de seguridad.",
    today: "Tu día", listen: "Escuchar", work: "Trabajo", meal: "Comida", cooldown: "Descanso pagado", travel: "Traslado",
    thread: "Mensajes con tu mayordomo", none: "Sin mensajes todavía", ask: "¿Cómo te sientes?", hint: "Habla en cualquier idioma",
    tap: "Toca para hablar", stop: "Toca para enviar", sending: "Enviando…", type: "O escribe aquí", send: "Enviar",
    you: "Tú", boss: "Mayordomo", loading: "Cargando tu plan…", missing: "No encontramos este plan. Pide un código nuevo a tu mayordomo.",
    crew: "Tu cuadrilla", enable: "Toca aquí para activar alertas con sonido", alertTitle: "ALERTA DE CALOR", safe: "Entendido, voy a la sombra",
    sent: "Enviado a tu mayordomo. Te responde aquí.", heard: "No te escuché. Intenta otra vez o escribe.",
    reply: {
      ok: "Gracias. Sigue tomando agua cada 15 minutos.",
      warning: "Toma un descanso pagado en la sombra ahora y toma agua. Tu mayordomo ya sabe.",
      heat_exhaustion: "Para de trabajar. Ve a la sombra y toma agua despacio. Tu mayordomo ya viene.",
      emergency: "Emergencia: avisamos a tu mayordomo. Llama al 911.",
    },
  },
  pa: {
    newPlan: "ਸੁਪਰਵਾਈਜ਼ਰ ਨੇ ਨਵੀਂ ਯੋਜਨਾ ਬਣਾਈ ਹੈ।", waiting: "ਕੋਈ ਯੋਜਨਾ ਚਾਲੂ ਨਹੀਂ। ਸੁਪਰਵਾਈਜ਼ਰ ਦੀ ਉਡੀਕ…", micBlocked: "ਬ੍ਰਾਊਜ਼ਰ ਸੈਟਿੰਗਾਂ ਵਿੱਚ ਇਸ ਸਾਈਟ ਲਈ ਮਾਈਕ੍ਰੋਫ਼ੋਨ ਦੀ ਇਜਾਜ਼ਤ ਦਿਓ।", secs: "ਸਕਿੰਟ",
    quick: ["ਮੈਂ ਠੀਕ ਹਾਂ", "ਮੈਨੂੰ ਪਾਣੀ ਚਾਹੀਦਾ", "ਮੈਨੂੰ ਠੀਕ ਨਹੀਂ ਲੱਗ ਰਿਹਾ"], coolAsk: "ਤਨਖਾਹ ਵਾਲੇ ਆਰਾਮ ਦਾ ਸਮਾਂ। ਤੁਸੀਂ ਕਿਵੇਂ ਮਹਿਸੂਸ ਕਰ ਰਹੇ ਹੋ?",
    privacy: "ਪਰਦੇਦਾਰੀ",
    nowL: "ਹੁਣ", nextL: "ਅਗਲਾ", inL: "ਵਿੱਚ", untilL: "ਤੱਕ", doneL: "ਅੱਜ ਦਾ ਕੰਮ ਖ਼ਤਮ। ਆਰਾਮ ਕਰੋ ਅਤੇ ਪਾਣੀ ਪੀਓ।", voiceNote: "ਤੁਹਾਡੀ ਆਵਾਜ਼ ਲਿਖਤ ਬਣਦੀ ਹੈ ਅਤੇ ਸਿਰਫ਼ ਸੁਪਰਵਾਈਜ਼ਰ ਵੇਖਦਾ ਹੈ। Sombra ਮਦਦ ਕਰਦਾ ਹੈ, ਪਰ ਸੁਰੱਖਿਆ ਨਿਯਮਾਂ ਦੀ ਥਾਂ ਨਹੀਂ ਲੈਂਦਾ।",
    today: "ਤੁਹਾਡਾ ਦਿਨ", listen: "ਸੁਣੋ", work: "ਕੰਮ", meal: "ਖਾਣਾ", cooldown: "ਤਨਖਾਹ ਵਾਲਾ ਆਰਾਮ", travel: "ਸਫ਼ਰ",
    thread: "ਸੁਪਰਵਾਈਜ਼ਰ ਨਾਲ ਸੁਨੇਹੇ", none: "ਅਜੇ ਕੋਈ ਸੁਨੇਹਾ ਨਹੀਂ", ask: "ਤੁਸੀਂ ਕਿਵੇਂ ਮਹਿਸੂਸ ਕਰ ਰਹੇ ਹੋ?", hint: "ਕਿਸੇ ਵੀ ਭਾਸ਼ਾ ਵਿੱਚ ਬੋਲੋ",
    tap: "ਬੋਲਣ ਲਈ ਦਬਾਓ", stop: "ਭੇਜਣ ਲਈ ਦਬਾਓ", sending: "ਭੇਜ ਰਿਹਾ ਹੈ…", type: "ਜਾਂ ਇੱਥੇ ਲਿਖੋ", send: "ਭੇਜੋ",
    you: "ਤੁਸੀਂ", boss: "ਸੁਪਰਵਾਈਜ਼ਰ", loading: "ਯੋਜਨਾ ਲੋਡ ਹੋ ਰਹੀ ਹੈ…", missing: "ਇਹ ਯੋਜਨਾ ਨਹੀਂ ਮਿਲੀ। ਸੁਪਰਵਾਈਜ਼ਰ ਤੋਂ ਨਵਾਂ ਕੋਡ ਮੰਗੋ।",
    crew: "ਤੁਹਾਡਾ ਕਰੂ", enable: "ਆਵਾਜ਼ ਵਾਲੇ ਅਲਰਟ ਚਾਲੂ ਕਰਨ ਲਈ ਇੱਥੇ ਦਬਾਓ", alertTitle: "ਗਰਮੀ ਦੀ ਚੇਤਾਵਨੀ", safe: "ਸਮਝ ਗਿਆ, ਛਾਂ ਵਿੱਚ ਜਾ ਰਿਹਾ ਹਾਂ",
    sent: "ਸੁਪਰਵਾਈਜ਼ਰ ਨੂੰ ਭੇਜਿਆ। ਜਵਾਬ ਇੱਥੇ ਆਵੇਗਾ।", heard: "ਸੁਣਿਆ ਨਹੀਂ। ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ ਜਾਂ ਲਿਖੋ।",
    reply: {
      ok: "ਧੰਨਵਾਦ। ਹਰ 15 ਮਿੰਟ ਪਾਣੀ ਪੀਂਦੇ ਰਹੋ।",
      warning: "ਹੁਣੇ ਛਾਂ ਵਿੱਚ ਤਨਖਾਹ ਵਾਲਾ ਆਰਾਮ ਕਰੋ ਅਤੇ ਪਾਣੀ ਪੀਓ। ਸੁਪਰਵਾਈਜ਼ਰ ਨੂੰ ਪਤਾ ਹੈ।",
      heat_exhaustion: "ਕੰਮ ਬੰਦ ਕਰੋ। ਛਾਂ ਵਿੱਚ ਜਾਓ ਅਤੇ ਹੌਲੀ ਹੌਲੀ ਪਾਣੀ ਪੀਓ। ਸੁਪਰਵਾਈਜ਼ਰ ਆ ਰਿਹਾ ਹੈ।",
      emergency: "ਐਮਰਜੈਂਸੀ: ਸੁਪਰਵਾਈਜ਼ਰ ਨੂੰ ਦੱਸ ਦਿੱਤਾ ਹੈ। 911 'ਤੇ ਕਾਲ ਕਰੋ।",
    },
  },
  en: {
    newPlan: "Your crew boss made a new plan.", waiting: "No active plan. Waiting for your crew boss…", micBlocked: "Allow the microphone for this site in your browser settings.", secs: "sec",
    quick: ["I'm OK", "I need water", "I feel sick"], coolAsk: "Paid cool-down time. How do you feel?",
    privacy: "Privacy",
    nowL: "Now", nextL: "Next", inL: "in", untilL: "until", doneL: "You're done for today. Rest and drink water.", voiceNote: "Your voice becomes text that only your crew boss sees. Sombra helps, but doesn't replace safety rules.",
    today: "Your day", listen: "Listen", work: "Work", meal: "Lunch", cooldown: "Paid break", travel: "Travel",
    thread: "Messages with your crew boss", none: "No messages yet", ask: "How do you feel?", hint: "Speak in any language",
    tap: "Tap to talk", stop: "Tap to send", sending: "Sending…", type: "Or type here", send: "Send",
    you: "You", boss: "Crew boss", loading: "Loading your plan…", missing: "We couldn't find this plan. Ask your crew boss for a new code.",
    crew: "Your crew", enable: "Tap here to turn on alerts with sound", alertTitle: "HEAT ALERT", safe: "Got it, going to the shade",
    sent: "Sent to your crew boss. They'll reply here.", heard: "Didn't catch that. Try again or type.",
    reply: {
      ok: "Thanks. Keep drinking water every 15 minutes.",
      warning: "Take a paid break in the shade now and drink water. Your crew boss knows.",
      heat_exhaustion: "Stop working. Go to the shade and sip water slowly. Your crew boss is coming.",
      emergency: "Emergency: your crew boss has been told. Call 911.",
    },
  },
} satisfies Record<Lang, unknown>;

const LANGS: { id: Lang; label: string }[] = [
  { id: "es", label: "Español" },
  { id: "pa", label: "ਪੰਜਾਬੀ" },
  { id: "en", label: "English" },
];
const TONE: Record<TriageLabel, string> = { ok: "#3f6b3a", warning: "#b7862a", heat_exhaustion: "#c85f22", emergency: "#b3261e" };
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const ampm = (hhmm: string) => {
  const m = toMin(hhmm);
  const h = Math.floor(m / 60);
  return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, "0")}${h < 12 ? "am" : "pm"}`;
};

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
  const { planId: param } = useParams<{ planId: string }>();
  const [planId, setPlanId] = useState(param);
  const [plan, setPlan] = useState<ShiftPlan | null>(null);
  const [missing, setMissing] = useState(false);
  const [lang, setLangState] = useState<Lang>("en");
  const [crewId, setCrewId] = useState("");
  const [workerId, setWorkerId] = useState("w-anon");
  const [msgs, setMsgs] = useState<RadioMessage[]>([]);
  const [rec, setRec] = useState<null | { stop: () => Promise<Blob>; level: () => number }>(null);
  const micRef = useRef<HTMLButtonElement>(null);
  // While recording, the ring around the mic grows with your voice.
  useEffect(() => {
    if (!rec) {
      if (micRef.current) micRef.current.style.boxShadow = "";
      return;
    }
    let raf = 0;
    const draw = () => {
      const l = rec.level();
      if (micRef.current) micRef.current.style.boxShadow = `0 0 0 ${6 + l * 34}px rgba(166, 129, 80, ${0.25 + l * 0.35})`;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [rec]);
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");
  const [note, setNote] = useState("");
  const [whisper, setWhisper] = useState(false);
  const [armed, setArmed] = useState(false);
  const [takeover, setTakeover] = useState<RadioMessage | null>(null);
  const [now, setNow] = useState(0);
  const [notice, setNotice] = useState(false);
  const [recSec, setRecSec] = useState(0);
  const [ask, setAsk] = useState(false); // "how do you feel?" prompt at a cool-down
  const seen = useRef(new Set<string>());
  const endRef = useRef<HTMLDivElement>(null);
  const count = useRef(0);
  const loaded = useRef(false);
  const t = T[lang];

  useEffect(() => {
    setLangState((stored("sombra-lang", "en") as Lang) || "en");
    let id = stored("sombra-worker", "");
    if (!id) {
      id = `w-${Math.random().toString(36).slice(2, 6)}`;
      store("sombra-worker", id);
    }
    setWorkerId(id);
    const d = new Date();
    setNow(d.getHours() * 60 + d.getMinutes());
    fetch("/api/transcribe")
      .then((r) => r.json())
      .then((x) => setWhisper(!!x.enabled))
      .catch(() => {});
  }, []);

  // Load the plan from the link, then keep following the crew boss's newest plan. Expired plans end right away.
  useEffect(() => {
    let alive = true;
    let current: ShiftPlan | null = null;
    const get = (id: string) => fetch(`/api/crew/${id}`, { cache: "no-store" }).then((r) => (r.ok ? (r.json() as Promise<ShiftPlan>) : null)).catch(() => null);
    const adopt = (p: ShiftPlan, isNew: boolean) => {
      current = p;
      seen.current.clear();
      loaded.current = false;
      setMsgs([]);
      setPlan(p);
      setPlanId(p.id);
      setCrewId(stored(`sombra-crew-${p.id}`, p.crews[0]?.crewId ?? ""));
      setMissing(false);
      setNotice(isNew);
    };
    // Phones only ever show the ACTIVE plan (whatever link opened them). No active plan = day ended, and it
    // stays ended until the crew boss plans a new day, so the screen never flips back to an old plan.
    const tick = async () => {
      const latest = await get("latest");
      if (!alive) return;
      if (!current) {
        if (latest) adopt(latest, false);
        else setMissing(true);
        return;
      }
      if (!latest) {
        current = null;
        setPlan(null);
        setMissing(true);
      } else if (latest.id !== current.id && (latest.createdAt ?? "") >= (current.createdAt ?? "")) adopt(latest, true);
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [param]);

  // Poll this crew's channel. New boss messages are read aloud; heat alerts take over the screen with an alarm.
  useEffect(() => {
    if (!crewId) return;
    let alive = true;
    const tick = async () => {
      try {
        const list = (await fetch(`/api/radio/${planId}`, { cache: "no-store" }).then((r) => r.json())) as RadioMessage[];
        if (!alive) return;
        const mine = list.filter((m) => (m.from === "boss" && (!m.crewId || m.crewId === crewId)) || (m.from === "worker" && m.workerId === workerId && m.crewId === crewId));
        for (const m of mine) {
          if (seen.current.has(m.id)) continue;
          seen.current.add(m.id);
          if (!loaded.current || m.from !== "boss") continue;
          if (m.kind === "alert") {
            setTakeover(m);
            alarm(4);
            setTimeout(() => speakAny(m.text[lang], lang), 2200);
          } else if (m.kind === "checkin") {
            setAsk(true);
            alarm(1);
            setTimeout(() => speakAny(m.text[lang], lang), 900);
          } else {
            chime();
            setTimeout(() => speakAny(m.text[lang], lang), 450);
          }
        }
        loaded.current = true;
        setMsgs(mine);
      } catch {}
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [planId, crewId, workerId, lang]);

  // Keep the "now / next" card current. (Check-in prompts only come when the crew boss asks.)
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      setNow(d.getHours() * 60 + d.getMinutes());
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  const talkRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!rec) return setRecSec(0);
    const id = setInterval(() => setRecSec((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [rec]);
  useEffect(() => {
    if (rec && recSec >= 20) talkRef.current(); // auto-send long recordings
  }, [rec, recSec]);

  // Keep the newest message in view, like a messaging app.
  useEffect(() => {
    if (msgs.length > count.current && count.current > 0) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    count.current = msgs.length;
  }, [msgs.length]);

  function setLang(l: Lang) {
    unlockAudio();
    setLangState(l);
    store("sombra-lang", l);
  }

  async function sendText(text: string, quick?: number) {
    if (!text.trim() || !plan) return;
    setAsk(false);
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId, crewId, workerId, lang, transcript: text, quick }),
      });
      if (!res.ok) return;
      sent();
      const m = (await res.json()) as RadioMessage;
      seen.current.add(m.id);
      setMsgs((x) => [...x, m]);
      setTyped("");
      if (m.intent === "health" || m.autoReply) speakAny(m.autoReply?.[lang] ?? (m.triage ? t.reply[m.triage.label] : t.sent), lang);
    } finally {
      setBusy(false);
    }
  }

  async function talk() {
    unlockAudio();
    setNote("");
    if (rec) {
      // Second tap: stop, transcribe, send.
      setRec(null);
      setBusy(true);
      try {
        const audio = await rec.stop();
        const form = new FormData();
        form.append("audio", audio);
        const r = await fetch("/api/transcribe", { method: "POST", body: form }).then((x) => x.json());
        if (r.text) await sendText(r.text);
        else setNote(t.heard);
      } catch {
        setNote(t.heard);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (whisper) {
      try {
        setRec(await startRecording());
      } catch (err) {
        setNote(err instanceof Error && err.name === "NotAllowedError" ? t.micBlocked : t.heard);
      }
      return;
    }
    // No server transcription configured: the browser's own recognition.
    setBusy(true);
    try {
      await sendText(await listen(lang));
    } catch {
      setNote(t.heard);
    } finally {
      setBusy(false);
    }
  }

  talkRef.current = talk;
  const clock = now;
  if (missing) return <main className="p-6 text-xl">{t.waiting}</main>;
  if (!plan) return <main className="p-6 text-xl">{t.loading}</main>;

  const mine = plan.crews.find((c) => c.crewId === crewId) ?? plan.crews[0];
  const info = plan.crewInfo?.find((c) => c.id === mine?.crewId);
  const rate = info?.pieceRateUsdPerHour ?? 22;
  const own = plan.crewBriefings?.[mine?.crewId ?? ""];
  const briefing = own?.[lang] ?? own?.en ?? plan.briefings[lang] ?? plan.briefings.en ?? "";
  const canTalk = whisper || canListen();

  return (
    <main className="phone mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-16 pt-5 text-[var(--ink)]" onClick={() => {
        unlockAudio();
        if (!armed) setArmed(true);
      }}>
      {takeover && (
        <div className="alert-banner fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[#b3261e] p-8 text-center text-white">
          <p className="text-sm font-bold tracking-[0.3em]">{t.alertTitle}</p>
          <p className="font-display text-4xl leading-tight">{takeover.text[lang]}</p>
          <p className="text-sm opacity-80">{time(takeover.at)}</p>
          <button onClick={() => setTakeover(null)} className="w-full rounded-2xl bg-white py-5 text-xl font-bold text-[#b3261e]">
            {t.safe}
          </button>
        </div>
      )}

      {notice && (
        <button onClick={() => setNotice(false)} className="rounded-xl bg-[#2f6f8f] px-4 py-3 text-left text-white">
          {t.newPlan} ✕
        </button>
      )}

      {!armed && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            unlockAudio();
            setArmed(true);
            setTimeout(chime, 350); // test sound so the worker knows alerts are on
          }}
          className="rounded-xl bg-[var(--ink)] px-4 py-3 text-left text-sm text-[var(--bg)]">
          {t.enable}
        </button>
      )}

      <header className="phone-hero flex flex-col gap-4">
        <div className="flex items-center justify-between">
        <span className="font-display text-3xl">Sombra</span>
        <div className="flex rounded-full border border-[rgba(253,251,239,0.3)] p-1">
          {LANGS.map((l) => (
            <button key={l.id} onClick={() => setLang(l.id)} className={`rounded-full px-3 py-2 text-sm ${lang === l.id ? "bg-[var(--brand-ink)] text-[var(--brand)]" : "text-[var(--brand-ink)]"}`}>
              {l.label}
            </button>
          ))}
        </div>
        </div>
        <p className="gold font-label text-xs">{plan.date}{plan.smoke ? " · smoke drill" : ""} · {plan.crewInfo?.find((c) => c.id === mine?.crewId)?.name ?? ""}</p>
      </header>

      {plan.crews.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-[var(--muted)]">{t.crew}:</span>
          {plan.crews.map((c) => (
            <button
              key={c.crewId}
              onClick={() => {
                setCrewId(c.crewId);
                store(`sombra-crew-${planId}`, c.crewId);
                seen.current.clear();
                loaded.current = false;
              }}
              className={`rounded-full border px-3 py-1.5 ${c.crewId === mine?.crewId ? "border-[var(--ink)] bg-[var(--card)] font-medium" : "border-[var(--line)]"}`}
            >
              {plan.crewInfo?.find((x) => x.id === c.crewId)?.name ?? c.crewId}
            </button>
          ))}
        </div>
      )}

      <section className="rounded-2xl bg-[var(--card)] p-5">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-4xl leading-none">{t.today}</h1>
          <button onClick={() => speakAny(briefing, lang)} className="rounded-full bg-[var(--gold)] px-5 py-3 text-lg font-medium text-white">
            ▶ {t.listen}
          </button>
        </div>
        {(() => {
          // Past days (replays) show the day at 10:50am, labeled as an example time; live days use the real clock.
          const now = plan.mode === "replay" ? 10 * 60 + 50 : clock;
          const cur = mine?.blocks.find((b) => now >= toMin(b.start) && now < toMin(b.end));
          const next = mine?.blocks.find((b) => toMin(b.start) > now);
          const pay = (b: typeof cur) => (b && b.kind === "cooldown" ? ` +$${(((toMin(b.end) - toMin(b.start)) / 60) * rate).toFixed(2)}` : "");
          const mins = next ? toMin(next.start) - now : 0;
          return (
            <div className="mt-3 rounded-xl bg-[var(--ink)] p-4 text-[var(--bg)]">
              {plan.mode === "replay" && <p className="mb-1 text-xs opacity-70">{plan.date} · 10:50am (example time)</p>}
              {cur || next ? (
                <>
                  {cur && (
                    <p className="text-2xl font-medium leading-tight">
                      {t.nowL}: {t[cur.kind]} {t.untilL} {ampm(cur.end)}
                      {pay(cur)}
                    </p>
                  )}
                  {next && (
                    <p className={cur ? "mt-1 text-lg opacity-80" : "text-2xl font-medium leading-tight"}>
                      {t.nextL}: {t[next.kind]}
                      {pay(next)} {t.inL} {mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xl font-medium">{t.doneL}</p>
              )}
            </div>
          );
        })()}
        <p className="mt-3 text-lg leading-snug">{briefing}</p>
        <ol className="mt-4 flex flex-col">
          {mine?.blocks.map((b, i) => {
            const active = now >= toMin(b.start) && now < toMin(b.end);
            const pay = b.kind === "cooldown" ? ((toMin(b.end) - toMin(b.start)) / 60) * rate : 0;
            return (
              <li key={i} className={`flex items-baseline justify-between gap-3 border-t border-[var(--line)] py-3 ${active ? "-mx-2 rounded-lg bg-[var(--track)] px-2" : ""}`}>
                <span className="text-lg tabular-nums">
                  {ampm(b.start)} – {ampm(b.end)}
                </span>
                <span className={`text-right text-lg ${b.kind === "cooldown" ? "font-medium text-[#2f6f8f]" : ""}`}>
                  {t[b.kind]}
                  {b.kind === "cooldown" && <span className="block text-sm">+${pay.toFixed(2)}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="flex flex-col items-center gap-3 rounded-2xl bg-[var(--card)] p-5 text-center">
        {ask && <p className="w-full rounded-xl bg-[#2f6f8f] px-4 py-3 text-lg font-medium text-white">{t.coolAsk}</p>}
        <h2 className="font-display text-3xl">{t.ask}</h2>
        <p className="-mt-2 text-sm text-[var(--muted)]">{t.hint}</p>
        {canTalk && (
          <button ref={micRef} onClick={talk} disabled={busy} className={`mic h-36 w-36 rounded-full text-lg font-medium text-white disabled:opacity-60 ${rec ? "is-listening" : ""}`}>
            {busy ? t.sending : rec ? (
              <>
                {t.stop}
                <span className="mt-1 block font-mono text-sm">● {recSec} {t.secs}</span>
              </>
            ) : (
              t.tap
            )}
          </button>
        )}
        {note && <p className="text-sm text-[#b3261e]">{note}</p>}
        <div className="grid w-full grid-cols-3 gap-2">
          {t.quick.map((q, i) => (
            <button
              key={q}
              onClick={() => sendText(q, i)}
              disabled={busy}
              className={`rounded-xl px-2 py-3 text-base font-medium leading-tight disabled:opacity-60 ${i === 2 ? "bg-[#c85f22] text-white" : i === 1 ? "bg-[#2f6f8f] text-white" : "bg-[#3f6b3a] text-white"}`}
            >
              {q}
            </button>
          ))}
        </div>
        <p className="text-xs leading-snug text-[var(--muted)]">{t.voiceNote}</p>
        <form
          className="flex w-full gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            sendText(typed);
          }}
        >
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={t.type} className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-transparent px-3 py-3 text-lg" />
          <button disabled={busy} className="rounded-xl bg-[var(--ink)] px-4 text-[var(--bg)] disabled:opacity-60">
            {t.send}
          </button>
        </form>
      </section>

      <section className="chat-bg rounded-2xl p-5">
        <h2 className="font-display text-2xl">{t.thread}</h2>
        {msgs.length === 0 ? (
          <p className="mt-2 text-[var(--muted)]">{t.none}</p>
        ) : (
          <ol className="mt-3 flex flex-col gap-3">
            {msgs.map((m, i) =>
              m.from === "boss" ? (
                <li key={m.id} className={`mr-10 rounded-2xl rounded-bl-sm p-3 shadow-[0_1px_0_rgba(0,0,0,0.08)] ${m.kind === "alert" ? "bg-[#b3261e] text-white" : m.kind === "checkin" ? "bg-[#2f6f8f] text-white" : "bg-[var(--card)]"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-lg leading-snug">{m.text[lang]}</p>
                    <button onClick={() => speakAny(m.text[lang], lang)} className="shrink-0 rounded-full border border-current px-3 py-1.5" aria-label={t.listen}>
                      ▶
                    </button>
                  </div>
                  <p className="mt-1 text-xs opacity-70">
                    {t.boss} · {time(m.at)}
                  </p>
                </li>
              ) : (
                <li key={m.id} className="flex flex-col items-end gap-1">
                  <div className="ml-10 rounded-2xl rounded-br-sm bg-[var(--brand)] px-3 py-2 text-[var(--brand-ink)]">
                    <p className="text-lg leading-snug">{m.text[lang] || m.original}</p>
                    {m.original && m.original !== m.text[lang] && <p className="mt-0.5 text-xs opacity-75">{m.original}</p>}
                  </div>
                  {m.intent === "other" && !m.autoReply ? (
                    <p className="text-xs text-[var(--muted)]">✓ {t.sent.split(".")[0]}</p>
                  ) : !msgs.slice(i + 1).some((x) => x.from === "boss") && <p
                    className="mr-10 self-start rounded-2xl rounded-bl-sm px-3 py-2 text-sm font-medium text-white"
                    style={{ background: m.intent === "health" && m.triage ? TONE[m.triage.label] : "#6f665b" }}
                  >
                    {m.autoReply?.[lang] ?? (m.intent === "health" && m.triage ? t.reply[m.triage.label] : t.sent)}
                  </p>}
                  {m.triage?.label === "emergency" && (
                    <a href="tel:911" className="mt-2 block rounded-lg bg-[#b3261e] py-3 text-center text-lg font-bold text-white">
                      911
                    </a>
                  )}
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {t.you} · {time(m.at)}
                  </p>
                </li>
              ),
            )}
          </ol>
        )}
        <div ref={endRef} />
      </section>
      <a href="/privacy" className="text-center text-sm text-[var(--muted)] underline">
        {t.privacy}
      </a>
    </main>
  );
}
