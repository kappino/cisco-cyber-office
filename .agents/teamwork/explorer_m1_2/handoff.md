# Handoff Report: Web Audio Routing Graph & HUD Synchronization (Milestone 1 / R4)

## 1. Observation

### 1.1 Current Audio Implementation (`src/utils/audio.ts`)
- **Direct Destination Connection**:
  In `src/utils/audio.ts:48-50` (and repeated in every SFX method: `playCableSnap`, `playSuccess`, `playError`, `playAlert`, `playCoffee`, `playElevator`, `playPacketSniff`):
  ```typescript
  osc.connect(gain);
  gain.connect(this.ctx.destination);
  ```
  Sound generators connect directly to `this.ctx.destination`. There are no intermediate buses (`masterGainNode`, `bgmGainNode`, `sfxGainNode`).
- **Autoplay Rejection Vulnerability**:
  In `src/utils/audio.ts:19-21`:
  ```typescript
  if (this.ctx && this.ctx.state === 'suspended') {
    this.ctx.resume();
  }
  ```
  `this.ctx.resume()` returns a `Promise<void>`. It is invoked without `.catch()` or `await`. In modern browsers (Chromium, WebKit/Safari, Gecko/Firefox) and in automated headless environments (such as Puppeteer in `pipeline/run_qa_suite.mjs`), calling `resume()` before an explicit user gesture rejects with `NotAllowedError`. An unhandled promise rejection triggers `pageerror` and `console.error`, which causes QA Gate 5 (`pipeline/run_qa_suite.mjs:256`) to immediately fail.
- **Instantaneous Gain Truncation (Clicks/Pops)**:
  In `src/utils/audio.ts:24-31`:
  ```typescript
  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    localStorage.setItem('cisco_sound_muted', String(this.isMuted));
    if (!this.isMuted) {
      this.playClick();
    }
    return this.isMuted;
  }
  ```
  Muting merely flips a boolean flag `isMuted`. Active sounds or decay tails (such as the 450ms chime in `playElevator` or arpeggios) are not muted or smoothly faded, and unmuting does not ramp gain.
- **Absence of BGM Sequencer Hooks**:
  `audio.ts` currently lacks `startBgm()`, `stopBgm()`, or any interface for `synthwaveBgm.ts` to plug its audio output bus.

### 1.2 Current HUD Audio Control (`src/components/HabboOffice.tsx`)
- In `src/components/HabboOffice.tsx:58`:
  ```typescript
  const [muted, setMuted] = useState<boolean>(sound.isMuted);
  ```
- In `src/components/HabboOffice.tsx:72-75`:
  ```typescript
  const toggleSound = () => {
    const isNowMuted = sound.toggleMute();
    setMuted(isNowMuted);
  };
  ```
- In `src/components/HabboOffice.tsx:200-208`:
  ```tsx
  {/* Sound Toggle */}
  <button
    onClick={toggleSound}
    className={`p-1.5 rounded-lg border transition ${
      muted ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-cisco-blue/20 text-cisco-blue border-cisco-blue/50'
    }`}
    title={muted ? 'Attiva Audio' : 'Muta Audio'}
  >
    {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
  </button>
  ```
  `HabboOffice.tsx` controls the HUD button using local state `muted`, which is initialized once when mounted. If mute changes externally (e.g. via keyboard shortcut or other screens), `HabboOffice` has no subscription mechanism to re-render reactively.

### 1.3 QA Suite Constraints (`pipeline/run_qa_suite.mjs`)
- `pipeline/run_qa_suite.mjs:98-100`: Gate 1 executes `npm run build` (`tsc -b && vite build`) and requires 0 TypeScript compiler errors.
- `pipeline/run_qa_suite.mjs:111-115`: Puppeteer listens to `console` (error level) and `pageerror`:
  ```javascript
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.toString()));
  ```
- `pipeline/run_qa_suite.mjs:118-119`: LocalStorage is wiped (`localStorage.clear()`) and reloaded before user interaction.
- `pipeline/run_qa_suite.mjs:131-133`: First user interaction occurs when clicking `"HO CAPITO"`.
- `pipeline/run_qa_suite.mjs:256`: `assert(errors.length === 0)` asserts that no console errors or unhandled rejections occurred.

---

## 2. Logic Chain

