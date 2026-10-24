// Alarm tone with Web Audio (no sound files). Browsers allow it after the user has tapped the page once.
let ctx: AudioContext | null = null;

export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {}
}

export function alarm(seconds = 3) {
  try {
    unlockAudio();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    for (let i = 0; i < seconds * 2; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.value = i % 2 ? 660 : 880;
      g.gain.setValueAtTime(0.0001, t0 + i * 0.5);
      g.gain.exponentialRampToValueAtTime(0.25, t0 + i * 0.5 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.5 + 0.45);
      o.connect(g).connect(ctx.destination);
      o.start(t0 + i * 0.5);
      o.stop(t0 + i * 0.5 + 0.5);
    }
    navigator.vibrate?.([400, 150, 400, 150, 400]);
  } catch {}
}
