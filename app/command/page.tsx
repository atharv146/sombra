import fields from "@/data/fields.json";
import { REPLAY_DATE } from "@/lib/weather";
import type { Field } from "@/lib/types";
import { Command } from "./Command";

export const metadata = { title: "Sombra · Command" };

export default function CommandPage() {
  return <Command fields={fields as Field[]} replayDate={REPLAY_DATE} />;
}
