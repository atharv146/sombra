import { endActivePlan, getPlan } from "@/lib/store";

export async function GET(_req: Request, ctx: RouteContext<"/api/crew/[planId]">) {
  const { planId } = await ctx.params;
  const plan = await getPlan(planId);
  return plan ? Response.json(plan) : Response.json({ error: "Plan not found" }, { status: 404 });
}

// DELETE /api/crew/latest ends the active plan (the boss's "End day" button).
export async function DELETE(_req: Request, ctx: RouteContext<"/api/crew/[planId]">) {
  const { planId } = await ctx.params;
  if (planId !== "latest") return Response.json({ error: "Only the active plan can be ended" }, { status: 400 });
  await endActivePlan();
  return Response.json({ ok: true });
}
