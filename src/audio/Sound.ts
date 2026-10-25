/**
 * Synthesized sound: short procedural effects for sim events and a quiet
 * generative ambience per biome. Nothing is loaded from disk.
 *
 * Browsers only allow audio after a user gesture, so the context is created
 * on the first `unlock()` call (the title screen's first click or key).
 */
import type { BiomeId } from '../sim/content';
import type { SimEvent } from '../sim/events';

/** Pentatonic-ish scale roots per biome, in Hz, for the ambient pad. */
const BIOME_ROOTS: Record<BiomeId, number> = {
  ruins: 110,
  forest: 123.47,
  caves: 98,
  crystal: 130.81,
  void: 87.31,
  sanctuary: 146.83,
};
const SCALE = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2];

export class Sound {
  private ctx: AudioContext | undefined;
  private master!: GainNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private noise!: AudioBuffer;
  private ambience: { stop(): void } | undefined;
  private ambienceKey = '';
  private volumes = { master: 0.8, music: 0.5, sfx: 0.8 };
  private lastPlayed = new Map<string, number>();

  /** Creates the audio context; call from a user gesture. Safe to call repeatedly. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.sfx = this.ctx.createGain();
    this.music = this.ctx.createGain();
    this.sfx.connect(this.master);
    this.music.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.applyVolumes();
  }

  setVolumes(master: number, music: number, sfx: number): void {
    this.volumes = { master, music, sfx };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    this.master.gain.value = this.volumes.master;
    this.music.gain.value = this.volumes.music * 0.5;
    this.sfx.gain.value = this.volumes.sfx * 0.6;
  }

  /** Suspends or resumes all audio (e.g. while paused in the background). */
  setSuspended(suspended: boolean): void {
    if (!this.ctx) return;
    void (suspended ? this.ctx.suspend() : this.ctx.resume());
  }

