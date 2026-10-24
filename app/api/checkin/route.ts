import { addCheckIn } from "@/lib/store";
import { translateAll } from "@/lib/translate";
import { classify } from "@/lib/triage";
import type { CheckIn, Lang } from "@/lib/types";

// A worker's spoken check-in: our model triages it, the boss gets it in English.
export async function POST(request: Request) {
  const b = (await request.json()) as { planId: string; crewId: string; workerId: string; lang: Lang; transcript: string };
  if (!b.transcript?.trim()) return Response.json({ error: "Empty check-in" }, { status: 400 });
  const triage = classify(b.transcript);
  const english = b.lang === "en" ? b.transcript : (await translateAll(b.transcript, b.lang)).en;
  const checkIn: CheckIn = {
    id: Math.random().toString(36).slice(2, 10),
    planId: b.planId,
    crewId: b.crewId,
    workerId: b.workerId.slice(0, 12),
    lang: b.lang,
    transcript: b.transcript.slice(0, 500),
    english,
    triage,
    at: new Date().toISOString(),
  };
  await addCheckIn(checkIn);
  return Response.json(checkIn);
}
