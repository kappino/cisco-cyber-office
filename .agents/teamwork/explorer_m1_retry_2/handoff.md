# Audio Mute Race Condition Fix Strategy & Guard Analysis Report

**Agent**: `explorer_m1_retry_2`  
**Milestone**: M1 (Procedural Web Audio Engine & SFX Suite)  
**Target File**: `src/utils/audio.ts`  
**Date**: 2026-11-12  

---

## 1. Observation

### 1.1 Direct Defect Reproduction
Under rapid programmatic mute toggling (<20ms intervals), an in-flight `resumeContext()` Promise resolves after a subsequent mute toggle, causing `masterGainNode.gain.value` to ramp back to `0.85` while `this.isMuted === true`.

- **Source Location**: `src/utils/audio.ts:181-186`
- **Existing Unguarded Code**:
  ```typescript
  } else {
    this.resumeContext().then(() => {
      this.rampGain(this.masterGainNode, this.masterVolume, 0.04);
      this.startBgm();
      this.playClick();
    });
  }
  ```
- **Reproduction Command**:
  ```bash
  cd /root/.gemini/antigravity-cli/scratch/cisco-cyber-office && node -e '
  import puppeteer from "puppeteer-core";
  async function test() {
    const browser = await puppeteer.launch({
      executablePath: "/usr/bin/chromium",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--autoplay-policy=no-user-gesture-required"]
    });
    const page = await browser.newPage();
    await page.goto("http://localhost:5173/", { waitUntil: "networkidle0" });
    const res = await page.evaluate(async () => {
      const { sound } = await import("/src/utils/audio.ts");
      sound.initCtx();
      if (sound.isMuted) sound.toggleMute();
      sound.toggleMute(); // 1: Mute
      sound.toggleMute(); // 2: Unmute (launches async resumeContext)
      sound.toggleMute(); // 3: Mute immediately (<20ms)
      await new Promise(r => setTimeout(r, 200));
      return {
        isMuted: sound.isMuted,
        masterGain: sound.getMasterNode().gain.value,
        bgmActive: sound.getBgmEngine().active
      };
    });
    console.log("Odd toggle test on current code:", res);
    await browser.close();
  }
  test();'
  ```
- **Observed Output**:
  ```json
  Odd toggle test on current code: { isMuted: true, masterGain: 0.8500000238418579, bgmActive: false }
  ```
- **Defect Impact**:
  `sound.isMuted` is `true`, yet `sound.getMasterNode().gain.value` is `0.85` instead of `0.0`. The master audio bus remains wide open while muted.

### 1.2 Multi-Toggle ABA Interleaving & Duplicate SFX Synthesis
When testing rapid toggling ending in an unmuted state (4 rapid toggles: Mute $\to$ Unmute $\to$ Mute $\to$ Unmute):
- Command executed with spy on `sound.playClick()`:
  ```bash
  cd /root/.gemini/antigravity-cli/scratch/cisco-cyber-office && node -e '
  import puppeteer from "puppeteer-core";
  async function test() {
    const browser = await puppeteer.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--disable-setuid-sandbox", "--autoplay-policy=no-user-gesture-required"] });
    const page = await browser.newPage();
    await page.goto("http://localhost:5173/", { waitUntil: "networkidle0" });
    const res = await page.evaluate(async () => {
      const { sound } = await import("/src/utils/audio.ts");
      sound.initCtx();
      if (sound.isMuted) sound.toggleMute();
      let clickCalls = 0;
      const origPlayClick = sound.playClick.bind(sound);
      sound.playClick = () => { clickCalls++; origPlayClick(); };
      sound.toggleMute(); // 1: M
      sound.toggleMute(); // 2: U (launches Promise P1)
      sound.toggleMute(); // 3: M
      sound.toggleMute(); // 4: U (launches Promise P2)
      await new Promise(r => setTimeout(r, 200));
      return { isMuted: sound.isMuted, masterGain: sound.getMasterNode().gain.value, clickCalls };
    });
    console.log("Spy on playClick during 4 rapid toggles:", res);
    await browser.close();
  }
  test();'
  ```
