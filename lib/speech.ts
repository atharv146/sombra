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
