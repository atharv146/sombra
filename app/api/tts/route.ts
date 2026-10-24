// Spoken audio for languages the phone has no voice for (most iPhones have no Punjabi voice).
// Proxies Google Translate's public text-to-speech in 180-character chunks and joins the MP3s.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const lang = (url.searchParams.get("lang") ?? "pa").slice(0, 5);
  const text = (url.searchParams.get("text") ?? "").slice(0, 900);
  if (!text.trim()) return new Response(null, { status: 400 });
  const chunks: string[] = [];
  let cur = "";
  for (const word of text.split(/\s+/)) {
    if ((cur + " " + word).length > 180) {
      chunks.push(cur);
      cur = word;
    } else cur = cur ? `${cur} ${word}` : word;
  }
  if (cur) chunks.push(cur);
  const parts = await Promise.all(
    chunks.map((q) =>
      fetch(`https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${lang}&q=${encodeURIComponent(q)}`, {
        headers: { "user-agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(10_000),
      }).then((r) => (r.ok ? r.arrayBuffer() : new ArrayBuffer(0))),
    ),
  );
  const body = new Blob(parts, { type: "audio/mpeg" });
  if (!body.size) return new Response(null, { status: 502 });
  return new Response(body, { headers: { "content-type": "audio/mpeg", "cache-control": "public, max-age=86400" } });
}