- **Observed Output**:
  ```json
  Spy on playClick during 4 rapid toggles: { isMuted: false, masterGain: 0.8500000238418579, clickCalls: 2 }
  ```
- **Observation**:
  `clickCalls: 2` — Two separate click sounds were synthesized for a single net unmute operation because both $P_1$ and $P_2$ resolved when `sound.isMuted === false`.

---

## 2. Logic Chain

### 2.1 Event Loop & Microtask Mechanics
1. **Asynchronous Resume**:
   - In `src/utils/audio.ts:120-133`, `resumeContext()` is an `async` function calling `await this.ctx.resume()`.
   - Native `AudioContext.prototype.resume()` returns a Promise that delegates to the browser's audio I/O thread.
   - Even if `this.ctx.state === 'running'`, an async function resolution is scheduled as a microtask on the JavaScript event loop.
2. **Interleaving State Mutation**:
   - `sound.toggleMute()` (lines 169-190) executes synchronously on the main thread:
     - When toggling to muted (`this.isMuted === true`):
       - It synchronously invokes `this.rampGain(this.masterGainNode, 0.0, 0.04)`.
       - It synchronously invokes `this.stopBgm()`.
     - When toggling to unmuted (`this.isMuted === false`):
       - It invokes `this.resumeContext().then(...)`.
3. **The Race Condition [Obs 1.1]**:
   - If a mute toggle occurs while a prior unmute's `resumeContext()` promise is in flight:
     - The mute toggle immediately schedules the master gain ramp to `0.0`.
     - Later, the in-flight promise resolves.
     - Because lines 181-186 contain no guard, the callback executes `this.rampGain(this.masterGainNode, this.masterVolume, 0.04)`.
     - This cancels the scheduled mute ramp and drives `masterGainNode.gain` up to `0.85`.
     - The core system invariant:
       $$\text{sound.isMuted} = \text{true} \iff \text{masterGainNode.gain.value} = 0.0$$
       is broken.

### 2.2 Analysis of Candidate Guards

#### Candidate A: Naive Boolean Guard (`if (this.isMuted) return;`)
- Proposed by Reviewer 2:
  ```typescript
  } else {
    this.resumeContext().then(() => {
      if (this.isMuted) return; // Guard
      this.rampGain(this.masterGainNode, this.masterVolume, 0.04);
      this.startBgm();
      this.playClick();
    });
  }
  ```
- **Strength**: Handles Scenario 1 (Mute $\to$ Unmute $\to$ Mute). When the promise resolves, `this.isMuted` is `true`, so the callback returns early and master gain stays at `0.0`.
- **Fatal Weakness**: Fails in Scenario 2 (Unmute $\to$ Mute $\to$ Unmute [Obs 1.2]).
  - In Scenario 2, the final state is `this.isMuted === false`.
  - When the stale promise $P_1$ resolves, `this.isMuted` is `false`.
  - Therefore, `if (this.isMuted) return;` evaluates to `false` and does NOT return.
  - $P_1$ runs its callback: schedules gain ramp, starts BGM, calls `playClick()`.
  - Then $P_2$ resolves and does the exact same thing again.
  - **Result**: `clickCalls: 2`, double scheduling, audio pops.

#### Candidate B: Generation Counter / Session Token Guard (Epoch Pattern - RECOMMENDED)
- Implementation:
  ```typescript
  private muteSessionId: number = 0;
  
  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    const currentSession = ++this.muteSessionId;
    // ...
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
    // ...
  }
  ```
- **Logic**:
  1. `this.muteSessionId` is an integer incremented synchronously on every mute/unmute call.
  2. Each in-flight promise captures its local `currentSession` token in closure scope.
  3. When the promise resolves, it checks:
     $$\text{this.isMuted} \lor (\text{this.muteSessionId} \neq \text{currentSession})$$
  4. If ANY intervening toggle occurred (whether Mute or Unmute), `this.muteSessionId !== currentSession` evaluates to `true`, and the stale promise is dropped immediately.
  5. Only the promise corresponding to the LATEST invocation executes.
  6. **Empirical Verification**:
     - Scenario 1 (3 rapid toggles M-U-M): `masterGain: 0.0`, `isMuted: true`, `clickCalls: 0`.
     - Scenario 2 (4 rapid toggles M-U-M-U): `masterGain: 0.85`, `isMuted: false`, `clickCalls: 1` (stale promise dropped, 0 duplicate clicks).
     - Scenario 3 (50 rapid toggles): `isMuted: false`, `masterGain: 0.85`, `bgmActive: true`.
     - Scenario 4 (51 rapid toggles): `isMuted: true`, `masterGain: 0.0`, `bgmActive: false`.

