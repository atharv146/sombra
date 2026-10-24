// Speech to text in any language: Whisper on Groq (free tier). The phone records audio and uploads it here.
const KEY = () => process.env.GROQ_API_KEY;

export async function GET() {
  return Response.json({ enabled: !!KEY() });
}

const CODES: Record<string, string> = { spanish: "es", punjabi: "pa", english: "en" };

export async function POST(request: Request) {
  if (!KEY()) return Response.json({ error: "No GROQ_API_KEY" }, { status: 501 });
  const form = await request.formData();
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size < 1000) return Response.json({ text: "" });
  const out = new FormData();
  const ext = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
  out.append("file", audio, `checkin.${ext}`);
  out.append("model", "whisper-large-v3");
  out.append("response_format", "verbose_json");
  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${KEY()}` },
    body: out,
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return Response.json({ error: `Whisper ${res.status}: ${await res.text()}` }, { status: 502 });
  const d = (await res.json()) as { text: string; language?: string };
  const lang = d.language?.toLowerCase() ?? "";
  return Response.json({ text: d.text.trim(), language: CODES[lang] ?? lang });
}
