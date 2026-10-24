// Plan + check-in storage. In-memory for now (works on `next dev` and a single Vercel instance);
// swap the bodies for Upstash Redis before the final deploy. Keep the function signatures.
import "server-only";
import type { CheckIn, ShiftPlan } from "./types";

const g = globalThis as unknown as { __sombra?: { plans: Map<string, ShiftPlan>; checkins: CheckIn[] } };
const db = (g.__sombra ??= { plans: new Map<string, ShiftPlan>(), checkins: [] as CheckIn[] });

export async function savePlan(plan: ShiftPlan): Promise<void> {
  db.plans.set(plan.id, plan);
}

export async function getPlan(id: string): Promise<ShiftPlan | null> {
  return db.plans.get(id) ?? null;
}

export async function addCheckIn(c: CheckIn): Promise<void> {
  db.checkins.push(c);
}

export async function listCheckIns(planId: string): Promise<CheckIn[]> {
  return db.checkins.filter((c) => c.planId === planId);
}
