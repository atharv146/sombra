import { listCheckIns } from "@/lib/store";

// The command center polls this for worker check-ins on a plan.
export async function GET(_req: Request, ctx: RouteContext<"/api/alerts/[planId]">) {
  const { planId } = await ctx.params;
  return Response.json(await listCheckIns(planId), { headers: { "cache-control": "no-store" } });
}
