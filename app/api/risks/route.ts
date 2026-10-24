import fields from "@/data/fields.json";
import { fetchRisks, REPLAY_DATE } from "@/lib/weather";
import type { Field } from "@/lib/types";

// Weather + heat bands for the map before any agents run (no AI calls).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "live" ? "live" : "replay";
  const date = mode === "replay" ? REPLAY_DATE : (url.searchParams.get("date") ?? REPLAY_DATE);
  try {
    return Response.json(await fetchRisks(fields as Field[], mode, date));
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
