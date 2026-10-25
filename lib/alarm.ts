// Alert sounds. Played as <audio> files built in the browser (no downloads), because iPhones mute Web Audio
// effects on silent mode and only allow sounds that were first started by a tap. unlockAudio() runs on that tap.

const RATE = 22050;

// Builds a small WAV file from tone segments: [frequency Hz (0 = silence), seconds, square?]
function wav(parts: [number, number, boolean?][], volume: number): string {
  const total = parts.reduce((n, [, d]) => n + Math.round(d * RATE), 0);
  const buf = new ArrayBuffer(44 + total * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + total * 2, true);
  str(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true);
  v.setUint32(28, RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, total * 2, true);
  let o = 44;
  for (const [f, d, square] of parts) {
    const n = Math.round(d * RATE);
    for (let i = 0; i < n; i++) {
      const env = Math.min(1, i / 200, (n - i) / 400); // soft edges, no clicks
      const s = f ? Math.sin((2 * Math.PI * f * i) / RATE) : 0;
      const val = (square ? Math.sign(s) * 0.6 : s) * env * volume;
      v.setInt16(o, Math.max(-1, Math.min(1, val)) * 32767, true);
      o += 2;
    }
  }
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

let alarmEl: HTMLAudioElement | null = null;
let chimeEl: HTMLAudioElement | null = null;
let sentEl: HTMLAudioElement | null = null;

function els() {
  if (typeof window === "undefined") return;
  alarmEl ??= new Audio(
    wav(
      Array.from({ length: 6 }, (_, i) => [[i % 2 ? 660 : 880, 0.42, true], [0, 0.08]] as [number, number, boolean?][]).flat(),
      0.9,
    ),
  );
  chimeEl ??= new Audio(wav([[880, 0.16], [1320, 0.34]], 0.45));
  sentEl ??= new Audio(wav([[1046, 0.08], [1568, 0.14]], 0.3));
}

// Call from a tap: plays both sounds silently once so the phone allows them later.
export function unlockAudio() {
  try {
    els();
    for (const el of [alarmEl, chimeEl, sentEl]) {
      if (!el || el.dataset.unlocked) continue;
      el.muted = true;
      void el
        .play()
        .then(() => {
          el.pause();
          el.currentTime = 0;
          el.muted = false;
          el.dataset.unlocked = "1";
        })
        .catch(() => {
          el.muted = false;
        });
    }
  } catch {}
}

// Loud alarm with vibration: heat alerts and worker emergencies. Loops for about `seconds`.
export function alarm(seconds = 3) {
  try {
    els();
    if (!alarmEl) return;
    alarmEl.loop = seconds > 3;
    alarmEl.currentTime = 0;
    void alarmEl.play().catch(() => {});
    if (seconds > 3) setTimeout(() => alarmEl && (alarmEl.loop = false), (seconds - 3) * 1000);
    navigator.vibrate?.([400, 150, 400, 150, 400, 150, 400]);
  } catch {}
}

// Soft two-note chime: a new message arrived.
export function chime() {
  try {
    els();
    if (!chimeEl) return;
    chimeEl.currentTime = 0;
    void chimeEl.play().catch(() => {});
    navigator.vibrate?.(120);
  } catch {}
}

// Short rising blip: your message was sent.
export function sent() {
  try {
    els();
    if (!sentEl) return;
    sentEl.currentTime = 0;
    void sentEl.play().catch(() => {});
  } catch {}
}
