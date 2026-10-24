import { runSwarm, type SwarmInput } from "@/lib/agents";
import fields from "@/data/fields.json";
import type { AgentEvent, Field } from "@/lib/types";

export const maxDuration = 120;

// POST a SwarmInput (fields optional), get the swarm back as Server-Sent Events.
export async function POST(request: Request) {
  const body = (await request.json()) as Partial<SwarmInput>;
  const input: SwarmInput = {
    mode: body.mode ?? "replay",
    date: body.date!,
    start: body.start ?? "06:00",
    end: body.end ?? "14:30",
    crews: body.crews ?? [],
    fields: body.fields ?? (fields as Field[]),
    note: body.note,
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: AgentEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      try {
        const plan = await runSwarm(input, emit);
        emit({ type: "done", planId: plan.id });
      } catch (err) {
        emit({ type: "error", message: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" },
  });
}
