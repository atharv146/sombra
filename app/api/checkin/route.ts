import { addMessage } from "@/lib/store";
import { understand } from "@/lib/translate";
import { classify } from "@/lib/triage";
import type { RadioMessage } from "@/lib/types";

// A worker message to their crew boss: our model triages it, the AI routes and translates it.
export async function POST(request: Request) {
  const b = (await request.json()) as { planId: string; crewId: string; workerId: string; lang: string; transcript: string };
  const said = b.transcript?.trim().slice(0, 500);
  if (!said) return Response.json({ error: "Empty message" }, { status: 400 });
  const triage = classify(said);
  const { intent, text } = await understand(said);
  const msg: RadioMessage = {
    id: Math.random().toString(36).slice(2, 10),
    planId: b.planId,
    from: "worker",
    crewId: b.crewId,
    workerId: b.workerId.slice(0, 12),
    lang: b.lang,
    original: said,
    text,
    kind: "chat",
    // Our model always runs; anything it flags counts as health even if the router missed it.
    intent: triage.label !== "ok" ? "health" : intent,
    triage,
    at: new Date().toISOString(),
  };
  await addMessage(msg);
  return Response.json(msg);
}
