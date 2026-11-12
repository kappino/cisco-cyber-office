// src/utils/synthwaveBgm.ts
// Procedural Web Audio Synthwave/Chiptune 8-Bit Soundtrack
// 120 BPM D-minor 4-Bar (64 sixteenth-note steps) Looping Engine
// Drift-Free Web Audio Hardware Clock Lookahead Scheduler
// Zero external audio files or dependencies!

export interface IBgmEngine {
  init(ctx: AudioContext, destination: AudioNode): void;
  start(): void;
  stop(): void;
  get active(): boolean;
  isPlaying(): boolean;
}

const BPM = 120;
const SECONDS_PER_BEAT = 60.0 / BPM; // 0.500s
const SECONDS_PER_STEP = SECONDS_PER_BEAT / 4; // 0.125s (16th note)
const TOTAL_STEPS = 64; // 4 bars * 16 steps

// Note frequency map (Equal temperament, A4 = 440 Hz)
const A1 = 55.00, Bb1 = 58.27, C2 = 65.41, Csharp2 = 69.30, D2 = 73.42, E2 = 82.41, F2 = 87.31, G2 = 98.00;
const A2 = 110.00, Bb2 = 116.54, C3 = 130.81, D3 = 146.83, E3 = 164.81, F3 = 174.61, G3 = 196.00;
const A3 = 220.00, Bb3 = 233.08, B3 = 246.94, C4 = 261.63, D4 = 293.66, E4 = 329.63, F4 = 349.23, G4 = 392.00;
const A4 = 440.00, Bb4 = 466.16, C5 = 523.25, Csharp5 = 554.37, D5 = 587.33, E5 = 659.25, F5 = 698.46, G5 = 783.99;

// Voice A: Galloping Saw Bass Pattern (64 steps)
const BASS_PATTERN: number[] = [
  // Bar 1: D minor
  D2, D3, D2, D3,  D2, D3, D2, D3,  D2, D3, D2, D3,  D2, D3, F2, G2,
  // Bar 2: Bb major
  Bb1, Bb2, Bb1, Bb2,  Bb1, Bb2, Bb1, Bb2,  Bb1, Bb2, Bb1, Bb2,  Bb1, Bb2, C2, D2,
  // Bar 3: C major
  C2, C3, C2, C3,  C2, C3, C2, C3,  C2, C3, C2, C3,  C2, C3, D2, E2,
  // Bar 4: A minor / Turnaround
  A1, A2, A1, A2,  A1, A2, A1, A2,  A1, A2, A1, A2,  A1, C2, E2, Csharp2,
];

// Voice B: 16th-Note Chiptune Square Arpeggio Pattern (64 steps)
const ARP_PATTERN: number[] = [
  // Bar 1: Dm
  D4, F4, A4, D5,  F5, D5, A4, F4,  D4, F4, A4, E5,  D5, A4, F4, A4,
  // Bar 2: Bb
  Bb3, D4, F4, Bb4,  D5, Bb4, F4, D4,  Bb3, D4, F4, D5,  F5, D5, Bb4, D5,
  // Bar 3: C
  C4, E4, G4, C5,  E5, C5, G4, E4,  C4, E4, G4, E5,  G5, E5, C5, G4,
  // Bar 4: Am
  A3, C4, E4, A4,  C5, A4, E4, C4,  A3, C4, E4, A4,  C5, D5, E5, Csharp5,
];

// Voice C: Drum Triggers
// Kick: 1 = hit
const KICK_PATTERN: number[] = [
  // Bar 1
  1, 0, 0, 0,  1, 0, 0, 0,  1, 0, 0, 0,  1, 0, 0, 0,
  // Bar 2 (syncopated push kick on step 30)
  1, 0, 0, 0,  1, 0, 0, 0,  1, 0, 0, 0,  1, 0, 1, 0,
  // Bar 3
  1, 0, 0, 0,  1, 0, 0, 0,  1, 0, 0, 0,  1, 0, 0, 0,
  // Bar 4
  1, 0, 0, 0,  1, 0, 0, 0,  1, 0, 0, 0,  1, 0, 0, 0,
];

// Snare: 1 = regular snare, 2 = fill snare
const SNARE_PATTERN: number[] = [
  // Bar 1
  0, 0, 0, 0,  1, 0, 0, 0,  0, 0, 0, 0,  1, 0, 0, 0,
  // Bar 2
  0, 0, 0, 0,  1, 0, 0, 0,  0, 0, 0, 0,  1, 0, 0, 0,
  // Bar 3
  0, 0, 0, 0,  1, 0, 0, 0,  0, 0, 0, 0,  1, 0, 0, 0,
  // Bar 4 (end-of-loop fill)
  0, 0, 0, 0,  1, 0, 0, 0,  0, 0, 0, 0,  1, 0, 2, 2,
];

// Voice D: Warm Pad Chords (Triggered at step 0, 16, 32, 48)
const PAD_CHORDS: { step: number; notes: number[] }[] = [
  { step: 0, notes: [D3, F3, A3, C4] },     // Dm7
  { step: 16, notes: [Bb2, D3, F3, A3] },   // Bbmaj7
  { step: 32, notes: [C3, E3, G3, B3] },    // Cmaj7
  { step: 48, notes: [A2, C3, E3, G3] },    // Am7
];

export class SynthwaveBgmEngine implements IBgmEngine {
  private ctx: AudioContext | null = null;
  private outputNode: GainNode | null = null;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private isRunning: boolean = false;
  private currentStep: number = 0;
  private nextStepTime: number = 0;
  private noiseBuffer: AudioBuffer | null = null;

