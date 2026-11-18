export class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private lastStepDist = 0;
  private lastSlideTime = 0;
  private footstepAlternate = false;

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted && this.ctx && this.ctx.state === 'running') {
      void this.ctx.suspend().catch(() => {});
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') {
      return null;
    }
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Tactile woodblock stamp registration lock sound.
   * Multi-layered: sharp mechanical contact click + warm wooden acoustic body resonance.
   */
  public playStampLock(isHazard = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (isHazard) {
      // Jarring dissonant buzzer clash for hazardous connection
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'square';
      osc1.frequency.setValueAtTime(148, now);
      osc2.frequency.setValueAtTime(156, now);
      osc1.frequency.exponentialRampToValueAtTime(82, now + 0.22);
      osc2.frequency.exponentialRampToValueAtTime(78, now + 0.22);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.25);
      osc2.stop(now + 0.25);
    } else {
      // Safe mark: sharp registration pin latch + resonant woodblock stamp thud
      // 1. High transient latch click
      const clickOsc = ctx.createOscillator();
      const clickGain = ctx.createGain();
      clickOsc.type = 'triangle';
      clickOsc.frequency.setValueAtTime(540, now);
      clickOsc.frequency.exponentialRampToValueAtTime(860, now + 0.04);
      clickGain.gain.setValueAtTime(0.14, now);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      clickOsc.connect(clickGain);
      clickGain.connect(ctx.destination);
      clickOsc.start(now);
      clickOsc.stop(now + 0.07);

      // 2. Warm wood body tone
      const bodyOsc = ctx.createOscillator();
      const bodyGain = ctx.createGain();
      bodyOsc.type = 'sine';
      bodyOsc.frequency.setValueAtTime(220, now);
      bodyOsc.frequency.exponentialRampToValueAtTime(330, now + 0.12);
      bodyGain.gain.setValueAtTime(0.16, now);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      bodyOsc.connect(bodyGain);
      bodyGain.connect(ctx.destination);
      bodyOsc.start(now);
      bodyOsc.stop(now + 0.19);
    }
  }

  /**
   * Sound when layers move out of registration tolerance.
   * Subtle paper peeling release whoosh.
   */
  public playDisconnect(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.11);
    gain.gain.setValueAtTime(0.065, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  /**
   * Physical paper friction slide sound filtered by velocity.
   */
  public playPaperSlide(speedPx: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - this.lastSlideTime < 0.065 || speedPx < 2.5) {
      return;
    }
    this.lastSlideTime = now;

    const duration = 0.06;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = Math.min(2600, 850 + speedPx * 28);
    filter.Q.value = 1.4;

    const gain = ctx.createGain();
    gain.gain.value = Math.min(0.05, 0.015 + speedPx * 0.0012);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  }

  /**
   * Dot's rhythmic courier footsteps on paper/board with subtle alternating heel-toe pitch.
   */
  public maybePlayFootstep(walkDistance: number): void {
    if (walkDistance - this.lastStepDist < 26) {
      return;
    }
    this.lastStepDist = walkDistance;
    this.footstepAlternate = !this.footstepAlternate;

    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const baseFreq = this.footstepAlternate ? 152 : 138;
    const pitchJitter = 0.96 + Math.random() * 0.08;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq * pitchJitter, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.04);

    gain.gain.setValueAtTime(0.038, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  public resetStepTracker(walkDistance = 0): void {
    this.lastStepDist = walkDistance;
  }

  /**
   * Dot landing after a fall or step-down.
   */
  public playLanding(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(175, now);
    osc.frequency.exponentialRampToValueAtTime(58, now + 0.095);

    gain.gain.setValueAtTime(0.095, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.105);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.115);
  }

  /**
   * Tape rewind / state reversal sound.
   */
  public playRewind(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.12);

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  /**
   * Sound played when Dot reaches the goal postbox and delivers the parcel.
   * Satisfying postal mail-drop thunk + brass bell ring.
   */
  public playParcelDelivered(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Mail slot drop latch
    const latchOsc = ctx.createOscillator();
    const latchGain = ctx.createGain();
    latchOsc.type = 'square';
    latchOsc.frequency.setValueAtTime(280, now);
    latchOsc.frequency.exponentialRampToValueAtTime(140, now + 0.07);
    latchGain.gain.setValueAtTime(0.08, now);
    latchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    latchOsc.connect(latchGain);
    latchGain.connect(ctx.destination);
    latchOsc.start(now);
    latchOsc.stop(now + 0.09);

    // 2. Brass bell ring
    const bellOsc = ctx.createOscillator();
    const bellGain = ctx.createGain();
    bellOsc.type = 'triangle';
    bellOsc.frequency.setValueAtTime(880, now + 0.04);
    bellOsc.frequency.exponentialRampToValueAtTime(1320, now + 0.09);
    bellGain.gain.setValueAtTime(0.12, now + 0.04);
    bellGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    bellOsc.connect(bellGain);
    bellGain.connect(ctx.destination);
    bellOsc.start(now + 0.04);
    bellOsc.stop(now + 0.36);
  }

  /**
   * Victorian letterpress victory chime.
   * Harmonic triad ringing out warm resonance.
   */
  public playVictory(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    this.playParcelDelivered();

    const notes = [349.23, 440.0, 523.25, 698.46, 880.0]; // F4, A4, C5, F5, A5
    const now = ctx.currentTime + 0.1;

    notes.forEach((freq, idx) => {
      const start = now + idx * 0.075;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.095, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.42);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.44);
    });
  }

  /**
   * Sound played on level failure (slipped off sheet, ink spill, roller collision).
   */
  public playFailure(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const notes = [220, 155, 110];
    const now = ctx.currentTime;
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.085;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.68, start + 0.18);
      gain.gain.setValueAtTime(0.085, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.22);
    });
  }

  public destroy(): void {
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
