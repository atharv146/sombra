// One entry point for every model call. Server-only: never import from a client component.
import "server-only";

type Provider = "claude" | "gemini";

export interface LLMRequest {
  system: string;
  prompt: string;
  maxTokens?: number;
  json?: boolean; // ask for a single JSON object back
  model?: string;
}

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function provider(): Provider {
  if (process.env.LLM_PROVIDER === "gemini" || !process.env.ANTHROPIC_API_KEY) return "gemini";
  return "claude";
}

export function modelName(): string {
  return provider() === "claude" ? CLAUDE_MODEL : GEMINI_MODEL;
}

// Streams text chunks. Gemini is called non-streaming and yielded as one chunk.
export async function* streamModel(req: LLMRequest): AsyncGenerator<string> {
  const system = req.json ? `${req.system}\nRespond with one JSON object only, no prose, no code fences.` : req.system;
  if (provider() === "claude") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: req.model || CLAUDE_MODEL,
        max_tokens: req.maxTokens ?? 1024,
        system,
        stream: true,
        messages: [{ role: "user", content: req.prompt }],
      }),
    });
    if (!res.ok || !res.body) throw new Error(`Claude ${res.status}: ${await res.text()}`);
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const evt = JSON.parse(line.slice(6));
        if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") yield evt.delta.text;
      }
    }
    return;
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${req.model || GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: req.prompt }] }],
        generationConfig: {
          maxOutputTokens: req.maxTokens ?? 1024,
          ...(req.json ? { responseMimeType: "application/json" } : {}),
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  yield data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
}

export async function callModel(req: LLMRequest): Promise<string> {
  let out = "";
  for await (const chunk of streamModel(req)) out += chunk;
  return out;
}

// Pulls the first {...} block out of a reply, tolerating stray prose or fences.
export function parseJSON<T>(text: string): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return JSON.parse(text.slice(start, end + 1)) as T;
}