  handle(events: readonly SimEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case 'swing':
          this.whoosh(e.combo === 2 ? 0.16 : 0.1, e.combo === 2 ? 900 : 1600, 0.25);
          break;
        case 'hit':
          if (e.target === 'enemy') this.thump(e.crit ? 220 : 160, e.crit ? 0.35 : 0.22, 'hit');
          break;
        case 'playerHurt':
          this.tone(180, 70, 0.22, 'sawtooth', 0.3);
          this.thump(90, 0.4, 'hurt');
          break;
        case 'dash':
          this.whoosh(0.18, 600, 0.2);
          break;
        case 'bolt':
          this.tone(1200, 500, 0.12, 'square', 0.08);
          break;
        case 'enemyWindup':
          this.tone(260, 420, 0.25, 'triangle', 0.06, 'windup');
          break;
        case 'enemyAttack':
          if (e.attack === 'slam') this.thump(60, 0.5, 'slam');
          else if (e.attack === 'ring' || e.attack === 'spread' || e.attack === 'shot')
            this.tone(700, 300, 0.15, 'sine', 0.08, 'shot');
          break;
        case 'enemyDied':
          this.tone(
            e.boss ? 200 : 420,
            e.boss ? 40 : 120,
            e.boss ? 1.2 : 0.25,
            'triangle',
            e.boss ? 0.4 : 0.12
          );
          this.whoosh(e.boss ? 0.8 : 0.15, 400, 0.2);
          break;
        case 'pickup':
          if (e.kind === 'shard')
            this.tone(1300 + Math.random() * 300, 1800, 0.06, 'sine', 0.06, 'shard');
          else this.chord([660, 880], 0.25, 0.1);
          break;
        case 'potion':
          this.chord([392, 494, 587], 0.4, 0.12);
          break;
        case 'levelUp':
          this.arpeggio([523, 659, 784, 1047], 0.07, 0.14);
          break;
        case 'graze':
          this.tone(1400, 2200, 0.07, 'sine', 0.05, 'graze');
          break;
        case 'resonance':
          if (e.count === 3 || e.count === 6 || e.count === 10)
            this.tone(440 + e.count * 40, 880 + e.count * 40, 0.12, 'triangle', 0.07);
          break;
        case 'resonanceBreak':
          this.tone(240, 120, 0.3, 'sawtooth', 0.12);
          break;
        case 'lootSurge':
          this.arpeggio(
            e.kind === 'jackpot' ? [659, 880, 1109, 1319, 1760] : [659, 880, 1109],
            0.07,
            0.12
          );
          break;
        case 'flawlessRoom':
          this.arpeggio([784, 988, 1319], 0.06, 0.09);
          break;
        case 'objectiveComplete':
          this.chord([392, 523, 659, 784], 0.7, 0.14);
          break;
        case 'roomLocked':
          this.thump(70, 0.5, 'lock');
          this.tone(110, 108, 0.8, 'sawtooth', 0.06);
          break;
        case 'roomCleared':
          this.arpeggio([392, 523, 659], 0.09, 0.12);
          break;
        case 'bossIntro':
          this.tone(55, 50, 2.5, 'sawtooth', 0.18);
          this.tone(82, 80, 2.5, 'sine', 0.2);
          break;
        case 'bossPhase':
          this.tone(80, 160, 0.6, 'sawtooth', 0.15);
          break;
        case 'fragmentFound':
          this.arpeggio([784, 988, 1175, 1568], 0.11, 0.12);
          break;
        case 'interact':
          this.chord([440, 554, 659], 0.6, 0.12);
          break;
        case 'notice':
          this.tone(300, 260, 0.15, 'square', 0.05);
          break;
        case 'playerDied':
          this.arpeggio([392, 330, 262, 196], 0.18, 0.15);
          break;
        case 'victory':
          this.arpeggio([523, 659, 784, 1047, 1319], 0.16, 0.15);
          break;
        default:
          break;
      }
    }
  }

  /** Plays a menu click. */
  click(): void {
    this.tone(880, 990, 0.05, 'sine', 0.06);
  }

  /** Throttles a named sound so a crowd of identical events doesn't clip. */
  private throttled(key: string | undefined, gap = 0.04): boolean {
    if (!this.ctx || !key) return false;
    const now = this.ctx.currentTime;
    if (now - (this.lastPlayed.get(key) ?? -1) < gap) return true;
    this.lastPlayed.set(key, now);
    return false;
  }

  private envelope(gain: GainNode, peak: number, duration: number, start: number): void {
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  }

  private tone(
    from: number,
    to: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    key?: string
  ): void {
    const ctx = this.ctx;
    if (!ctx || this.throttled(key)) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + duration);
    this.envelope(gain, volume, duration, t);
    osc.connect(gain).connect(this.sfx);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  private whoosh(duration: number, cutoff: number, volume: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(cutoff * 0.5, t);
    filter.frequency.exponentialRampToValueAtTime(cutoff * 1.6, t + duration);
    filter.Q.value = 1.2;
    const gain = ctx.createGain();
    this.envelope(gain, volume, duration, t);
    src.connect(filter).connect(gain).connect(this.sfx);
    src.start(t, Math.random() * 0.5);
    src.stop(t + duration + 0.05);
  }

  private thump(freq: number, volume: number, key: string): void {
    if (!this.ctx || this.throttled(key, 0.03)) return;
    this.tone(freq, freq * 0.4, 0.14, 'sine', volume);
    this.whoosh(0.06, 2500, volume * 0.5);
  }

  private chord(freqs: number[], duration: number, volume: number): void {
    for (const f of freqs) this.tone(f, f, duration, 'triangle', volume / freqs.length + 0.03);
  }

  private arpeggio(freqs: number[], step: number, volume: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    freqs.forEach((f, i) => {
      const t = ctx.currentTime + i * step;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = f;
      this.envelope(gain, volume, step * 3, t);
      osc.connect(gain).connect(this.sfx);
      osc.start(t);
      osc.stop(t + step * 3 + 0.05);
    });
  }

  /** Starts (or keeps) the ambient pad for a biome; `tense` adds a low pulse for boss fights. */
  playAmbience(biome: BiomeId, tense = false): void {
    const key = `${biome}:${tense}`;
    if (!this.ctx || this.ambienceKey === key) return;
    this.ambience?.stop();
    this.ambienceKey = key;
    const ctx = this.ctx;
    const root = BIOME_ROOTS[biome];
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.linearRampToValueAtTime(1, ctx.currentTime + 2.5);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = tense ? 900 : 600;
    filter.connect(out).connect(this.music);

    // Two detuned drones with a slow filter sweep.
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 250;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
    const drones = [root / 2, (root / 2) * 1.5, root].map((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.value = f;
      osc.detune.value = (i - 1) * 6;
      g.gain.value = i === 0 ? 0.22 : 0.08;
      osc.connect(g).connect(filter);
      osc.start();
      return osc;
    });

    // Sparse bell notes drawn from the scale.
    const timer = window.setInterval(
      () => {
        if (!this.ctx) return;
        const t = ctx.currentTime;
        const f =
          root *
          2 *
          SCALE[Math.floor(Math.random() * SCALE.length)] *
          (Math.random() < 0.3 ? 2 : 1);
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(tense ? 0.05 : 0.07, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
        osc.connect(g).connect(out);
        osc.start(t);
        osc.stop(t + 2.5);
      },
      tense ? 700 : 2200
    );

    this.ambience = {
      stop: () => {
        window.clearInterval(timer);
        const t = ctx.currentTime;
        out.gain.cancelScheduledValues(t);
        out.gain.setValueAtTime(out.gain.value, t);
        out.gain.linearRampToValueAtTime(0, t + 1.2);
        for (const o of [...drones, lfo]) o.stop(t + 1.3);
      },
    };
  }

  stopAmbience(): void {
    this.ambience?.stop();
    this.ambience = undefined;
    this.ambienceKey = '';
  }
}
