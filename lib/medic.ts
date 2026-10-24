// Medic agent: a second opinion on a worker check-in, plus first-aid steps for the crew boss.
import "server-only";
import { callModel, modelName, parseJSON } from "./llm";
import type { TriageLabel } from "./types";

// CDC/NIOSH heat-illness first aid, used as the floor and as the fallback if the model is down.
export const FIRST_AID: Record<TriageLabel, string[]> = {
  emergency: [
    "Call 911 now.",
    "Move them to shade or the cooling trailer.",
    "Cool them fast: cold water or ice on neck, armpits and groin; soak their clothes.",
    "No drinks if they're confused. Stay with them until help arrives.",
  ],
  heat_exhaustion: [
    "Stop work. Move them to shade and sit them down.",
    "Small sips of cool water; loosen or remove extra layers.",
    "Cool wet cloths on head, neck and face.",
    "Stay with them. If they get worse or aren't better in 1 hour, get medical care.",
  ],
  warning: [
    "Paid cool-down now: shade for at least 10 minutes.",
    "Water or an electrolyte drink; gently stretch cramping muscles.",
    "Check on them again in 15 minutes before they go back.",
  ],
  ok: ["Keep drinking water every 15 minutes."],
};

const RANK: TriageLabel[] = ["ok", "warning", "heat_exhaustion", "emergency"];

export async function medicOpinion(transcript: string, modelLabel: TriageLabel) {
  try {
    const raw = await callModel({
      system:
        "You are Medic, a heat-illness triage assistant for a farm crew boss. Use CDC/NIOSH heat illness categories. You are not a doctor; when unsure, choose the more serious label.",
      prompt: `A worker said: "${transcript}"\nOur classifier says: ${modelLabel}.\nReply as JSON: {"label": "ok|warning|heat_exhaustion|emergency", "reason": "one short sentence", "note": "one sentence for the crew boss about THIS situation beyond standard first aid (e.g. don't let them drive home alone)"}`,
      json: true,
      maxTokens: 200,
    });
    const { label, reason, note } = parseJSON<{ label: TriageLabel; reason: string; note?: string }>(raw);
    // Safety: never let the second opinion downgrade the classifier.
    const final = RANK.indexOf(label) > RANK.indexOf(modelLabel) ? label : modelLabel;
    return { label: final, reason, note, agrees: label === modelLabel, model: modelName(), steps: FIRST_AID[final] };
  } catch {
    return { label: modelLabel, reason: "Model unavailable; using the classifier's call.", agrees: true, model: "rules", steps: FIRST_AID[modelLabel] };
  }
}
