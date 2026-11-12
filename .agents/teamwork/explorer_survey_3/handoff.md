# Handoff Report: Audio System (Procedural Web Audio Synthwave/Chiptune & SFX) and QA Suite Pipeline Verification

**Agent**: explorer_survey_3  
**Date**: 2026-11-12T12:54:30Z  
**Target Milestone**: milestone_1_survey  

---

## 1. Observation

### 1.1 Existing Audio System (`src/utils/audio.ts`)
- **File Path**: `/root/.gemini/antigravity-cli/scratch/cisco-cyber-office/src/utils/audio.ts` (Lines 1–224)
- **Class Architecture**:
  - Class `SoundEngine` instantiated and exported as singleton: `export const sound = new SoundEngine();` (Line 223).
  - Storage persistence: Reads `localStorage.getItem('cisco_sound_muted') === 'true'` (Line 9).
  - AudioContext initialization: `initCtx()` lazily creates `new AudioContext()` or `webkitAudioContext` and resumes if `this.ctx.state === 'suspended'` (Lines 12–22).
  - Mute toggle: `toggleMute()` flips `this.isMuted`, writes to `localStorage`, and calls `this.playClick()` if unmuted (Lines 24–31).
  - Available SFX methods:
    1. `playClick()` (Lines 33–53): Triangle wave 600 Hz -> 120 Hz, 50ms decay.
    2. `playCableSnap()` (Lines 55–76): Square wave 240 Hz -> 780 Hz -> 1200 Hz, 120ms decay.
    3. `playSuccess()` (Lines 78–102): 4-note arpeggio [440, 554.37, 659.25, 880] Hz (A4, C#5, E5, A5), square wave, 150ms per note.
    4. `playError()` (Lines 104–124): Sawtooth wave 180 Hz -> 120 Hz, 250ms decay.
    5. `playAlert()` (Lines 126–146): Sine sweep 800 Hz -> 1200 Hz, 180ms.
    6. `playCoffee()` (Lines 148–170): 4 randomized bubbling sine oscillators (400–700 Hz -> 150 Hz).
    7. `playElevator()` (Lines 172–197): Two sine chime notes [587.33, 880] Hz (D5 -> A5), 450ms.
    8. `playPacketSniff()` (Lines 199–220): Triangle wave 950 Hz -> 450 Hz, 60ms decay.
- **Identified Gaps for Requirement R4**:
  - **No Background Music (BGM)**: There is currently no musical synthesizer, sequencer, or audio loop.
  - **No Mechanical Keyboard Click**: `CrtTerminalGame.tsx` (Line 54) currently calls the standard UI `sound.playClick()`, which sounds like a soft UI button rather than a tactile IBM Model M / mechanical buckling-spring keyboard.
  - **No Soft Cyber Threat Alarm**: In `UmbrellaSocGame.tsx`, ransomware C2 beacon detection (`Lines 104–141`) does not trigger a dedicated cybernetic alarm sound.
  - **No Footstep Sound**: In `IsometricOfficeCanvas.tsx` (Lines 185–212), avatar walking updates position frame-by-frame with zero acoustic feedback.
  - **Unconnected SFX**: `playCoffee()` is implemented in `audio.ts` but never called in `HabboOffice.tsx:handleCoffeeClick()`.

### 1.2 HUD Audio Toggle Button (`src/components/HabboOffice.tsx`)
- **File Path**: `/root/.gemini/antigravity-cli/scratch/cisco-cyber-office/src/components/HabboOffice.tsx`
- **Component State**:
  - Line 58: `const [muted, setMuted] = useState<boolean>(sound.isMuted);`
  - Lines 72–75:
    ```tsx
    const toggleSound = () => {
      const isNowMuted = sound.toggleMute();
      setMuted(isNowMuted);
    };
    ```
- **HUD Button Markup** (Lines 200–208):
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
- **Observation on Synchronization**:
  - The HUD button directly invokes `sound.toggleMute()`.
  - When background music is introduced, `sound.toggleMute()` must control master gain and the BGM scheduler directly, ensuring that clicking this single HUD button synchronously mutes and unmutes both BGM and all SFX.

### 1.3 Build and Tooling Configuration
- **File Paths**:
  - `/root/.gemini/antigravity-cli/scratch/cisco-cyber-office/package.json`
  - `/root/.gemini/antigravity-cli/scratch/cisco-cyber-office/tsconfig.json`
  - `/root/.gemini/antigravity-cli/scratch/cisco-cyber-office/tsconfig.app.json`
- **Build Script**: `npm run build` executes `"tsc -b && vite build"`.
- **TypeScript Strictness**:
  - `strict: true`
  - `noUnusedLocals: true`
  - `noUnusedParameters: true`
  - `noFallthroughCasesInSwitch: true`
  - `noUncheckedSideEffectImports: true`
  - Any unused import or unused parameter causes `tsc -b` to fail immediately.
- **Verification Execution**:
  - Ran `npm run build` in `/root/.gemini/antigravity-cli/scratch/cisco-cyber-office`.
  - Result: Exit code 0, 2539 modules transformed, built in 4.54s with 0 errors.

### 1.4 QA Suite Pipeline Analysis (`pipeline/run_qa_suite.mjs`)
- **File Path**: `/root/.gemini/antigravity-cli/scratch/cisco-cyber-office/pipeline/run_qa_suite.mjs` (267 lines)
- **Execution**: `node pipeline/run_qa_suite.mjs` against `http://localhost:5173/` using `/usr/bin/chromium` via `puppeteer-core`.
- **The 5 Deterministic Gates**:
  1. **Gate 1: TypeScript & Vite Production Build**:
     - Executes `npm run build`. Must exit with code 0.
  2. **Gate 2: Mobile Portrait (412x915) Office Layout & Canvas Integrity**:
     - Viewport: `412x915`.
     - Invariant 1: `horizontalOverflow = docWidth > winWidth` must be false (0px overflow).
     - Invariant 2: Bounding box collisions among `<header>`, `<main>`, `<section>`, `<footer>` must have 0 overlaps > 1px.
     - Invariant 3: Canvas Pixel Integrity via `ctx.getImageData()`: samples every 25th pixel, asserts `nonBlackPixels > totalSampled * 0.25` and `uniqueColors >= 12` color buckets (`${r>>4},${g>>4},${b>>4}`).
     - Clicks button containing `"HO CAPITO"`, verifies free roam invariants.
  3. **Gate 3: Elevator Vertical Transit to Underground Datacenter (-1F)**:
     - Clicks button containing `"Ascensore (-1)"`.
     - Waits 1400ms for avatar walking.
     - Clicks button containing `"SCENDI AL DATACENTER"`.
     - Asserts `document.body.textContent.includes('UNDERGROUND DATACENTER (-1F)')`.
     - Verifies canvas pixel integrity (produced 138 color buckets, passing threshold of >= 12).
  4. **Gate 4: Wireshark DPI Minigame Interaction & Mitigation**:
     - Clicks `"Wireshark DPI"`.
     - Clicks `"APRI CONSOLE WIRESHARK DPI"`.
     - Clicks filter preset `"Minaccia Tunnel DNS"`.
     - Clicks packet table row containing `"EXFIL!"`.
     - Clicks button `"ISOLA TUNNEL DNS & APPLICA ACL"`.
     - Asserts presence of modal text `"ESFILTRAZIONE DNS BLOCCATA!"`.
     - Returns to 1F: Clicks `"TORNA AL DATACENTER"` -> `"Ascensore (1F)"` -> `"RISALI ALL'UFFICIO"`.
     - Asserts `document.body.textContent.includes('UFFICIO OPERATIVO (1F)')`.
  5. **Gate 5: Desktop Widescreen (1920x1080) Layout & Zero Console Errors**:
     - Viewport: `1920x1080`.
     - Verifies 0 horizontal overflow, 0 collisions, canvas valid.
     - Asserts `errors.length === 0`: captures all `console.error` and `pageerror` events across the entire test session. Any unhandled exception or audio autoplay failure fails this gate.
- **QA Suite Execution Results**:
  - `node pipeline/run_qa_suite.mjs` passed 100% across all 5 Gates.
  - `node pipeline/test_full_suite.mjs` (testing all 4 minigames, customizer, skill tree, and badges) also passed 100%.

---

## 2. Logic Chain

1. **Zero External Dependencies Constraint (R4)**:
   - *Observation*: `package.json` contains no audio loader packages, and the project is hosted in strict environments where external `.mp3` or `.ogg` assets can suffer from 404s, CORS, or bundle bloat.
   - *Inference*: BGM and all SFX must be generated 100% procedurally using native Web Audio API nodes (`OscillatorNode`, `GainNode`, `BiquadFilterNode`, `AudioBuffer` for noise generation).

2. **BGM Architecture (Lookahead Scheduler vs Drift)**:
   - *Observation*: Standard `setInterval` or `setTimeout` timers drift due to JavaScript event loop throttling (especially during canvas animation or modal transitions).
   - *Inference*: A dual-tier Web Audio lookahead scheduler is required:
     - JavaScript timer checks every 50ms (`lookaheadInterval`).
     - Schedules all notes falling within `ctx.currentTime + 0.12s` using Web Audio hardware clock (`setValueAtTime`, `linearRampToValueAtTime`).
     - This guarantees sample-accurate 120 BPM playback without tempo jitter or audio stutters.

3. **Musical Composition (90s Arcade Retro Synthwave in D-Minor)**:
   - *Observation*: Original request specifies: "synth bassline, harmonic arpeggio inspired by 90s arcade classics".
   - *Inference*:
     - **Structure**: 4 bars in 4/4 time (64 sixteenth-note steps at 120 BPM = 8.0s per loop).
     - **Chords**: Dm (Bar 1) -> Bb (Bar 2) -> F / C (Bar 3) -> C / Am (Bar 4).
     - **Layer 1: Galloping 80s Synth Bass**: Sawtooth oscillator with low-pass filter (cutoff 400 Hz, Q 3.5), octaving 16th notes (D1/D2, Bb0/Bb1, F1/F2, C1/C2).
     - **Layer 2: Chiptune Arpeggiator Lead**: Square wave with crisp envelope cycling chord tones (D3, F3, A3, D4, F4...) with fast decay (60ms).
     - **Layer 3: Procedural 8-bit Drum Kit**:
       - Kick: Sine wave sweeping 130 Hz -> 35 Hz in 50ms on beats 1, 2, 3, 4.
       - Snare: Filtered white noise burst on beats 2 and 4.
       - Hi-hat: 15ms high-pass noise click on offbeats.
     - **Layer 4: Warm Cyber Pad**: Sustained low-volume detuned triangle chords on bar downbeats with 200ms attack and 500ms release to provide rich retro warmth.

4. **HUD Audio Toggle Synchronization**:
   - *Observation*: `HabboOffice.tsx` lines 72–75 call `sound.toggleMute()`.
   - *Inference*:
     - In `SoundEngine`, construct separate sub-mix busses: `bgmGain` (`~0.22`) and `sfxGain` (`~0.70`), both connecting to `masterGain` (`~0.85`), which connects to `ctx.destination`.
     - In `toggleMute()`:
       ```typescript
       this.isMuted = !this.isMuted;
       localStorage.setItem('cisco_sound_muted', String(this.isMuted));
       if (this.masterGain && this.ctx) {
         this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.85, this.ctx.currentTime);
       }
       if (this.isMuted) {
         this.stopBgmScheduler();
       } else {
         this.startBgm();
         this.playClick();
       }
       ```
     - This guarantees that muting via the HUD button silences both BGM and all SFX simultaneously, while unmuting immediately starts both smoothly without audio glitches.

5. **Enhanced Tactile SFX Design**:
   - *Observation*: Keystroke in terminal (`CrtTerminalGame.tsx:54`) uses generic `playClick()`. No cyber alarm plays on ransomware alert. No footstep plays on walking.
   - *Inference*:
     - **IBM Mechanical Keyboard Click (`playMechanicalKey`)**:
       Two simultaneous components:
       1. Crisp contact snap: Bandpass oscillator at 3200 Hz (+/- 3% random jitter) decaying in 10ms.
       2. Key bottoming-out thud: Low triangle wave at 200 Hz decaying in 25ms.
       Replaces `playClick()` in `CrtTerminalGame.tsx:handleKeyDown`.
     - **Soft Cyber Threat Alarm (`playCyberAlarm`)**:
       Futuristic twin-frequency cyber pulse: 720 Hz and 880 Hz modulated with exponential decay (220ms), repeated in a 2-pulse burst with a warm low-pass filter (1400 Hz).
       Triggered in `UmbrellaSocGame.tsx` when the ransomware C2 beacon is selected/clicked.
     - **Footsteps (`playFootstep`)**:
       Subtle low-pass noise tap (420 Hz, 18ms decay, gain 0.035).
       In `IsometricOfficeCanvas.tsx`, when `isWalkingRef.current === true`, invoked every 18 animation frames (~3.3 steps/sec).
     - **Coffee Siphon SFX**:
       Connect `sound.playCoffee()` into `HabboOffice.tsx:handleCoffeeClick()`.

6. **QA Pipeline Invariants Compatibility**:
   - *Observation*: Gate 5 fails if `errors.length > 0` (any `console.error` or unhandled audio rejection).
   - *Inference*:
     - In headless browsers (like Chromium in Docker/Linux CI), `AudioContext` autoplay policy may reject `ctx.resume()` until user gesture.
     - `initCtx()` and `startBgm()` must handle `ctx.resume().catch(() => {})` safely without unhandled promise rejections.
     - The BGM scheduler must guard against `!this.ctx || this.ctx.state !== 'running'`.

---

## 3. Caveats

1. **Headless Environment Audio Output**:
   - In automated Puppeteer test runs (such as `pipeline/run_qa_suite.mjs`), Chromium runs with `--disable-setuid-sandbox` and dummy audio output. The Web Audio graph is constructed and evaluated, but no physical sound card is accessed. Manual listening in an interactive browser is necessary to fine-tune volume balance and subjective acoustic feel.
2. **First User Interaction Autoplay Policy**:
   - Modern browsers (Chrome, Edge, Safari, Firefox) prevent AudioContext from playing audio before the user has interacted with the document (click, tap, or keydown). `SoundEngine` must attach global `pointerdown` and `keydown` listeners that resume the context and start the BGM smoothly upon the user's first click.
3. **Button Text Invariants**:
   - The QA suite relies on exact string matching for several buttons (`"HO CAPITO"`, `"Ascensore (-1)"`, `"SCENDI AL DATACENTER"`, `"Wireshark DPI"`, `"APRI CONSOLE WIRESHARK DPI"`, etc.). No changes should be made to these specific button label texts.

---

## 4. Conclusion

- **Audio System Status**: The project already possesses a solid Web Audio foundation in `src/utils/audio.ts` with 8 procedural sound effects, but completely lacks background music, footstep feedback, mechanical keyboard typing feedback, and ransomware cyber alarms.
- **R4 Feasibility**: R4 can be fully implemented with **zero external files** by extending `SoundEngine` (or introducing a dedicated `src/utils/synthwaveBgm.ts` procedural sequencer cleanly integrated into `SoundEngine`).
- **HUD Synchronization**: The existing HUD toggle button in `HabboOffice.tsx` already binds to `sound.toggleMute()`. Routing all audio through `masterGainNode` and stopping/resuming the BGM sequencer inside `toggleMute()` will provide 100% synchronized mute/unmute control.
- **QA Pipeline Integrity**: `npm run build` and `pipeline/run_qa_suite.mjs` pass 100% currently. Implementing the audio enhancements will maintain 100% pass rate provided that:
  1. TypeScript strict rules are respected (no unused imports/params).
  2. All audio context resumes are safely catch-handled.
  3. UI DOM hierarchy and semantic tags remain collision-free.

---

## 5. Verification Method

### 5.1 Verification Commands
From workspace root `/root/.gemini/antigravity-cli/scratch/cisco-cyber-office`:

1. **Verify TypeScript Compilation and Production Bundle**:
   ```bash
   npm run build
   ```
   *Expected Result*: Exit code 0, 0 TypeScript errors under `strict: true`.

2. **Verify 5-Gate Automated QA Suite**:
   ```bash
   node pipeline/run_qa_suite.mjs
   ```
   *Expected Result*:
   - Gate 1: Zero TypeScript or bundler errors.
   - Gate 2: Mobile (412x915) 0 overflow, 0 collisions, canvas valid.
   - Gate 3: Elevator transit to -1F confirmed, Vault canvas renders successfully.
   - Gate 4: Wireshark DPI solved, ACL applied, badge awarded, returned to 1F.
   - Gate 5: Desktop (1920x1080) 0 overflow, 0 collisions, 0 runtime/console errors.
   - Output ends with: `=== ALL 5 DETERMINISTIC QA GATES PASSED 100% ===`.

3. **Verify Full Integration Gameplay Suite**:
   ```bash
   node pipeline/test_full_suite.mjs
   ```
   *Expected Result*: Output ends with: `--- ALL INTEGRATION TESTS PASSED 100%! ---`.

### 5.2 Specific Code Files to Modify During Implementation
1. `src/utils/audio.ts`: Add master/bgm/sfx gain nodes, procedural synthwave loop scheduler (or import from `src/utils/synthwaveBgm.ts`), `playMechanicalKey()`, `playCyberAlarm()`, `playFootstep()`.
2. `src/components/CrtTerminalGame.tsx`: Replace `sound.playClick()` on keystroke with `sound.playMechanicalKey()`.
3. `src/components/UmbrellaSocGame.tsx`: Add `sound.playCyberAlarm()` when ransomware threat is selected.
4. `src/components/IsometricOfficeCanvas.tsx`: Add cadence-based `sound.playFootstep()` during walking.
5. `src/components/HabboOffice.tsx`: Call `sound.playCoffee()` on coffee boost.

### 5.3 Invalidation Conditions
- Any external audio asset file (`.mp3`, `.wav`) added to the repository (violates zero external audio file constraint).
- Any unhandled promise rejection from `AudioContext.resume()` (causes Gate 5 to fail).
- Any layout overlap or text overflow on 412x915 or 1920x1080 (causes Gate 2 or Gate 5 to fail).
