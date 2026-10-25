import { networkInterfaces } from "node:os";

// Setup check for the Worker phones panel: is storage shared with phones, which AI providers have keys,
// and the laptop's Wi-Fi address (so phones on the same network can reach a local dev server).
export async function GET() {
  const count = (name: string, prefix: string) =>
    new Set(Object.entries(process.env).filter(([k]) => k.toUpperCase().includes(name)).flatMap(([, v]) => (v ?? "").split(/[\s,]+/).filter((x) => x.startsWith(prefix)))).size;
  const lan = Object.values(networkInterfaces())
    .flat()
    .find((n) => n && n.family === "IPv4" && !n.internal && /^(192\.168|10\.|172\.)/.test(n.address))?.address;
  return Response.json({
    shared: !!(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL),
    provider: process.env.LLM_PROVIDER ?? null,
    openrouterKeys: count("OPENROUTER", "sk-or-"),
    groqKeys: count("GROQ", "gsk_"),
    groq: count("GROQ", "gsk_") > 0,
    keyNames: Object.keys(process.env).filter((k) => /OPENROUTER|GROQ/i.test(k)), // names only, never values
    lan: process.env.VERCEL ? null : (lan ?? null),
  });
}
