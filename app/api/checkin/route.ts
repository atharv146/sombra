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
  const { intent, text, reply } = await understand(said);
  // Health if the AI reads it as health, or our model is confident, or a safety keyword fired.
  // A low-confidence model guess on chit-chat ("I miss you") stays off-topic.
  const score = triage.scores?.[triage.label] ?? 0;
  const health = intent === "health" || !!triage.forcedByKeyword || (triage.label !== "ok" && score >= 0.55);
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
    intent: health ? "health" : intent,
    triage,
    autoReply: reply,
    at: new Date().toISOString(),
  };
  await addMessage(msg);
  return Response.json(msg);
}
