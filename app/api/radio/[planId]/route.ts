import { addMessage, listMessages } from "@/lib/store";
import { translateAll } from "@/lib/translate";
import type { Lang, RadioMessage } from "@/lib/types";

export async function GET(_req: Request, ctx: RouteContext<"/api/radio/[planId]">) {
  const { planId } = await ctx.params;
  return Response.json(await listMessages(planId), { headers: { "cache-control": "no-store" } });
}

// The crew boss sends a message; it's stored in Spanish, Punjabi and English.
export async function POST(request: Request, ctx: RouteContext<"/api/radio/[planId]">) {
  const { planId } = await ctx.params;
  const b = (await request.json()) as { text?: string; lang?: Lang; crewId?: string; kind?: "chat" | "alert" };
  const kind = b.kind === "alert" ? "alert" : "chat";
  if (kind === "alert" && !b.text?.trim()) b.text = "HEAT ALERT: Stop work now. Go to the shade and drink water. Tell your crew boss if anyone feels sick.";
  if (!b.text?.trim()) return Response.json({ error: "Empty message" }, { status: 400 });
  const lang = b.lang ?? "en";
  const msg: RadioMessage = {
    id: Math.random().toString(36).slice(2, 10),
    planId,
    from: "boss",
    crewId: b.crewId,
    lang,
    kind,
    text: await translateAll(b.text.slice(0, 500), lang),
    at: new Date().toISOString(),
  };
  await addMessage(msg);
  return Response.json(msg);
}
