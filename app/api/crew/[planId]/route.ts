import { getPlan } from "@/lib/store";

export async function GET(_req: Request, ctx: RouteContext<"/api/crew/[planId]">) {
  const { planId } = await ctx.params;
  const plan = await getPlan(planId);
  return plan ? Response.json(plan) : Response.json({ error: "Plan not found" }, { status: 404 });
}
