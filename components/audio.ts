"use client";

// Gentle two-note chime for alarms. Browsers gate audio behind a user
// gesture, so unlockAudio() is wired to the first pointerdown on the app.

let ctx: AudioContext | null = null;

export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") ctx.resume();
  } catch {
    // no audio available — alarm stays visual
  }
}

function note(freq: number, start: number, dur: number) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(0.22, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur);
}

export function chime() {
  if (!ctx || ctx.state !== "running") return;
  const t = ctx.currentTime;
  note(880, t, 0.5);
  note(660, t + 0.28, 0.7);
}
