// Our heat-illness triage model (Darshan's sombra-triage), run in TypeScript from public/model/triage.json.
// Reproduces scikit-learn: TfidfVectorizer(analyzer="char_wb", ngram_range=(2,4), lowercase, l2) + LogisticRegression softmax.
import "server-only";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { TriageLabel, TriageResult } from "./types";

interface ModelFile {
  model: string;
  config?: { ngram_range: [number, number] };
  labels: TriageLabel[];
  vocab: Record<string, number>;
  idf: number[];
  coef: number[][];
  intercept: number[];
}

let cached: ModelFile | null | undefined;
function load(): ModelFile | null {
  if (cached !== undefined) return cached;
  const file = path.join(process.cwd(), "public/model/triage.json");
  cached = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as ModelFile) : null;
  return cached;
}

// sklearn's char_wb: pad each whitespace-separated word with spaces, take n-grams inside it.
function charWbNgrams(text: string, minN: number, maxN: number): string[] {
  const out: string[] = [];
  for (const word of text.toLowerCase().split(/\s+/).filter(Boolean)) {
    const w = Array.from(` ${word} `);
    for (let n = minN; n <= maxN; n++) {
      let offset = 0;
      out.push(w.slice(offset, offset + n).join(""));
      while (offset + n < w.length) {
        offset++;
        out.push(w.slice(offset, offset + n).join(""));
      }
      if (offset === 0) break; // word shorter than n
    }
  }
  return out;
}

// Safety floor: these always escalate to emergency, whatever the model says.
const EMERGENCY = [
  "desmay", "confundid", "no puede hablar", "no puedo hablar", "convuls", "no respira", "dejó de sudar", "deje de sudar", "inconsciente",
  "fainted", "passed out", "confused", "seizure", "not breathing", "stopped sweating", "can't talk", "unconscious",
  "ਬੇਹੋਸ਼", "ਦੌਰਾ", "ਸਾਹ ਨਹੀਂ",
];

const KEYWORDS: Record<Exclude<TriageLabel, "ok">, string[]> = {
  emergency: EMERGENCY,
  heat_exhaustion: ["mare", "dolor de cabeza", "náusea", "nausea", "vomit", "débil", "debil", "dizzy", "headache", "weak", "throw up", "ਚੱਕਰ", "ਸਿਰ", "ਉਲਟੀ", "ਕਮਜ਼ੋਰ"],
  warning: ["calambre", "sed", "sudando", "cansad", "cramp", "thirsty", "sweating", "tired", "ਪਿਆਸ", "ਥਕਾਵਟ", "ਪਸੀਨਾ"],
};

export function classify(text: string): TriageResult {
  const lower = text.toLowerCase();
  const forced = EMERGENCY.find((k) => lower.includes(k));
  const m = load();
  let result: TriageResult;

  if (m) {
    const [minN, maxN] = m.config?.ngram_range ?? [2, 4];
    const tf = new Map<number, number>();
    for (const g of charWbNgrams(text, minN, maxN)) {
      const i = m.vocab[g];
      if (i !== undefined) tf.set(i, (tf.get(i) ?? 0) + 1);
    }
    let norm = 0;
    for (const [i, c] of tf) {
      const v = c * m.idf[i];
      tf.set(i, v);
      norm += v * v;
    }
    norm = Math.sqrt(norm) || 1;
    const logits = m.coef.map((row, k) => {
      let z = m.intercept[k];
      for (const [i, v] of tf) z += row[i] * (v / norm);
      return z;
    });
    const max = Math.max(...logits);
    const exps = logits.map((z) => Math.exp(z - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    const scores = Object.fromEntries(m.labels.map((l, k) => [l, exps[k] / sum])) as Record<TriageLabel, number>;
    const label = m.labels[exps.indexOf(Math.max(...exps))];
    result = { label, scores, model: m.model };
  } else {
    const label =
      (Object.keys(KEYWORDS) as (keyof typeof KEYWORDS)[]).find((l) => KEYWORDS[l].some((k) => lower.includes(k))) ?? "ok";
    const scores = { ok: 0, warning: 0, heat_exhaustion: 0, emergency: 0, [label]: 1 } as Record<TriageLabel, number>;
    result = { label, scores, model: "sombra-triage fallback (keywords)" };
  }

  if (forced && result.label !== "emergency") return { ...result, label: "emergency", forcedByKeyword: forced };
  return result;
}