1. **Routing Graph Architecture**:
   - Web Audio API uses a directed graph from audio source nodes to destination sinks.
   - To separately control BGM and SFX volume while maintaining a global master volume and mute cutoff, the signal flow must be:
     `[BGM voices] -> bgmGainNode \`
     `                             +-> masterGainNode -> ctx.destination`
     `[SFX voices] -> sfxGainNode /`
   - By attaching `masterGainNode` to `ctx.destination`, modifying `masterGainNode.gain` immediately and completely modulates the total volume without modifying individual source parameters.
   - Setting `bgmGainNode.gain = 0.30` ensures the procedural synthwave soundtrack remains ambient and non-intrusive. Setting `sfxGainNode.gain = 0.75` guarantees that tactile UI clicks, keyboard clacks, and cyber alarms cut through clearly.

2. **De-zippering / Click-Free Ramping**:
   - Digital audio waveform truncation creates high-frequency impulse noise ("clicks" or "pops").
   - By scheduling linear ramps via `masterGainNode.gain.cancelScheduledValues(now)` followed by `setValueAtTime(currentGain, now)` and `linearRampToValueAtTime(targetGain, now + 0.04)`, audio transitions complete smoothly in 40 milliseconds with zero audible discontinuities.

3. **Safe Cross-Browser Autoplay & Lifecycle**:
   - Chromium, WebKit, and Gecko restrict audio playback prior to user interaction.
   - Attaching one-time listeners (`pointerdown`, `keydown`, `touchstart`) on `window` captures the first user gesture anywhere on the page (including the "HO CAPITO" button in Gate 2).
   - Wrapping every `ctx.resume()` invocation with `.catch(() => {})` prevents unhandled promise rejections, safeguarding Puppeteer QA Gate 5 against premature aborts.
   - If `ctx.state === 'closed'`, the engine cleanly recreates `ctx` and its routing graph.

4. **HUD Audio Synchronization**:
   - `HabboOffice.tsx` should subscribe to `sound.subscribeMute((muted) => setMuted(muted))` upon mounting.
   - `toggleMute()` toggles `sound.isMuted`, persists the boolean to `localStorage.setItem('cisco_sound_muted', ...)`, executes the 40ms volume ramp, notifies subscribers, and starts or stops the BGM sequencer.
   - When unmuting, `playClick()` is invoked to provide immediate auditory feedback confirming audio is restored.

---

## 3. Caveats

1. **No External Sound Files**: Web Audio API synthesis must remain 100% procedural. No external `.mp3`, `.wav`, or `.ogg` files may be introduced.
2. **Coexistence with `synthwaveBgm.ts`**: The BGM sequencer is being investigated by `explorer_m1_1`. The interface between `audio.ts` and `synthwaveBgm.ts` must be cleanly decoupled via an interface (`IBgmEngine` or `synthwaveBgm.start(ctx, destination)`).
3. **Coexistence with SFX implementations**: `playMechanicalKey()`, `playCyberAlarm()`, and `playFootstep()` are being specified by `explorer_m1_3`. All SFX generator methods in `audio.ts` must route to `this.sfxGainNode` rather than `this.ctx.destination`.
4. **Volume Levels**: Default calibration values are Master: 0.85, BGM: 0.30, SFX: 0.75. These can be adjusted via exposed setters if dynamic volume sliders are introduced in future milestones.

---

## 4. Conclusion & Implementation Blueprint

### 4.1 Implementation Blueprint for `src/utils/audio.ts`

```typescript
// Web Audio API Retro 8-bit Sound Synthesizer & Audio Routing Bus
// Completely standalone, zero external audio asset dependencies!

