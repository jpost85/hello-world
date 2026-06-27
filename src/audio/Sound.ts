import type { SoundType } from "../game/Game";

/**
 * Tiny WebAudio synth — all SFX are generated on the fly, so the game ships
 * with zero audio assets. Must be unlocked by a user gesture (mobile autoplay
 * policy); call `unlock()` from the first pointer event.
 */
export class Sound {
  private ctx: AudioContext | null = null;
  private noiseBuf: AudioBuffer | null = null;
  muted = false;

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    // Pre-bake a buffer of white noise for explosion textures.
    const len = Math.floor(this.ctx.sampleRate * 1.2);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  play(type: SoundType, intensity = 1): void {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;

    if (type === "fire") {
      // Short downward "thunk" of the shell leaving the barrel.
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.12);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.25, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
      return;
    }

    // Explosion / death: filtered noise burst with a low rumble.
    const dur = type === "death" ? 0.7 : 0.4 + 0.25 * Math.min(2, intensity);
    if (this.noiseBuf) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(900 + 700 * intensity, now);
      filter.frequency.exponentialRampToValueAtTime(140, now + dur);
      const gain = ctx.createGain();
      const vol = Math.min(0.6, 0.3 * intensity + 0.2);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start(now);
      src.stop(now + dur);
    }
    // Sub-bass thump.
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + dur);
    og.gain.setValueAtTime(0.5 * Math.min(1.5, intensity), now);
    og.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(og).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur);
  }
}
