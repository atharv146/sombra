// One entry point for every model call. Server-only: never import from a client component.
import "server-only";

type Provider = "claude" | "gemini" | "openrouter" | "groq";

export interface LLMRequest {
  system: string;
  prompt: string;
  maxTokens?: number;
  json?: boolean; // ask for a single JSON object back
  model?: string;
}

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

// OpenAI-compatible providers: same request shape, different base URL, key and model.
const COMPAT = {
  openrouter: {
    url: "https://openrouter.ai/api/v1/chat/completions",
    key: () => process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-ultra-550b-a55b:free",
    // Tried in order if the first is rate-limited (free models share upstream pools).
    fallbacks: ["nvidia/nemotron-3.5-lightning:free", "google/gemma-4-31b-it:free"],
  },
  groq: {
    url: "https://api.groq.com/openai/v1/chat/completions",
    key: () => process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
    fallbacks: [] as string[],
  },
};

// LLM_PROVIDER picks the provider: claude | gemini | openrouter | groq.
function provider(): Provider {
  const p = process.env.LLM_PROVIDER as Provider | undefined;
  if (p && ["claude", "gemini", "openrouter", "groq"].includes(p)) return p;
  return process.env.ANTHROPIC_API_KEY ? "claude" : "gemini";
}

export function modelName(): string {
  const p = provider();
  if (p === "claude") return CLAUDE_MODEL;
  if (p === "gemini") return GEMINI_MODEL;
  return COMPAT[p].model;
}

// Reads an SSE response body and yields each `data:` payload as parsed JSON.
async function* sseJSON(body: ReadableStream) {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const l = line.trim();
      if (l.startsWith("data: ") && l !== "data: [DONE]") yield JSON.parse(l.slice(6));
    }
  }
}

// Fails fast instead of hanging: 15s to get response headers, 60s for the whole reply.
function timedFetch(url: string, init: RequestInit) {
  const ac = new AbortController();
  const hard = setTimeout(() => ac.abort(new Error("Model timed out")), 60_000);
  const first = setTimeout(() => ac.abort(new Error("Model didn't respond in 15s")), 15_000);
  return {
    res: fetch(url, { ...init, signal: ac.signal }).finally(() => clearTimeout(first)),
    done: () => clearTimeout(hard),
  };
}

// After a failure, skip the model for 2 minutes so every agent falls back instantly instead of each timing out.
let downUntil = 0;

export async function* streamModel(req: LLMRequest): AsyncGenerator<string> {
  if (Date.now() < downUntil) throw new Error("Model marked down after a recent failure");
  try {
    yield* streamProvider(req);
  } catch (err) {
    // Trip only on API errors (rate limits, auth, outages), not on one slow answer.
    if (!(err instanceof Error && /timed out|didn't respond|abort/i.test(err.message + String(err.cause ?? "")))) downUntil = Date.now() + 120_000;
    throw err;
  }
}

// Streams text chunks from whichever provider is configured.
async function* streamProvider(req: LLMRequest): AsyncGenerator<string> {
  const system = req.json ? `${req.system}\nRespond with one JSON object only, no prose, no code fences.` : req.system;
  const p = provider();
  if (p === "openrouter" || p === "groq") {
    const cfg = COMPAT[p];
    const call = timedFetch(cfg.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${cfg.key()}`,
        "x-title": "Sombra",
      },
      body: JSON.stringify({
        model: req.model || cfg.model,
        // Thinking off: 5s answers instead of 30-60s, and the agents' prompts are narrow enough not to need it.
        ...(p === "openrouter" ? { models: [req.model || cfg.model, ...cfg.fallbacks], reasoning: { enabled: false } } : {}),
        max_tokens: Math.max(req.maxTokens ?? 1024, 1500), // reasoning models spend part of the budget thinking
        stream: true,
        messages: [
          { role: "system", content: system },
          { role: "user", content: req.prompt },
        ],
      }),
    });
    try {
      const res = await call.res;
      if (!res.ok || !res.body) throw new Error(`${p} ${res.status}: ${await res.text()}`);
      for await (const evt of sseJSON(res.body)) {
        if (evt.error) throw new Error(`${p}: ${evt.error.message ?? "stream error"}`);
        const text = evt.choices?.[0]?.delta?.content;
        if (text) yield text;
      }
    } finally {
      call.done();
    }
    return;
  }
  if (p === "claude") {
    const call = timedFetch("https://api.anthropic.com/v1/messages", {
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
    try {
      const res = await call.res;
      if (!res.ok || !res.body) throw new Error(`Claude ${res.status}: ${await res.text()}`);
      for await (const evt of sseJSON(res.body)) {
        if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") yield evt.delta.text;
      }
    } finally {
      call.done();
    }
    return;
  }

  const call = timedFetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${req.model || GEMINI_MODEL}:streamGenerateContent?alt=sse`,
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
  try {
    const res = await call.res;
    if (!res.ok || !res.body) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
    for await (const evt of sseJSON(res.body)) {
      const parts: { text?: string; thought?: boolean }[] = evt.candidates?.[0]?.content?.parts ?? [];
      const text = parts.filter((p) => !p.thought).map((p) => p.text ?? "").join("");
      if (text) yield text;
    }
  } finally {
    call.done();
  }
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