  public init(ctx: AudioContext, destination: AudioNode): void {
    this.ctx = ctx;
    this.outputNode = ctx.createGain();
    this.outputNode.gain.setValueAtTime(0.30, ctx.currentTime);
    this.outputNode.connect(destination);

    // Pre-allocate 1.0s white noise buffer for drums
    const bufferSize = Math.floor(ctx.sampleRate * 1.0);
    this.noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  public start(): void {
    if (this.isRunning || !this.ctx || !this.outputNode) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    this.isRunning = true;
    this.currentStep = 0;
    this.nextStepTime = this.ctx.currentTime + 0.05;

    // Dual-clock lookahead scheduler: check every 25ms
    this.timerId = setInterval(() => this.scheduleTick(), 25);
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  public get active(): boolean {
    return this.isRunning;
  }

  public isPlaying(): boolean {
    return this.isRunning;
  }

  private scheduleTick(): void {
    if (!this.ctx || !this.outputNode || !this.isRunning) return;

    // If tab suspension or thread contention caused clock drift, catch up cleanly
    if (this.nextStepTime < this.ctx.currentTime) {
      this.nextStepTime = this.ctx.currentTime + 0.01;
    }

    // Lookahead window: schedule events within 100ms
    const scheduleAheadTime = 0.100;
    while (this.nextStepTime < this.ctx.currentTime + scheduleAheadTime) {
      this.scheduleStep(this.currentStep, this.nextStepTime);
      this.nextStepTime += SECONDS_PER_STEP;
      this.currentStep = (this.currentStep + 1) % TOTAL_STEPS;
    }
  }

  private scheduleStep(step: number, time: number): void {
    if (!this.ctx || !this.outputNode) return;

    // 1. Voice A: Galloping Bass
    this.playBassNote(BASS_PATTERN[step], time);

    // 2. Voice B: Chiptune Square Arpeggio
    this.playArpNote(ARP_PATTERN[step], time);

    // 3. Voice C: Drum Kit
    if (KICK_PATTERN[step]) {
      this.playKick(time);
    }
    const snareType = SNARE_PATTERN[step];
    if (snareType > 0) {
      this.playSnare(time, snareType === 2 ? 0.20 : 0.26);
    }
    // Hi-hat: on all 16ths, accented on off-beats
    const isAccent = step % 4 === 2;
    this.playHiHat(time, isAccent ? 0.045 : 0.022);

    // 4. Voice D: Warm Pad Chord (at bar start)
    const padChord = PAD_CHORDS.find(p => p.step === step);
    if (padChord) {
      this.playPadChord(padChord.notes, time, SECONDS_PER_STEP * 16);
    }
  }

  private playBassNote(freq: number, time: number): void {
    if (!this.ctx || !this.outputNode) return;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    // Resonant lowpass filter sweep (Juno/Moog style)
    filter.type = 'lowpass';
    filter.Q.setValueAtTime(4.2, time);
    filter.frequency.setValueAtTime(1500, time);
    filter.frequency.exponentialRampToValueAtTime(320, time + 0.08);

    // Staccato envelope with punchy transient
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.24, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.105);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.outputNode);

    osc.start(time);
    osc.stop(time + 0.11);
  }

  private playArpNote(freq: number, time: number): void {
    if (!this.ctx || !this.outputNode) return;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const panner = typeof this.ctx.createStereoPanner === 'function' ? this.ctx.createStereoPanner() : null;
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(4600, time);

    if (panner) {
      panner.pan.setValueAtTime(0.22, time); // Subtle right pan for stereo separation
    }

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.09, time + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.075);

    osc.connect(filter);
    if (panner) {
      filter.connect(panner);
      panner.connect(gain);
    } else {
      filter.connect(gain);
    }
    gain.connect(this.outputNode);

    osc.start(time);
    osc.stop(time + 0.08);
  }

  private playKick(time: number): void {
    if (!this.ctx || !this.outputNode) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(38, time + 0.07);

    gain.gain.setValueAtTime(0.36, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.11);

    osc.connect(gain);
    gain.connect(this.outputNode);

    osc.start(time);
    osc.stop(time + 0.11);
  }

  private playSnare(time: number, volume: number): void {
    if (!this.ctx || !this.outputNode || !this.noiseBuffer) return;

    // Snare tone body
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, time);
    osc.frequency.exponentialRampToValueAtTime(65, time + 0.06);
    oscGain.gain.setValueAtTime(volume * 0.7, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.07);

    osc.connect(oscGain);
    oscGain.connect(this.outputNode);
    osc.start(time);
    osc.stop(time + 0.07);

    // Snare noise snap
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = this.noiseBuffer;
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1800, time);
    noiseFilter.Q.setValueAtTime(1.4, time);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(volume, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.13);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.outputNode);

    noiseSource.start(time);
    noiseSource.stop(time + 0.13);
  }

  private playHiHat(time: number, volume: number): void {
    if (!this.ctx || !this.outputNode || !this.noiseBuffer) return;

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7400, time);
    filter.Q.setValueAtTime(2.0, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(this.outputNode);

    noiseSource.start(time);
    noiseSource.stop(time + 0.035);
  }

  private playPadChord(notes: number[], time: number, duration: number): void {
    if (!this.ctx || !this.outputNode) return;

    notes.forEach((freq) => {
      if (!this.ctx || !this.outputNode) return;

      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(750, time);
      filter.Q.setValueAtTime(0.9, time);

      // Smooth swelling pad envelope
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.045, time + 0.25);
      gain.gain.setValueAtTime(0.045, time + duration - 0.30);
      gain.gain.linearRampToValueAtTime(0.001, time + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.outputNode);

      osc.start(time);
      osc.stop(time + duration);
    });
  }
}

export const synthwaveBgm = new SynthwaveBgmEngine();