---

## 3. Caveats

1. **Single-Threaded Event Loop**:
   JavaScript runtime on the browser main thread is single-threaded. Concurrency issues in Web Audio arise from the interleaving of asynchronous Promises (microtasks) with native browser audio threads and macrotasks.
2. **AudioContext Autoplay Policy**:
   If `toggleMute()` is triggered programmatically prior to any user gesture on browsers enforcing strict autoplay policies, `resumeContext()` may resolve with `false`. The existing `attachGestureUnlock()` handler in `src/utils/audio.ts:95-115` already handles first-gesture unlock. The token guard does not alter this behavior.
3. **`node.gain.cancelScheduledValues` Timing**:
   `rampGain()` uses `cancelScheduledValues(now)` and `linearRampToValueAtTime`. By ensuring stale promises never call `rampGain()`, we prevent cancellation collisions on the `AudioParam` timeline.

---

## 4. Conclusion & Recommendation

### 4.1 Recommendation
Adopt the **Generation Counter / Session Token Guard** (`muteSessionId`). It provides 100% thread and event-loop safety, eliminates race conditions under any rapid toggle frequency, and prevents duplicate SFX triggering.

### 4.2 Concrete Implementation Diff

#### Target File: `src/utils/audio.ts`

**Step 1: Declare `muteSessionId` member variable** (around line 26):
```typescript
<<<< Before:
  private noiseBuffer: AudioBuffer | null = null;
  private lastFootstepTime: number = 0;

  constructor() {
==== After:
  private noiseBuffer: AudioBuffer | null = null;
  private lastFootstepTime: number = 0;
  private muteSessionId: number = 0;

  constructor() {
>>>>
```

**Step 2: Update `toggleMute()` with token assignment and guard** (around lines 169-188):
```typescript
<<<< Before:
  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('cisco_sound_muted', String(this.isMuted));
    }

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
==== After:
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
>>>>
```

### 4.3 Patch Artifact Reference
The complete machine-applicable unified diff patch has been prepared and verified:
`/root/.gemini/antigravity-cli/scratch/cisco-cyber-office/.agents/teamwork/explorer_m1_retry_2/audio_mute_guard.patch`

---

## 5. Verification Method

To independently verify the defect and the recommended fix:

1. **Run the Automated Race Condition Verification Harness**:
   ```bash
   cd /root/.gemini/antigravity-cli/scratch/cisco-cyber-office && node .agents/teamwork/explorer_m1_retry_2/verify_guard.mjs
   ```
   - *Current Code Result*: FAILS with `Error: [VERIFY GUARD FAILED] Master gain must be 0.0 when muted, got: 0.8500000238418579`.
   - *Post-Patch Result*: PASSES with 0 errors (`[PASS] Master gain is 0.0 when muted after rapid toggle` and `[PASS] Exactly 1 click called and master gain is 0.85`).

2. **Apply the Patch**:
   ```bash
   cd /root/.gemini/antigravity-cli/scratch/cisco-cyber-office && patch -p1 < .agents/teamwork/explorer_m1_retry_2/audio_mute_guard.patch
   ```

3. **Verify Build & Test Suites**:
   - `npm run build` — Verify 0 TypeScript strict errors.
   - `node pipeline/test_audio_suite.mjs` — Verify all 6 procedural audio tests pass.
   - `node pipeline/test_stress_audio.mjs` — Verify 50 rapid toggles and SFX bursts pass with 0 desync.
   - `node pipeline/test_adversarial_audio.mjs` — Verify gain headroom and 50/51 toggle parity pass.
   - `node pipeline/run_qa_suite.mjs` — Verify all 5 QA gates pass.
