// Plan + check-in storage. Uses Upstash Redis over REST when its env vars exist (Vercel → Storage → Upstash),
// otherwise in-memory, which is fine for `next dev` on one machine.
import "server-only";
import type { CheckIn, RadioMessage, ShiftPlan } from "./types";

const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const TTL = 60 * 60 * 24 * 2; // plans and check-ins expire after 2 days: no long-term worker data

async function redis<T>(...cmd: (string | number)[]): Promise<T> {
  const res = await fetch(URL!, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Redis ${res.status}`);
  return (await res.json()).result as T;
}

const g = globalThis as unknown as { __sombra?: { plans: Map<string, ShiftPlan>; checkins: CheckIn[] } };
const mem = (g.__sombra ??= { plans: new Map<string, ShiftPlan>(), checkins: [] as CheckIn[] });

// Every saved plan also becomes "latest", so a phone can open /crew/latest without scanning a QR code.
export async function savePlan(plan: ShiftPlan): Promise<void> {
  if (URL) {
    await redis("SET", `plan:${plan.id}`, JSON.stringify(plan), "EX", TTL);
    await redis("SET", "plan:latest", plan.id, "EX", TTL);
  } else {
    mem.plans.set(plan.id, plan);
    mem.plans.set("latest", plan);
  }
}

export async function getPlan(id: string): Promise<ShiftPlan | null> {
  if (!URL) return mem.plans.get(id) ?? null;
  const key = id === "latest" ? await redis<string | null>("GET", "plan:latest") : id;
  if (!key) return null;
  const raw = await redis<string | null>("GET", `plan:${key}`);
  return raw ? (JSON.parse(raw) as ShiftPlan) : null;
}

export async function addCheckIn(c: CheckIn): Promise<void> {
  if (!URL) {
    mem.checkins.push(c);
    return;
  }
  await redis("RPUSH", `checkins:${c.planId}`, JSON.stringify(c));
  await redis("EXPIRE", `checkins:${c.planId}`, TTL);
}

export async function listCheckIns(planId: string): Promise<CheckIn[]> {
  if (!URL) return mem.checkins.filter((c) => c.planId === planId);
  const raw = await redis<string[]>("LRANGE", `checkins:${planId}`, 0, -1);
  return raw.map((r) => JSON.parse(r) as CheckIn);
}

const memRadio: RadioMessage[] = ((globalThis as unknown as { __sombraRadio?: RadioMessage[] }).__sombraRadio ??= []);

export async function addMessage(m: RadioMessage): Promise<void> {
  if (!URL) {
    memRadio.push(m);
    return;
  }
  await redis("RPUSH", `radio:${m.planId}`, JSON.stringify(m));
  await redis("EXPIRE", `radio:${m.planId}`, TTL);
}

export async function listMessages(planId: string): Promise<RadioMessage[]> {
  if (!URL) return memRadio.filter((m) => m.planId === planId);
  const raw = await redis<string[]>("LRANGE", `radio:${planId}`, 0, -1);
  return raw.map((r) => JSON.parse(r) as RadioMessage);
}
