import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { savePlan } from "@/lib/store";
import type { AgentEvent, ShiftPlan } from "@/lib/types";

// record: save a real run to public/demo/run.json (local dev only).
// restore: put a replayed plan back in the store so its QR link works.
export async function POST(request: Request) {
  const body = (await request.json()) as
    | { kind: "record"; events: { at: number; e: AgentEvent }[] }
    | { kind: "restore"; plan: ShiftPlan };

  if (body.kind === "restore") {
    await savePlan(body.plan);
    return Response.json({ ok: true });
  }
  if (process.env.NODE_ENV !== "development") return Response.json({ error: "Recording only works locally" }, { status: 403 });
  const dir = path.join(process.cwd(), "public/demo");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "run.json"), JSON.stringify(body.events));
  return Response.json({ ok: true, events: body.events.length });
}
