// Compliance log: the day's plan and everything that happened, as a CSV a crew boss can file (Cal/OSHA §3395 records).
import { toMin } from "./rules";
import type { Crew, Field, RadioMessage, ShiftPlan } from "./types";

const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

export function complianceCsv(plan: ShiftPlan, usual: ShiftPlan | null, crews: Crew[], fields: Field[], msgs: RadioMessage[]): string {
  const rows: (string | number)[][] = [["section", "crew", "time", "item", "detail"]];
  const crewName = (id?: string) => crews.find((c) => c.id === id)?.name ?? (id ? id : "All crews");
  rows.push(["plan", "", plan.createdAt ?? "", "Day planned", `${plan.date}${plan.smoke ? " (smoke drill)" : ""}`]);
  for (const p of plan.crews) {
    const c = crewName(p.crewId);
    for (const b of p.blocks) {
      const field = fields.find((f) => f.id === b.fieldId)?.name ?? "";
      rows.push(["schedule", c, `${b.start}-${b.end}`, b.kind === "cooldown" ? "Paid cool-down (10 min, shade)" : b.kind, field]);
    }
    const work = p.blocks.filter((b) => b.kind === "work").reduce((n, b) => n + toMin(b.end) - toMin(b.start), 0);
    rows.push(["provisions", c, "", "Drinking water", `${p.waterGallons} gal for ${(work / 60).toFixed(1)} work hours`]);
    rows.push(["provisions", c, "", "Shade tents", `${p.shadeUnits}`]);
    if (p.respirators) rows.push(["provisions", c, "", "N95 respirators", "Provided (wildfire smoke)"]);
  }
  for (const v of usual?.violations ?? []) rows.push(["fixed before work", crewName(v.crewId), v.time ?? "", v.rule, v.message]);
  rows.push(["result", "", "", "Violations in final plan", `${plan.violations.length}`]);
  for (const m of msgs) {
    const when = new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (m.from === "boss") rows.push([m.kind === "chat" ? "message to crew" : m.kind === "alert" ? "heat alert" : "check-in request", crewName(m.crewId), when, m.text.en, ""]);
    else rows.push(["worker report", crewName(m.crewId), when, m.text.en, m.intent === "health" && m.triage ? `${m.triage.label} (${m.triage.model})` : (m.intent ?? "")]);
  }
  return rows.map((r) => r.map(cell).join(",")).join("\n");
}
