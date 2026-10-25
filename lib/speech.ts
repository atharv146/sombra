// Browser speech: read aloud (speechSynthesis) and listen (Web Speech recognition). Client-only.
import type { Lang } from "./types";

export const LOCALE: Record<Lang, string> = { es: "es-US", pa: "pa-IN", en: "en-US" };

export function voiceFor(lang: Lang): SpeechSynthesisVoice | undefined {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return undefined;
  const voices = window.speechSynthesis.getVoices();
  const prefix = lang === "es" ? "es" : lang === "pa" ? "pa" : "en";
  return (
    voices.find((v) => v.lang.replace("_", "-").toLowerCase() === LOCALE[lang].toLowerCase()) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(prefix))
  );
}

export function speak(text: string, lang: Lang) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = LOCALE[lang];
  const v = voiceFor(lang);
  if (v) u.voice = v;
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
}

type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: (e: { results: { 0: { transcript: string } }[] }) => void;
  onerror: (e: { error: string }) => void;
  onend: () => void;
  start: () => void;
};

export function canListen(): boolean {
  return typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
}

export function listen(lang: Lang): Promise<string> {
  return new Promise((resolve, reject) => {
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return reject(new Error("unsupported"));
    const r = new Ctor();
    r.lang = LOCALE[lang];
    r.interimResults = false;
    r.maxAlternatives = 1;
    let heard = "";
    r.onresult = (e) => (heard = e.results[0][0].transcript);
    r.onerror = (e) => reject(new Error(e.error));
    r.onend = () => (heard ? resolve(heard) : reject(new Error("no-speech")));
    r.start();
  });
}

// Read aloud in any language: the phone's own voice if it has one, otherwise server audio (/api/tts).
let player: HTMLAudioElement | null = null;
export function speakAny(text: string, lang: string) {
  if (!text) return;
  const l = (["es", "pa", "en"].includes(lang) ? lang : "en") as Lang;
  if (l !== "pa" && voiceFor(l)) return speak(text, l);
  window.speechSynthesis?.cancel();
  player?.pause();
  player = new Audio(`/api/tts?lang=${l}&text=${encodeURIComponent(text)}`);
  void player.play().catch(() => {});
}

// Push-to-talk recording for server transcription (Whisper). Call stop() to get the audio.
export async function startRecording(): Promise<{ stop: () => Promise<Blob>; level: () => number }> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  // Live input level (0..1) for the mic ring.
  let level = () => 0;
  try {
    const ac = new AudioContext();
    const an = ac.createAnalyser();
    an.fftSize = 512;
    ac.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(an.fftSize);
    level = () => {
      an.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += ((v - 128) / 128) ** 2;
      return Math.min(1, Math.sqrt(sum / buf.length) * 4);
    };
  } catch {}
  const type = ["audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
  const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.start();
  return {
    level: () => level(),
    stop: () =>
      new Promise((resolve) => {
        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          resolve(new Blob(chunks, { type: rec.mimeType }));
        };
        rec.stop();
      }),
  };
}
