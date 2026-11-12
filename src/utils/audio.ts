// src/utils/audio.ts
// Web Audio API Retro 8-bit Sound Synthesizer & Audio Routing Bus
// Completely standalone, zero external audio asset dependencies!

import { synthwaveBgm, IBgmEngine } from './synthwaveBgm';

export type { IBgmEngine };
type MuteListener = (isMuted: boolean) => void;

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGainNode: GainNode | null = null;
  private bgmGainNode: GainNode | null = null;
  private sfxGainNode: GainNode | null = null;

  public isMuted: boolean = false;
  private masterVolume: number = 0.85;
  private bgmVolume: number = 0.30;
  private sfxVolume: number = 0.75;

  private gestureUnlocked: boolean = false;
  private bgmEngine: IBgmEngine = synthwaveBgm;
  private muteListeners: Set<MuteListener> = new Set();
  private noiseBuffer: AudioBuffer | null = null;
  private lastFootstepTime: number = 0;
  private muteSessionId: number = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      this.isMuted = localStorage.getItem('cisco_sound_muted') === 'true';
      this.attachGestureUnlock();
    }
  }

  /**
   * Safe AudioContext initialization with complete routing topology:
   * [BGM Voices] -> bgmGainNode \
   *                             +-> masterGainNode -> ctx.destination
   * [SFX Voices] -> sfxGainNode /
   */
  public initCtx(): void {
    if (typeof window === 'undefined') return;

    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.setupRoutingGraph();
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {
        // Safe catch: browser autoplay policy will resume context on first user interaction
      });
    }

    // Pre-generate 0.5s white noise buffer for footsteps and steam
    if (this.ctx && !this.noiseBuffer) {
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.5);
      this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const channel = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        channel[i] = Math.random() * 2 - 1;
      }
    }
  }

  private setupRoutingGraph(): void {
    if (!this.ctx) return;

    // 1. Master Gain Node -> Destination
    this.masterGainNode = this.ctx.createGain();
    const initialMaster = this.isMuted ? 0.0 : this.masterVolume;
    this.masterGainNode.gain.value = initialMaster;
    this.masterGainNode.gain.setValueAtTime(initialMaster, this.ctx.currentTime);
    this.masterGainNode.connect(this.ctx.destination);

    // 2. BGM Channel Gain Node -> Master Gain Node
    this.bgmGainNode = this.ctx.createGain();
    this.bgmGainNode.gain.value = this.bgmVolume;
    this.bgmGainNode.gain.setValueAtTime(this.bgmVolume, this.ctx.currentTime);
    this.bgmGainNode.connect(this.masterGainNode);

    // 3. SFX Channel Gain Node -> Master Gain Node
    this.sfxGainNode = this.ctx.createGain();
    this.sfxGainNode.gain.value = this.sfxVolume;
    this.sfxGainNode.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    this.sfxGainNode.connect(this.masterGainNode);

    // Initialize BGM Engine with BGM gain bus
    this.bgmEngine.init(this.ctx, this.bgmGainNode);
  }

  /**
   * One-time global user gesture unlock listener.
   * Resumes AudioContext safely on first pointerdown, keydown, or touchstart.
   */
  private attachGestureUnlock(): void {
    const unlockEvents = ['pointerdown', 'keydown', 'touchstart'];
    const unlockHandler = () => {
      if (this.gestureUnlocked) return;
      this.gestureUnlocked = true;

      unlockEvents.forEach(evt => {
        window.removeEventListener(evt, unlockHandler, true);
      });

      this.resumeContext().then(running => {
        if (running && !this.isMuted) {
          this.startBgm();
        }
      });
    };

    unlockEvents.forEach(evt => {
      window.addEventListener(evt, unlockHandler, { capture: true, once: true, passive: true });
    });
  }

  /**
   * Resumes AudioContext safely without unhandled promise rejections.
   */
  public async resumeContext(): Promise<boolean> {
    this.initCtx();
    if (!this.ctx) return false;

    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
        return true;
      } catch {
        return false;
      }
    }
    return this.ctx.state === 'running';
  }

  /**
   * Pop-free gain ramping using cancellation and linear interpolation.
   */
  private rampGain(node: GainNode | null, targetValue: number, rampTimeSec: number = 0.04): void {
    if (!node || !this.ctx) return;
    const now = this.ctx.currentTime;
    node.gain.cancelScheduledValues(now);
    node.gain.setValueAtTime(node.gain.value, now);
    node.gain.linearRampToValueAtTime(targetValue, now + rampTimeSec);
  }

  /**
   * Mute subscription mechanism for UI HUD synchronization.
   */
  public subscribeMute(listener: MuteListener): () => void {
    this.muteListeners.add(listener);
    return () => {
      this.muteListeners.delete(listener);
    };
  }

  private notifyMute(muted: boolean): void {
    this.muteListeners.forEach(listener => {
      try {
        listener(muted);
      } catch (e) {
        console.error('Audio listener error:', e);
      }
    });
  }

  /**
   * Toggle mute synchronously across Master Gain, BGM sequencer, and SFX.
   */
  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    const currentSession = ++this.muteSessionId;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('cisco_sound_muted', String(this.isMuted));
    }

    this.initCtx();

    if (this.isMuted) {
      this.rampGain(this.masterGainNode, 0.0, 0.04);
      this.stopBgm();
    } else {
      this.resumeContext().then(() => {
        if (this.isMuted || this.muteSessionId !== currentSession) return;
        this.rampGain(this.masterGainNode, this.masterVolume, 0.04);
        this.startBgm();
        this.playClick();
      });
    }

    this.notifyMute(this.isMuted);
    return this.isMuted;
  }

  public registerBgmEngine(engine: IBgmEngine): void {
    this.bgmEngine = engine;
    if (!this.isMuted && this.ctx && this.ctx.state === 'running') {
      this.startBgm();
    }
  }

  public startBgm(): void {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx || !this.bgmGainNode) return;
    if (!this.bgmEngine.active) {
      this.bgmEngine.start();
    }
  }

  public stopBgm(): void {
    if (this.bgmEngine) {
      this.bgmEngine.stop();
    }
  }

  public getBgmEngine(): IBgmEngine {
    return this.bgmEngine;
  }

  public getContext(): AudioContext | null {
    this.initCtx();
    return this.ctx;
  }

  public getMasterNode(): GainNode | null {
    this.initCtx();
    return this.masterGainNode;
  }

  public getBgmNode(): GainNode | null {
    this.initCtx();
    return this.bgmGainNode;
  }

  public getSfxNode(): GainNode | null {
    this.initCtx();
    return this.sfxGainNode;
  }

  private getSfxDestination(): AudioNode {
    return this.sfxGainNode || (this.ctx ? this.ctx.destination : null) as unknown as AudioNode;
  }

  // ==========================================
  // TACTILE SFX SUITE
  // ==========================================

  /**
   * Dual-transient IBM Model M mechanical click
   * 3200Hz buckling spring snap + 200Hz keycap bottoming thud
   */
  public playMechanicalKey(): void {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const dest = this.getSfxDestination();
    if (!dest) return;
    const now = this.ctx.currentTime;

    // Subtle pitch jitter for organic mechanical variance
    const snapJitter = 0.97 + Math.random() * 0.06;
    const thudJitter = 0.95 + Math.random() * 0.10;

    // Transient 1: Spring Buckling Snap (3200Hz peak)
    const snapOsc = this.ctx.createOscillator();
    const snapGain = this.ctx.createGain();
    snapOsc.type = 'triangle';
    snapOsc.frequency.setValueAtTime(3200 * snapJitter, now);
    snapOsc.frequency.exponentialRampToValueAtTime(2400, now + 0.012);

    snapGain.gain.setValueAtTime(0.18, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);

    snapOsc.connect(snapGain);
    snapGain.connect(dest);
    snapOsc.start(now);
    snapOsc.stop(now + 0.015);

    // Transient 2: Keycap Bottoming Thud (200Hz body with ~4ms strike delay)
    const thudDelay = 0.004;
    const thudOsc = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();
    thudOsc.type = 'sine';
    thudOsc.frequency.setValueAtTime(200 * thudJitter, now + thudDelay);
    thudOsc.frequency.exponentialRampToValueAtTime(130, now + thudDelay + 0.035);

    thudGain.gain.setValueAtTime(0.22, now + thudDelay);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + thudDelay + 0.035);

    thudOsc.connect(thudGain);
    thudGain.connect(dest);
    thudOsc.start(now + thudDelay);
    thudOsc.stop(now + thudDelay + 0.035);
  }

  /**
   * Soft futuristic two-tone cyber alert (720Hz / 880Hz)
   */
  public playCyberAlarm(): void {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const dest = this.getSfxDestination();
    if (!dest) return;
    const now = this.ctx.currentTime;

    // Tone 1: 720 Hz (F#5)
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(720, now);

    gain1.gain.setValueAtTime(0.01, now);
    gain1.gain.linearRampToValueAtTime(0.12, now + 0.015);
    gain1.gain.exponentialRampToValueAtTime(0.005, now + 0.11);

    osc1.connect(gain1);
    gain1.connect(dest);
    osc1.start(now);
    osc1.stop(now + 0.11);

    // Tone 2: 880 Hz (A5)
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.11);

    gain2.gain.setValueAtTime(0.01, now + 0.11);
    gain2.gain.linearRampToValueAtTime(0.15, now + 0.125);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

    osc2.connect(gain2);
    gain2.connect(dest);
    osc2.start(now + 0.11);
    osc2.stop(now + 0.32);
  }

  /**
   * Subtle filtered noise tap during walking cadence
   */
  public playFootstep(alternate: boolean = false): void {
    if (this.isMuted) return;
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (nowMs - this.lastFootstepTime < 130) return; // rate limit stride
    this.lastFootstepTime = nowMs;

    this.initCtx();
    if (!this.ctx || !this.noiseBuffer) return;

    const dest = this.getSfxDestination();
    if (!dest) return;
    const now = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(alternate ? 850 : 720, now);
    filter.Q.setValueAtTime(1.2, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    const offset = Math.random() * 0.4;
    src.start(now, offset, 0.035);
  }

  /**
   * Enhanced bubbling espresso sound with steam hiss overlay
   */
  public playCoffee(): void {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const dest = this.getSfxDestination();
    if (!dest) return;
    const now = this.ctx.currentTime;

    // Bubbling espresso droplets
    for (let i = 0; i < 4; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400 + Math.random() * 300, now + i * 0.06);
      osc.frequency.exponentialRampToValueAtTime(150, now + i * 0.06 + 0.05);

      gain.gain.setValueAtTime(0.12, now + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.06 + 0.05);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.05);
    }

    // Steam hiss overlay
    if (this.noiseBuffer) {
      const steamSrc = this.ctx.createBufferSource();
      steamSrc.buffer = this.noiseBuffer;

      const steamFilter = this.ctx.createBiquadFilter();
      steamFilter.type = 'bandpass';
      steamFilter.frequency.setValueAtTime(2200, now);
      steamFilter.Q.setValueAtTime(1.0, now);

      const steamGain = this.ctx.createGain();
      steamGain.gain.setValueAtTime(0.05, now);
      steamGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      steamSrc.connect(steamFilter);
      steamFilter.connect(steamGain);
      steamGain.connect(dest);
      steamSrc.start(now, 0, 0.28);
    }
  }

  // ==========================================
  // PRESERVED & BALANCED EXISTING SFX
  // ==========================================

  public playClick(): void {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const dest = this.getSfxDestination();
    if (!dest) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.16, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(dest);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  public playCableSnap(): void {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const dest = this.getSfxDestination();
    if (!dest) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(240, this.ctx.currentTime);
    osc.frequency.setValueAtTime(780, this.ctx.currentTime + 0.03);
    osc.frequency.setValueAtTime(1200, this.ctx.currentTime + 0.06);

    gain.gain.setValueAtTime(0.22, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(dest);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  public playSuccess(): void {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const dest = this.getSfxDestination();
    if (!dest) return;

    const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = this.ctx.currentTime + idx * 0.09;

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.18, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(startTime);
      osc.stop(startTime + 0.15);
    });
  }

  public playError(): void {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const dest = this.getSfxDestination();
    if (!dest) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, this.ctx.currentTime);
    osc.frequency.setValueAtTime(120, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.22, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(dest);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  public playAlert(): void {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const dest = this.getSfxDestination();
    if (!dest) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(1200, this.ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.18);

    osc.connect(gain);
    gain.connect(dest);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.18);
  }

  public playElevator(): void {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const dest = this.getSfxDestination();
    if (!dest) return;

    const now = this.ctx.currentTime;
    // Chime ding: 587.33 Hz (D5) -> 880 Hz (A5)
    [587.33, 880].forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + idx * 0.18;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.20, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  public playPacketSniff(): void {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const dest = this.getSfxDestination();
    if (!dest) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(950, now);
    osc.frequency.exponentialRampToValueAtTime(450, now + 0.06);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.06);
  }
}

export const sound = new SoundEngine();
