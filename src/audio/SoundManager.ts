/**
 * Tiny procedural sound effects via the Web Audio API — no audio files needed
 * for the prototype. Each effect is a short synthesized blip. Browsers block
 * audio until a user gesture, so call `unlock()` from a pointer/key handler.
 */

type SfxName = "eat" | "hurt" | "evolve" | "levelup" | "boss" | "death";

interface Tone {
  freq: number;
  /** seconds */
  duration: number;
  type: OscillatorType;
  /** peak gain 0..1 */
  gain: number;
  /** optional linear pitch slide to this frequency by the end */
  slideTo?: number;
}

const SFX: Record<SfxName, Tone[]> = {
  eat: [{ freq: 520, slideTo: 720, duration: 0.09, type: "square", gain: 0.18 }],
  hurt: [{ freq: 200, slideTo: 90, duration: 0.18, type: "sawtooth", gain: 0.22 }],
  evolve: [
    { freq: 440, slideTo: 660, duration: 0.12, type: "triangle", gain: 0.2 },
    { freq: 660, slideTo: 880, duration: 0.12, type: "triangle", gain: 0.18 },
  ],
  levelup: [
    { freq: 523, duration: 0.12, type: "square", gain: 0.2 },
    { freq: 659, duration: 0.12, type: "square", gain: 0.2 },
    { freq: 784, duration: 0.18, type: "square", gain: 0.2 },
  ],
  boss: [{ freq: 110, slideTo: 70, duration: 0.5, type: "sawtooth", gain: 0.25 }],
  death: [{ freq: 330, slideTo: 60, duration: 0.6, type: "sawtooth", gain: 0.25 }],
};

export class SoundManager {
  private ctx?: AudioContext;
  private muted = false;

  /** Create/resume the AudioContext. Safe to call repeatedly; needs a gesture. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new Ctor();
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
    } catch {
      /* audio unavailable — game runs silently */
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  play(name: SfxName): void {
    if (this.muted || !this.ctx) return;
    const ctx = this.ctx;
    let when = ctx.currentTime;
    for (const tone of SFX[name]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = tone.type;
      osc.frequency.setValueAtTime(tone.freq, when);
      if (tone.slideTo !== undefined) {
        osc.frequency.linearRampToValueAtTime(tone.slideTo, when + tone.duration);
      }
      // Quick attack, exponential release for a clean blip.
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(tone.gain, when + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + tone.duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(when);
      osc.stop(when + tone.duration);
      when += tone.duration * 0.9;
    }
  }
}

/** Shared singleton so any scene can trigger sfx. */
export const sound = new SoundManager();
