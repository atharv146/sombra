import fields from "@/data/fields.json";
import { fetchRisks, REPLAY_DATE } from "@/lib/weather";
import { SCENARIOS } from "@/lib/scenarios";
import type { Field } from "@/lib/types";

// Weather + heat bands for the map before any agents run (no AI calls).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const s = SCENARIOS.find((x) => x.id === url.searchParams.get("scenario")) ?? SCENARIOS[0];
  const mode = s.date ? "replay" : "live";
  const date = s.date ?? url.searchParams.get("date") ?? REPLAY_DATE;
  try {
    return Response.json(await fetchRisks(fields as Field[], mode, date, s.smokeAqi));
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