export interface IBgmEngine {
  start(ctx: AudioContext, destination: AudioNode): void;
  stop(): void;
  pause(): void;
  resume(): void;
  isPlaying(): boolean;
}

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
  private bgmEngine: IBgmEngine | null = null;
  private muteListeners: Set<MuteListener> = new Set();

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
        // Safe catch: autoplay restrictions handle resume via first user gesture
      });
    }
  }

  private setupRoutingGraph(): void {
    if (!this.ctx) return;

    // 1. Master Gain Node -> Destination
    this.masterGainNode = this.ctx.createGain();
    const initialMaster = this.isMuted ? 0.0 : this.masterVolume;
    this.masterGainNode.gain.setValueAtTime(initialMaster, this.ctx.currentTime);
    this.masterGainNode.connect(this.ctx.destination);

    // 2. BGM Channel Gain Node -> Master Gain Node
    this.bgmGainNode = this.ctx.createGain();
    this.bgmGainNode.gain.setValueAtTime(this.bgmVolume, this.ctx.currentTime);
    this.bgmGainNode.connect(this.masterGainNode);

    // 3. SFX Channel Gain Node -> Master Gain Node
    this.sfxGainNode = this.ctx.createGain();
    this.sfxGainNode.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    this.sfxGainNode.connect(this.masterGainNode);
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
   * Resumes the AudioContext safely without unhandled promise rejections.
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
      try { listener(muted); } catch (e) { console.error('Audio listener error:', e); }
    });
  }

  /**
   * Toggle mute synchronously across Master Gain, BGM sequencer, and SFX.
   */
  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    localStorage.setItem('cisco_sound_muted', String(this.isMuted));

    this.initCtx();

    if (this.isMuted) {
      this.rampGain(this.masterGainNode, 0.0, 0.04);
      this.stopBgm();
    } else {
      this.resumeContext().then(() => {
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
    if (this.bgmEngine) {
      this.bgmEngine.start(this.ctx, this.bgmGainNode);
    }
  }

  public stopBgm(): void {
    if (this.bgmEngine) {
      this.bgmEngine.stop();
    }
  }

  public getContext(): AudioContext | null {
    this.initCtx();
    return this.ctx;
  }

  public getBgmNode(): GainNode | null {
    this.initCtx();
    return this.bgmGainNode;
  }

  public getSfxNode(): GainNode | null {
    this.initCtx();
    return this.sfxGainNode;
  }

  // --- SOUND EFFECTS (Routed through sfxGainNode) ---

  private getSfxDestination(): AudioNode {
    return this.sfxGainNode || this.ctx!.destination;
  }

  public playClick() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(this.getSfxDestination());

    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  public playCableSnap() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(240, this.ctx.currentTime);
    osc.frequency.setValueAtTime(780, this.ctx.currentTime + 0.03);
    osc.frequency.setValueAtTime(1200, this.ctx.currentTime + 0.06);

    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(this.getSfxDestination());

    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  public playSuccess() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = this.ctx.currentTime + idx * 0.09;

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);

      osc.connect(gain);
      gain.connect(this.getSfxDestination());

      osc.start(startTime);
      osc.stop(startTime + 0.15);
    });
  }

  public playError() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, this.ctx.currentTime);
    osc.frequency.setValueAtTime(120, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(this.getSfxDestination());

    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  public playAlert() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(1200, this.ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.18);

    osc.connect(gain);
    gain.connect(this.getSfxDestination());

    osc.start();
    osc.stop(this.ctx.currentTime + 0.18);
  }

  public playCoffee() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400 + Math.random() * 300, now + i * 0.06);
      osc.frequency.exponentialRampToValueAtTime(150, now + i * 0.06 + 0.05);

      gain.gain.setValueAtTime(0.12, now + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.06 + 0.05);

      osc.connect(gain);
      gain.connect(this.getSfxDestination());
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.05);
    }
  }

  public playElevator() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    [587.33, 880].forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + idx * 0.18;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

      osc.connect(gain);
      gain.connect(this.getSfxDestination());
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  public playPacketSniff() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(950, now);
    osc.frequency.exponentialRampToValueAtTime(450, now + 0.06);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

    osc.connect(gain);
    gain.connect(this.getSfxDestination());
    osc.start(now);
    osc.stop(now + 0.06);
  }
}

export const sound = new SoundEngine();
```

### 4.2 Implementation Blueprint for `src/components/HabboOffice.tsx`

In `HabboOffice.tsx`:
1. Use subscription hook to maintain HUD sync:
```tsx
import { useEffect, useState } from 'react';
import { sound } from '../utils/audio';

// Inside HabboOffice component:
const [muted, setMuted] = useState<boolean>(() => sound.isMuted);

useEffect(() => {
  // Subscribe to mute events so external or keyboard toggles synchronize immediately
  const unsubscribe = sound.subscribeMute((isMuted) => {
    setMuted(isMuted);
  });
  return unsubscribe;
}, []);

const toggleSound = () => {
  const isNowMuted = sound.toggleMute();
  setMuted(isNowMuted);
};
```

2. HUD button markup (`src/components/HabboOffice.tsx:200-208`):
```tsx
{/* Sound Toggle */}
<button
  onClick={toggleSound}
  className={`p-1.5 rounded-lg border transition ${
    muted ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-cisco-blue/20 text-cisco-blue border-cisco-blue/50'
  }`}
  title={muted ? 'Attiva Audio' : 'Muta Audio'}
>
  {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
</button>
```

---

## 5. Verification Method

1. **Gate 1: TypeScript Build Verification**:
   Execute:
   ```bash
   npm run build
   ```
   **Pass Condition**: 0 TypeScript errors, bundle completed successfully.
2. **Deterministic 5-Gate QA Suite**:
   Execute:
   ```bash
   node pipeline/run_qa_suite.mjs
   ```
   **Pass Condition**:
   - Gate 1 passes with 0 compiler errors.
   - Gate 2 passes without unhandled rejection on page load before "HO CAPITO" is clicked.
   - Gate 3, 4, and 5 pass with 0 layout collisions, 0 overflows, valid canvas pixel buffers, and 0 runtime console errors.
3. **Audio Routing Verification in Browser / DevTools**:
   - Inspect `sound.getContext()`: Confirm `ctx.state === 'running'` after user interaction.
   - Confirm `masterGainNode`, `bgmGainNode`, and `sfxGainNode` are active.
   - Click HUD volume button: Confirm `localStorage.getItem('cisco_sound_muted')` toggles between `'true'` and `'false'`, `masterGainNode.gain.value` ramps smoothly between `0.0` and `0.85` without audio clipping, and the button visual state flips between `VolumeX` and `Volume2`.
