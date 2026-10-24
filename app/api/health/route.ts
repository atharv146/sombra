import { networkInterfaces } from "node:os";

// Setup check for the Worker phones panel: is storage shared with phones, which AI providers have keys,
// and the laptop's Wi-Fi address (so phones on the same network can reach a local dev server).
export async function GET() {
  const keys = (v?: string) => (v ?? "").split(/[\s,]+/).filter(Boolean).length;
  const lan = Object.values(networkInterfaces())
    .flat()
    .find((n) => n && n.family === "IPv4" && !n.internal && /^(192\.168|10\.|172\.)/.test(n.address))?.address;
  return Response.json({
    shared: !!(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL),
    provider: process.env.LLM_PROVIDER ?? null,
    openrouterKeys: keys(process.env.OPENROUTER_API_KEYS || process.env.OPENROUTER_API_KEY),
    groq: keys(process.env.GROQ_API_KEY) > 0,
    lan: process.env.VERCEL ? null : (lan ?? null),
  });
}
