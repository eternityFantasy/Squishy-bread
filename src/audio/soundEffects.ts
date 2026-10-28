/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class BreadAudioManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.75;
  private lastPlayTime: number = 0;
  private comboCount: number = 0;
  private activeStretchOsc: OscillatorNode | null = null;
  private activeStretchGain: GainNode | null = null;

  constructor() {
    // Check saved settings
    try {
      const savedMute = localStorage.getItem('squishy_bread_mute');
      if (savedMute !== null) {
        this.isMuted = savedMute === 'true';
      }
    } catch {
      // ignore
    }
  }

  private initContext(): AudioContext | null {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        return this.ctx;
      }
    } catch {
      // AudioContext unavailable
    }
    return null;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    try {
      localStorage.setItem('squishy_bread_mute', String(muted));
    } catch {
      // ignore
    }
    if (muted && this.activeStretchOsc) {
      this.stopStretch();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  public getVolume(): number {
    return this.volume;
  }

  private getPitchMultiplier(): number {
    const now = Date.now();
    if (now - this.lastPlayTime < 500) {
      this.comboCount = Math.min(6, this.comboCount + 1);
    } else {
      this.comboCount = 0;
    }
    this.lastPlayTime = now;
    // Playful ascending pitch variation on repeated rapid squishing
    const semitones = [0, 2, 4, 7, 9, 12, 14];
    const semitone = semitones[this.comboCount] || 0;
    const randomJitter = (Math.random() - 0.5) * 0.08;
    return Math.pow(2, semitone / 12) + randomJitter;
  }

  /**
   * Squish: soft, pillowy squishy bread sound
   */
  public playSquish(intensity = 0.5): void {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const pitch = this.getPitchMultiplier();
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    // Gentle pillowy squish with low-pass dampening
    osc.type = 'sine';
    const baseFreq = (180 + intensity * 60) * pitch;
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(60, baseFreq * 0.45), t + 0.14);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(650, t);
    filter.frequency.exponentialRampToValueAtTime(220, t + 0.14);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.42 * this.volume * Math.max(0.3, intensity), t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.16);
  }

  /**
   * Continuous or dynamic rubbery stretch sound
   */
  public updateStretchSound(stretchRatio: number, isDragging: boolean): void {
    if (this.isMuted || !isDragging || stretchRatio < 1.08) {
      this.stopStretch();
      return;
    }

    const ctx = this.initContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const normalizedStretch = Math.min(2.5, stretchRatio);
    const targetFreq = 220 + (normalizedStretch - 1.0) * 360;
    const targetGain = Math.min(0.24, (normalizedStretch - 1.0) * 0.22) * this.volume;

    if (!this.activeStretchOsc) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(targetFreq, t);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(750, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(targetGain, t + 0.04);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      this.activeStretchOsc = osc;
      this.activeStretchGain = gain;
    } else if (this.activeStretchGain) {
      this.activeStretchOsc.frequency.setTargetAtTime(targetFreq, t, 0.05);
      this.activeStretchGain.gain.setTargetAtTime(targetGain, t, 0.05);
    }
  }

  public stopStretch(): void {
    if (this.activeStretchGain && this.ctx) {
      const t = this.ctx.currentTime;
      try {
        this.activeStretchGain.gain.setTargetAtTime(0.0001, t, 0.04);
        const osc = this.activeStretchOsc;
        setTimeout(() => {
          try {
            osc?.stop();
            osc?.disconnect();
          } catch {
            // ignore
          }
        }, 70);
      } catch {
        // ignore
      }
    }
    this.activeStretchOsc = null;
    this.activeStretchGain = null;
  }

  /**
   * Twist: cute, soft squeak
   */
  public playTwistSqueak(): void {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const pitch = this.getPitchMultiplier();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const startFreq = (540 + Math.random() * 80) * pitch;
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(startFreq * 1.5, t + 0.05);
    osc.frequency.exponentialRampToValueAtTime(startFreq * 0.9, t + 0.12);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.3 * this.volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.14);
  }

  /**
   * Release: Satisfying spring or boing sound with damping oscillation
   */
  public playBoing(energy = 0.5): void {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    this.stopStretch();

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // FM Modulator for classic boing spring vibration
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();

    const baseFreq = 260;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.8, t + 0.08);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.95, t + 0.28);

    mod.type = 'sine';
    mod.frequency.setValueAtTime(28, t);
    mod.frequency.linearRampToValueAtTime(14, t + 0.35);

    modGain.gain.setValueAtTime(45 * energy, t);
    modGain.gain.exponentialRampToValueAtTime(1, t + 0.35);

    mod.connect(modGain);
    modGain.connect(osc.frequency);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.48 * this.volume * Math.min(1.0, 0.4 + energy), t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);

    osc.connect(gain);
    gain.connect(ctx.destination);

    mod.start(t);
    osc.start(t);

    mod.stop(t + 0.4);
    osc.stop(t + 0.4);
  }

  /**
   * Gentle bread tap/pat sound (affectionate little bakery tap)
   */
  public playPat(): void {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.09);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.25 * this.volume, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.11);
  }

  /**
   * Toy Hammer Strike: cartoon squeaky mallet bonk with satisfying thud
   */
  public playHammerBonk(streak = 1): void {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const comboBoost = Math.min(6, streak - 1);
    const pitchScale = Math.pow(1.08, comboBoost);

    // 1. Mallet impact thud (low warm acoustic punch)
    const thudOsc = ctx.createOscillator();
    const thudGain = ctx.createGain();
    const thudFilter = ctx.createBiquadFilter();

    thudOsc.type = 'triangle';
    thudOsc.frequency.setValueAtTime(140 * pitchScale, t);
    thudOsc.frequency.exponentialRampToValueAtTime(45, t + 0.12);

    thudFilter.type = 'lowpass';
    thudFilter.frequency.setValueAtTime(450, t);
    thudFilter.frequency.exponentialRampToValueAtTime(120, t + 0.12);

    thudGain.gain.setValueAtTime(0.001, t);
    thudGain.gain.linearRampToValueAtTime(0.6 * this.volume, t + 0.01);
    thudGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);

    thudOsc.connect(thudFilter);
    thudFilter.connect(thudGain);
    thudGain.connect(ctx.destination);

    thudOsc.start(t);
    thudOsc.stop(t + 0.16);

    // 2. High squeaky toy mallet chirp
    const squeakOsc = ctx.createOscillator();
    const squeakGain = ctx.createGain();

    squeakOsc.type = 'sine';
    const squeakStartFreq = (680 + comboBoost * 90) * (0.95 + Math.random() * 0.1);
    squeakOsc.frequency.setValueAtTime(squeakStartFreq, t);
    squeakOsc.frequency.exponentialRampToValueAtTime(squeakStartFreq * 1.6, t + 0.035);
    squeakOsc.frequency.exponentialRampToValueAtTime(squeakStartFreq * 0.7, t + 0.11);

    squeakGain.gain.setValueAtTime(0.001, t);
    squeakGain.gain.linearRampToValueAtTime(0.42 * this.volume, t + 0.015);
    squeakGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);

    squeakOsc.connect(squeakGain);
    squeakGain.connect(ctx.destination);

    squeakOsc.start(t);
    squeakOsc.stop(t + 0.14);
  }

  /**
   * Accompanying sound effect when bread is repeatedly struck and kept flattened:
   * Comical rubber wobble and cartoon dizzy star chimes!
   */
  public playFlattenedDizzyWobble(): void {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const t = ctx.currentTime;

    // 1. Rubber wobble oscillator with vibrato modulation
    const wobbleOsc = ctx.createOscillator();
    const wobbleGain = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();

    wobbleOsc.type = 'sine';
    wobbleOsc.frequency.setValueAtTime(320, t);
    wobbleOsc.frequency.exponentialRampToValueAtTime(180, t + 0.45);

    // LFO rapid warble
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(16, t);
    lfo.frequency.linearRampToValueAtTime(10, t + 0.45);

    lfoGain.gain.setValueAtTime(35, t);
    lfoGain.gain.exponentialRampToValueAtTime(2, t + 0.45);

    lfo.connect(lfoGain);
    lfoGain.connect(wobbleOsc.frequency);

    wobbleGain.gain.setValueAtTime(0.001, t);
    wobbleGain.gain.linearRampToValueAtTime(0.35 * this.volume, t + 0.03);
    wobbleGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);

    wobbleOsc.connect(wobbleGain);
    wobbleGain.connect(ctx.destination);

    lfo.start(t);
    wobbleOsc.start(t);
    lfo.stop(t + 0.48);
    wobbleOsc.stop(t + 0.48);

    // 2. Playful sparkling dizzy chimes (little orbiting stars effect)
    const starNotes = [880, 1174, 1396, 1760];
    starNotes.forEach((freq, idx) => {
      const delay = idx * 0.08;
      const chimeOsc = ctx.createOscillator();
      const chimeGain = ctx.createGain();

      chimeOsc.type = 'sine';
      chimeOsc.frequency.setValueAtTime(freq, t + delay);
      chimeOsc.frequency.exponentialRampToValueAtTime(freq * 0.96, t + delay + 0.18);

      chimeGain.gain.setValueAtTime(0.0001, t + delay);
      chimeGain.gain.linearRampToValueAtTime(0.18 * this.volume, t + delay + 0.015);
      chimeGain.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.2);

      chimeOsc.connect(chimeGain);
      chimeGain.connect(ctx.destination);

      chimeOsc.start(t + delay);
      chimeOsc.stop(t + delay + 0.22);
    });
  }

  /**
   * Sound effect when bread finishes rising back from flat to fluffy!
   */
  public playRestoredPop(): void {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, t);
    osc.frequency.exponentialRampToValueAtTime(620, t + 0.12);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.28 * this.volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.16);
  }
}

export const breadAudio = new BreadAudioManager();
