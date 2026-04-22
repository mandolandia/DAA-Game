/**
 * Audio sintetizado vía Web Audio API — sin archivos externos.
 * Todo se inicializa sólo tras una interacción del usuario (iOS fix).
 */
export class Audio {
  private ctx: AudioContext | null = null;
  private muzakGain: GainNode | null = null;
  private muzakTimer = 0;
  private stepTimer = 0;

  resume() {
    if (!this.ctx) {
      const AC =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  }

  /** Tintineo dorado al recoger pin. */
  tintineo() {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const tones = [880, 1320, 1760];
    tones.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = i === 0 ? "sine" : "triangle";
      osc.frequency.value = f;
      osc.connect(g);
      g.connect(ctx.destination);
      const start = t + i * 0.05;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.15 / (i + 1), start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.9);
      osc.start(start);
      osc.stop(start + 1.0);
    });
    // "coro" distante
    const noise = ctx.createOscillator();
    const ng = ctx.createGain();
    noise.type = "sine";
    noise.frequency.value = 220;
    noise.detune.value = -8;
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 1200;
    noise.connect(filt);
    filt.connect(ng);
    ng.connect(ctx.destination);
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(0.05, t + 0.15);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    noise.start(t);
    noise.stop(t + 1.3);
  }

  /** Click de confirmación burocrática. */
  click() {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 1400;
    osc.connect(g);
    g.connect(ctx.destination);
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  /** Pasito grave del agente. */
  footstep() {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.1);
    osc.connect(g);
    g.connect(ctx.destination);
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.start(t);
    osc.stop(t + 0.14);
  }

  /** Loop de muzak institucional: progresión tonal simple con tempo lento. */
  startMuzak() {
    const ctx = this.ctx;
    if (!ctx || this.muzakGain) return;
    const master = ctx.createGain();
    master.gain.value = 0.04;
    master.connect(ctx.destination);
    this.muzakGain = master;

    const scheduleNote = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const filt = ctx.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = 1400;
      osc.connect(filt);
      filt.connect(g);
      g.connect(master);
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.5, start + 0.05);
      g.gain.setValueAtTime(0.5, start + dur - 0.1);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.start(start);
      osc.stop(start + dur + 0.05);
    };

    // Pequeña melodía (Fmaj7 soñador) repetida
    const base = 220; // A3
    const pattern = [
      [0, 0, 1.0],
      [3, 1.0, 1.0],
      [7, 2.0, 1.0],
      [10, 3.0, 1.2],
      [7, 4.2, 0.8],
      [3, 5.0, 1.0],
    ];
    const scheduleLoop = (startAt: number) => {
      for (const [semi, off, dur] of pattern) {
        const f = base * Math.pow(2, (semi as number) / 12);
        scheduleNote(f, startAt + (off as number), dur as number);
      }
      // Bass nota grave
      const bass = ctx.createOscillator();
      const bg = ctx.createGain();
      bass.type = "sine";
      bass.frequency.value = 110;
      bass.connect(bg);
      bg.connect(master);
      bg.gain.setValueAtTime(0, startAt);
      bg.gain.linearRampToValueAtTime(0.4, startAt + 0.1);
      bg.gain.setValueAtTime(0.4, startAt + 5.8);
      bg.gain.exponentialRampToValueAtTime(0.0001, startAt + 6);
      bass.start(startAt);
      bass.stop(startAt + 6.1);
    };

    // Schedule primer bucle y un timer para los siguientes
    const now = ctx.currentTime + 0.1;
    scheduleLoop(now);
    const loopLen = 6.2;
    this.muzakTimer = 0;
    // Usar setInterval en tiempo real
    const iv = setInterval(() => {
      if (!this.muzakGain) {
        clearInterval(iv);
        return;
      }
      scheduleLoop(ctx.currentTime + 0.1);
    }, loopLen * 1000);
  }

  /** Llamar cada frame con la velocidad escalar para generar pasos. */
  stepTick(dt: number, speed: number, running: boolean) {
    if (!this.ctx) return;
    if (speed < 0.2) {
      this.stepTimer = 0.2;
      return;
    }
    this.stepTimer -= dt;
    const interval = running ? 0.3 : 0.45;
    if (this.stepTimer <= 0) {
      this.footstep();
      this.stepTimer = interval;
    }
  }

  /** Campana de cierre de turno (final). */
  campana() {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    [330, 220, 165].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      osc.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0, t + i * 0.15);
      g.gain.linearRampToValueAtTime(0.2, t + i * 0.15 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.15 + 2.5);
      osc.start(t + i * 0.15);
      osc.stop(t + i * 0.15 + 2.6);
    });
  }
}
