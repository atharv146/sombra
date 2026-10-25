import { networkInterfaces } from "node:os";
import { envKeys } from "@/lib/llm";

// Setup check for the Worker phones panel: is storage shared with phones, which AI providers have keys,
// and the laptop's Wi-Fi address (so phones on the same network can reach a local dev server).
export async function GET() {
  const count = (name: string, prefix: string) => envKeys(name, prefix).length;
  const lan = Object.values(networkInterfaces())
    .flat()
    .find((n) => n && n.family === "IPv4" && !n.internal && /^(192\.168|10\.|172\.)/.test(n.address))?.address;
  return Response.json({
    shared: !!(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL),
    provider: process.env.LLM_PROVIDER ?? null,
    openrouterKeys: count("OPENROUTER", "sk-or-"),
    groqKeys: count("GROQ", "gsk_"),
    groq: count("GROQ", "gsk_") > 0,
    keyNames: Object.keys(process.env).filter((k) => /ROUTER|GROQ/i.test(k)), // names only, never values
    // first 6 characters of each value, to spot a key pasted in the wrong place (never the whole key)
    keyShapes: Object.entries(process.env).filter(([k]) => /ROUTER|GROQ/i.test(k)).map(([k, v]) => `${k}: ${(v ?? "").replace(/["'\s]/g, "").slice(0, 6)}…`),
    lan: process.env.VERCEL ? null : (lan ?? null),
  });
}
