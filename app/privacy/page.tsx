import Link from "next/link";

export const metadata = { title: "Sombra · Privacy and data safety" };

const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "What we keep",
    items: [
      "A random worker code (like w-a6ju) stored on the worker's own phone. No names, phone numbers, emails or photos.",
      "The day's plan: crews, fields, hours, water, shade.",
      "Messages between a crew and its crew boss, with their translations and our model's health label.",
    ],
  },
  {
    title: "What we never keep",
    items: [
      "Voice recordings. Audio is sent once for transcription and we never store it; only the text is kept.",
      "Location. Field positions are set by the crew boss; workers' phones are never tracked.",
      "Anything after the day. Plans and messages delete themselves after 48 hours, and End day removes the plan from every phone at once.",
    ],
  },
  {
    title: "Who sees what",
    items: [
      "On the phone, a worker sees their own crew's plan and their own messages only.",
      "The crew boss sees each crew's channel separately.",
      "No ads, no tracking scripts, no selling or sharing of data.",
    ],
  },
  {
    title: "Services that touch the data",
    items: [
      "OpenRouter and Groq (AI): receive message text to translate and understand it. Nothing else.",
      "Groq Whisper: receives a short audio clip to turn speech into text.",
      "Upstash (storage): holds plans and messages for up to 48 hours, encrypted in transit.",
      "Open-Meteo (weather): receives field coordinates only. Never any worker data.",
      "API keys stay on our server and are never sent to phones or browsers.",
    ],
  },
  {
    title: "Safety limits",
    items: [
      "Sombra supports a crew boss; it is not a medical device and never replaces calling 911.",
      "AI can be wrong, so plain code enforces the heat law, and the AI can only raise a health alert, never lower one.",
      "This is a hackathon prototype: anyone with a plan's link can open it. A real rollout would add a crew-boss login, worker consent in their language, and SMS for workers without smartphones.",
    ],
  },
];

export default function Privacy() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10">
      <header>
        <Link href="/command" className="text-sm underline">
          Back to Sombra
        </Link>
        <h1 className="mt-3 font-display text-5xl leading-none">Privacy and data safety</h1>
        <p className="mt-3 text-lg leading-relaxed">
          Workers can't stay safe if they're afraid to speak up. Sombra keeps as little as possible, for as short a time as possible.
        </p>
      </header>
      {SECTIONS.map((s) => (
        <section key={s.title}>
          <h2 className="font-display text-2xl">{s.title}</h2>
          <ul className="mt-2 flex flex-col gap-2 border-t border-[var(--line)] pt-2">
            {s.items.map((i) => (
              <li key={i} className="leading-relaxed">
                {i}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
