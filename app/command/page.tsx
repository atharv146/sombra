import fields from "@/data/fields.json";
import type { Field } from "@/lib/types";
import { Command } from "./Command";

export const metadata = { title: "Sombra · Command" };

export default function CommandPage() {
  return <Command fields={fields as Field[]} />;
}
