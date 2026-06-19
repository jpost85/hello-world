/**
 * Tiny synthesized sound effects via the Web Audio API.
 *
 * Everything is generated at runtime (no audio files), so the single-file build
 * stays small and the effects ship inline. The AudioContext is created lazily
 * and resumed on first use — browsers only allow audio after a user gesture,
 * and every effect here is triggered by a click, so that constraint is met.
 */

export type SoundName = "roll" | "capture" | "lose";

const MUTE_KEY = "dominion-muted";

let ctx: AudioContext | null = null;
let muted = readMuted();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  try {
    localStorage.setItem(MUTE_KEY, next ? "1" : "0");
  } catch {
    /* storage unavailable — ignore */
  }
}

function audio(): AudioContext | null {
  if (muted) return null;
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new Ctor();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** A single decaying oscillator note. */
function tone(
  ac: AudioContext,
  freq: number,
  start: number,
  duration: number,
  type: OscillatorType,
  peak = 0.18,
): void {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration);
}

/** A short burst of filtered noise — the "clack" of dice landing. */
function clack(ac: AudioContext, start: number): void {
  const length = Math.floor(ac.sampleRate * 0.09);
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  }
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1600;
  const gain = ac.createGain();
  gain.gain.value = 0.25;
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(start);
}

export function playSound(name: SoundName): void {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  switch (name) {
    case "roll":
      clack(ac, t);
      clack(ac, t + 0.06);
      break;
    case "capture":
      // Bright ascending triad — a small fanfare on conquest.
      tone(ac, 523.25, t, 0.18, "triangle");
      tone(ac, 659.25, t + 0.08, 0.18, "triangle");
      tone(ac, 783.99, t + 0.16, 0.28, "triangle");
      break;
    case "lose":
      // Low descending thud when an attack is repulsed.
      tone(ac, 196.0, t, 0.22, "sawtooth", 0.14);
      tone(ac, 130.81, t + 0.1, 0.3, "sawtooth", 0.14);
      break;
  }
}
