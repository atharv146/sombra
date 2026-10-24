import { addMessage } from "@/lib/store";
import { understand } from "@/lib/translate";
import { classify } from "@/lib/triage";
import type { Lang, RadioMessage, TriageLabel } from "@/lib/types";

// One-tap buttons have fixed meanings and translations: no AI call, no guessing.
const QUICK: { intent: NonNullable<RadioMessage["intent"]>; label: TriageLabel; text: Record<Lang, string>; reply: Record<Lang, string> }[] = [
  {
    intent: "health",
    label: "ok",
    text: { en: "I'm OK", es: "Estoy bien", pa: "ਮੈਂ ਠੀਕ ਹਾਂ" },
    reply: { en: "Thanks. Keep drinking water every 15 minutes.", es: "Gracias. Sigue tomando agua cada 15 minutos.", pa: "ਧੰਨਵਾਦ। ਹਰ 15 ਮਿੰਟ ਪਾਣੀ ਪੀਂਦੇ ਰਹੋ।" },
  },
  {
    intent: "request",
    label: "ok",
    text: { en: "I need water", es: "Necesito agua", pa: "ਮੈਨੂੰ ਪਾਣੀ ਚਾਹੀਦਾ" },
    reply: { en: "Your crew boss has your request. The water cooler is at the shade tent.", es: "Tu mayordomo recibió tu pedido. El agua está en la carpa de sombra.", pa: "ਸੁਪਰਵਾਈਜ਼ਰ ਨੂੰ ਤੁਹਾਡੀ ਬੇਨਤੀ ਮਿਲ ਗਈ। ਪਾਣੀ ਛਾਂ ਵਾਲੇ ਤੰਬੂ ਕੋਲ ਹੈ।" },
  },
  {
    intent: "health",
    label: "warning",
    text: { en: "I feel sick", es: "Me siento mal", pa: "ਮੈਨੂੰ ਠੀਕ ਨਹੀਂ ਲੱਗ ਰਿਹਾ" },
    reply: { en: "Stop and sit in the shade now. Sip water. Your crew boss has been alerted.", es: "Para y siéntate en la sombra ahora. Toma agua despacio. Tu mayordomo ya fue avisado.", pa: "ਹੁਣੇ ਰੁਕੋ ਅਤੇ ਛਾਂ ਵਿੱਚ ਬੈਠੋ। ਹੌਲੀ ਹੌਲੀ ਪਾਣੀ ਪੀਓ। ਸੁਪਰਵਾਈਜ਼ਰ ਨੂੰ ਦੱਸ ਦਿੱਤਾ ਹੈ।" },
  },
];

// A worker message to their crew boss: our model triages it, the AI routes and translates it.
export async function POST(request: Request) {
  const b = (await request.json()) as { planId: string; crewId: string; workerId: string; lang: string; transcript: string; quick?: number };
  const q = b.quick !== undefined ? QUICK[b.quick] : undefined;
  if (q) {
    const msg: RadioMessage = {
      id: Math.random().toString(36).slice(2, 10),
      planId: b.planId,
      from: "worker",
      crewId: b.crewId,
      workerId: b.workerId.slice(0, 12),
      lang: b.lang,
      original: q.text[(["es", "pa", "en"].includes(b.lang) ? b.lang : "en") as Lang],
      text: q.text,
      kind: "chat",
      intent: q.intent,
      triage: { label: q.label, scores: { ok: 0, warning: 0, heat_exhaustion: 0, emergency: 0, [q.label]: 1 }, model: "one-tap button" },
      autoReply: q.reply,
      at: new Date().toISOString(),
    };
    await addMessage(msg);
    return Response.json(msg);
  }
  const said = b.transcript?.trim().slice(0, 500);
  if (!said) return Response.json({ error: "Empty message" }, { status: 400 });
  const triage = classify(said);
  const { intent, text, reply } = await understand(said);
  // Health if the AI reads it as health, or our model is confident, or a safety keyword fired.
  // A low-confidence model guess on chit-chat ("I miss you") stays off-topic.
  const score = triage.scores?.[triage.label] ?? 0;
  const health = intent === "health" || !!triage.forcedByKeyword || (triage.label !== "ok" && score >= 0.55);
  const msg: RadioMessage = {
    id: Math.random().toString(36).slice(2, 10),
    planId: b.planId,
    from: "worker",
    crewId: b.crewId,
    workerId: b.workerId.slice(0, 12),
    lang: b.lang,
    original: said,
    text,
    kind: "chat",
    intent: health ? "health" : intent,
    triage,
    autoReply: reply,
    at: new Date().toISOString(),
  };
  await addMessage(msg);
  return Response.json(msg);
}
