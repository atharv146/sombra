import { medicOpinion } from "@/lib/medic";
import type { TriageLabel } from "@/lib/types";

export async function POST(request: Request) {
  const { transcript, label } = (await request.json()) as { transcript: string; label: TriageLabel };
  return Response.json(await medicOpinion(transcript, label));
}
