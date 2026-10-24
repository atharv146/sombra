import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import Link from "next/link";

export const metadata = { title: "Sombra · How it works" };

interface Metrics {
  accuracy: number;
  macro_f1: number;
  emergency_recall: number;
  train_size: number;
  test_size: number;
}

function loadMetrics(): Metrics | null {
  const file = path.join(process.cwd(), "public/model/triage.json");
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")).metrics as Metrics;
}

const CREDITS: [string, string][] = [
  ["Agent models", "Anthropic Claude Sonnet 5.5 or Google Gemini 3.8 Flash (whichever is configured), called from our server"],
  ["Weather", "Open-Meteo forecast, ERA5 historical archive and air-quality APIs (CC BY 4.0)"],
  ["Map", "MapLibre GL, OpenFreeMap tiles, © OpenStreetMap contributors"],
  ["Heat math", "Stull (2011) wet-bulb formula; ISO 7243 WBGT weighting; ACGIH-style action levels"],
  ["Rules", "Cal/OSHA Title 8 §3395 (heat illness) and §5141.1 (wildfire smoke); CA Labor Code 226.2 (paid rest)"],
  ["First aid", "CDC/NIOSH heat-related illness guidance"],
  ["Training data", "Sentences generated with Google Gemini from CDC/NIOSH symptom lists and hand-checked; test set written by our team"],
  ["Libraries", "Next.js, React, Tailwind CSS, scikit-learn, pandas, matplotlib, qrcode.react"],
  ["Tools", "Claude Code helped write the app code; Google Colab for training; design skills frontend-design (Anthropic), taste-skill (Leonxlnx), transitions.dev (Jakub Antalik)"],
];

export default function About() {
  const m = loadMetrics();
  const hasMatrix = existsSync(path.join(process.cwd(), "public/model/confusion.png"));
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-10">
      <header>
        <Link href="/command" className="text-sm underline">
          ← Command center
        </Link>
        <h1 className="mt-3 font-display text-5xl leading-none">How Sombra decides</h1>
        <p className="mt-4 text-lg leading-relaxed">
          Sombra&apos;s agents decide when and where each crew works from the hourly heat forecast and California&apos;s heat
          law, and our own classifier learns to spot heat illness from a worker&apos;s words in Spanish, Punjabi or English.
        </p>
      </header>

      <section>
        <h2 className="font-display text-3xl">Three layers</h2>
        <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5">
          <li>
            <b>Agents draft.</b> Cielo reads the weather, Ley explains the law, Crítico tries to break the plan, Cuadrilla
            rebuilds the day, Voz writes the briefings, Medic gives a second opinion on check-ins.
          </li>
          <li>
            <b>Code decides.</b> A deterministic rules engine checks every plan against Cal/OSHA thresholds. A plan that
            breaks a rule can&apos;t be sent; if the agents miss something, the engine fixes it.
          </li>
          <li>
            <b>Our model listens.</b> When a worker checks in by voice, our classifier labels it ok, warning, heat
            exhaustion or emergency. Emergency keywords always escalate, and Medic can raise the label but never lower it.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="font-display text-3xl">Model card: sombra-triage v1</h2>
        <dl className="mt-3 grid grid-cols-[160px_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="font-semibold">Model</dt>
          <dd>Character n-gram TF-IDF (2–4) + logistic regression (scikit-learn), balanced class weights</dd>
          <dt className="font-semibold">Why this model</dt>
          <dd>Character n-grams handle Spanish, Gurmukhi Punjabi, Spanglish and typos without a tokenizer per language; tiny enough to run anywhere</dd>
          <dt className="font-semibold">Labels</dt>
          <dd>ok · warning · heat_exhaustion · emergency (CDC/NIOSH categories)</dd>
          <dt className="font-semibold">Data</dt>
          <dd>
            {m ? `${m.train_size} training sentences; ${m.test_size} test sentences written by hand` : "Training in progress"}
          </dd>
          <dt className="font-semibold">Results</dt>
          <dd>
            {m
              ? `Accuracy ${m.accuracy} · macro F1 ${m.macro_f1} · emergency recall ${m.emergency_recall}`
              : "Coming soon"}
          </dd>
          <dt className="font-semibold">Limits</dt>
          <dd>
            Small dataset; it reads words, not vital signs. It supports a crew boss and never replaces calling 911. We also trained a v2 with 150 extra
            off-topic sentences: same accuracy, but emergency recall fell from 0.80 to 0.70, so we kept v1 and route off-topic messages with the AI and a
            confidence gate instead.
          </dd>
          <dt className="font-semibold">Privacy</dt>
          <dd>Worker IDs only, no names; no audio stored; plans and check-ins expire after 2 days</dd>
        </dl>
        {hasMatrix && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/model/confusion.png" alt="Confusion matrix on the hand-written test set" className="mt-4 w-full max-w-md rounded-lg border border-[var(--line)]" />
        )}
      </section>

      <section>
        <h2 className="font-display text-3xl">Credits</h2>
        <dl className="mt-3 grid grid-cols-[130px_1fr] gap-x-4 gap-y-2 text-sm">
          {CREDITS.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-semibold">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
