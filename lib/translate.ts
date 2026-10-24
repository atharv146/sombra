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

// One call: what kind of message a worker sent, translations, and an instant reply that addresses what they said.
export async function understand(text: string): Promise<{
  intent: NonNullable<RadioMessage["intent"]>;
  text: Record<Lang, string>;
  reply?: Record<Lang, string>;
}> {
  try {
    const out = parseJSON<{ intent: RadioMessage["intent"]; es: string; pa: string; en: string; reply?: Record<Lang, string> }>(
      await callModel({
        system:
          "You help farmworkers talk to their crew boss on a heat-safety app. You translate faithfully and write short, specific, kind replies. Never invent the boss's decision. Natural Mexican Spanish, Punjabi in Gurmukhi script, plain English.",
        prompt: `A farmworker sent this to their crew boss. It may be in any language, have typos, or be speech-to-text noise.
<message>${text}</message>
1. intent: "health" (how they or a coworker feel physically, symptoms), "request" (break, water, shade, ride, leave early, permission), "question" (asking for information), or "other" (personal, chit-chat, jokes, off-topic, unclear).
2. Translate the meaning into es, pa and en. If it's unclear, give your best guess and add "(unclear)".
3. reply: one or two short sentences from Sombra (not the boss) answering exactly what they said, in es, pa and en. Health: concrete first steps for THEIR symptoms, and say the boss was alerted. Request or question: say the boss has it and will answer here, plus what to do meanwhile if relevant. Other: a brief friendly acknowledgement. Never say the boss approved anything.
JSON only: {"intent": "...", "es": "...", "pa": "...", "en": "...", "reply": {"es": "...", "pa": "...", "en": "..."}}`,
        json: true,
        maxTokens: 700,
      }),
    );
    const intent = ["health", "request", "question", "other"].includes(out.intent ?? "") ? out.intent! : "other";
    const reply = out.reply?.en ? { es: out.reply.es || out.reply.en, pa: out.reply.pa || out.reply.en, en: out.reply.en } : undefined;
    return { intent, text: { es: out.es || text, pa: out.pa || text, en: out.en || text }, reply };
  } catch {
    return { intent: "other", text: { es: text, pa: text, en: text } };
  }
}
