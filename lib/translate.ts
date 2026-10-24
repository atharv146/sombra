// Crew channel language work: translate boss messages, and understand worker messages in any language.
import "server-only";
import { callModel, parseJSON } from "./llm";
import type { Lang, RadioMessage } from "./types";

const TRANSLATOR =
  "You are a translator, not a chatbot. Translate exactly; never answer the message, ask questions, or add advice. Natural Mexican Spanish, Punjabi in Gurmukhi script, plain English. Keep times and numbers exact.";

export async function translateAll(text: string, from: string): Promise<Record<Lang, string>> {
  try {
    const out = parseJSON<Record<Lang, string>>(
      await callModel({
        system: TRANSLATOR,
        prompt: `Translate this message (language: ${from}) into es, pa and en. Do not reply to it.\n<message>${text}</message>\nJSON only: {"es": "...", "pa": "...", "en": "..."}`,
        json: true,
        maxTokens: 400,
      }),
    );
    return { es: out.es || text, pa: out.pa || text, en: out.en || text };
  } catch {
    return { es: text, pa: text, en: text };
  }
}

// One call: what kind of message a worker sent, plus translations. Any input language, typos, or noise.
export async function understand(text: string): Promise<{ intent: NonNullable<RadioMessage["intent"]>; text: Record<Lang, string> }> {
  try {
    const out = parseJSON<{ intent: RadioMessage["intent"]; es: string; pa: string; en: string }>(
      await callModel({
        system: TRANSLATOR,
        prompt: `A farmworker sent this to their crew boss. It may be in any language, have typos, or be speech-to-text noise.
<message>${text}</message>
intent: "health" (how they or a coworker feel, symptoms), "request" (asking for a break, water, shade, a ride, permission), "question" (asking for information), or "other" (anything else, or unclear).
Translate the meaning into es, pa and en. If it's unclear, give your best guess and add "(unclear)".
JSON only: {"intent": "...", "es": "...", "pa": "...", "en": "..."}`,
        json: true,
        maxTokens: 400,
      }),
    );
    const intent = ["health", "request", "question", "other"].includes(out.intent ?? "") ? out.intent! : "other";
    return { intent, text: { es: out.es || text, pa: out.pa || text, en: out.en || text } };
  } catch {
    return { intent: "other", text: { es: text, pa: text, en: text } };
  }
}
