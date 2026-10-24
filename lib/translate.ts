// Crew radio translation: one model call returns Spanish, Punjabi and English.
import "server-only";
import { callModel, parseJSON } from "./llm";
import type { Lang } from "./types";

export async function translateAll(text: string, from: Lang): Promise<Record<Lang, string>> {
  try {
    const out = parseJSON<Record<Lang, string>>(
      await callModel({
        system:
          "You are a translator, not a chatbot. Translate the message exactly; never answer it, ask questions, or add advice. Natural Mexican Spanish, Punjabi in Gurmukhi script, plain English. Keep times and numbers exact.",
        prompt: `Translate this message (language: ${from}) into es, pa and en. Do not reply to it.\n<message>${text}</message>\nJSON only: {"es": "...", "pa": "...", "en": "..."}`,
        json: true,
        maxTokens: 400,
      }),
    );
    return { es: out.es || text, pa: out.pa || text, en: out.en || text, [from]: text };
  } catch {
    return { es: text, pa: text, en: text };
  }
}
