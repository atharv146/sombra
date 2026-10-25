// Alert sounds with Web Audio (no sound files). Browsers allow sound after the user has tapped the page once.
let ctx: AudioContext | null = null;

export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    // iPhones also need a sound played inside the tap before later sounds are allowed.
    const b = ctx.createBuffer(1, 1, 22050);
    const s = ctx.createBufferSource();
    s.buffer = b;
    s.connect(ctx.destination);
    s.start(0);
  } catch {}
}

function tone(at: number, freq: number, dur: number, gain: number, type: OscillatorType) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(ctx.destination);
  o.start(at);
  o.stop(at + dur + 0.05);
}

// Loud two-tone alarm with vibration: heat alerts and worker emergencies.
export function alarm(seconds = 3) {
  try {
    unlockAudio();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    for (let i = 0; i < seconds * 2; i++) tone(t0 + i * 0.5, i % 2 ? 660 : 880, 0.45, 0.28, "square");
    navigator.vibrate?.([400, 150, 400, 150, 400]);
  } catch {}
}

// Soft two-note chime: a new message arrived.
export function chime() {
  try {
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    const t0 = ctx.currentTime;
    tone(t0, 880, 0.25, 0.18, "sine");
    tone(t0 + 0.14, 1320, 0.35, 0.16, "sine");
    navigator.vibrate?.(120);
  } catch {}
}
