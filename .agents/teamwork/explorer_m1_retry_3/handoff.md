# Investigation Report: Regression Risk Analysis & Verification Criteria for Milestone 1 Retry

**Agent**: `explorer_m1_retry_3`  
**Mission**: Evaluate regression risk of Nearest-Neighbor Spot Resolution (`IsometricOfficeCanvas.tsx`) and Audio Mute Promise Guard (`audio.ts`), inspect QA suite Gates 2, 3, and 4, and formulate exact acceptance criteria for Worker retry.  
**Integrity Mode**: Development / Strict Verification  
**Date**: 2026-11-12  

---

## 1. Observation

### 1.1 Pairwise Geometric Separation Analysis of All Interactive Spots
Direct evaluation of spot coordinates defined in `src/data/workstations.ts:29-172` yielded the following euclidean distance matrix:

#### Office Room (Floor 1) Spot Coordinates:
- `rack`: `interactX: 2.5, interactY: 3.2` (Tile: 2, 2)
- `terminal`: `interactX: 5.0, interactY: 3.2` (Tile: 5, 2)
- `umbrella`: `interactX: 5.5, interactY: 4.8` (Tile: 6, 4)
- `marco`: `interactX: 2.8, interactY: 5.2` (Tile: 2, 5)
- `coffee`: `interactX: 1.8, interactY: 5.8` (Tile: 1, 6)
- `elevator_down`: `interactX: 5.8, interactY: 1.8` (Tile: 6, 1)

**Pairwise Distances in Office**:
- `rack` $\leftrightarrow$ `terminal`: $2.5000$ (OK, $\ge 1.3$)
- `rack` $\leftrightarrow$ `umbrella`: $3.4000$ (OK, $\ge 1.3$)
- `rack` $\leftrightarrow$ `marco`: $2.0224$ (OK, $\ge 1.3$)
- `rack` $\leftrightarrow$ `coffee`: $2.6926$ (OK, $\ge 1.3$)
- `rack` $\leftrightarrow$ `elevator_down`: $3.5847$ (OK, $\ge 1.3$)
- `terminal` $\leftrightarrow$ `umbrella`: $1.6763$ (OK, $\ge 1.3$)
- `terminal` $\leftrightarrow$ `marco`: $2.9732$ (OK, $\ge 1.3$)
- `terminal` $\leftrightarrow$ `coffee`: $4.1231$ (OK, $\ge 1.3$)
- `terminal` $\leftrightarrow$ `elevator_down`: $1.6125$ (OK, $\ge 1.3$)
- `umbrella` $\leftrightarrow$ `marco`: $2.7295$ (OK, $\ge 1.3$)
- `umbrella` $\leftrightarrow$ `coffee`: $3.8328$ (OK, $\ge 1.3$)
- `umbrella` $\leftrightarrow$ `elevator_down`: $3.0150$ (OK, $\ge 1.3$)
- **`marco` $\leftrightarrow$ `coffee`**: **$1.1662$** (**OVERLAPPING**: $< 1.3$)
- `marco` $\leftrightarrow$ `elevator_down`: $4.5343$ (OK, $\ge 1.3$)
- `coffee` $\leftrightarrow$ `elevator_down`: $5.6569$ (OK, $\ge 1.3$)

#### Datacenter Vault Room (-1F) Spot Coordinates:
- `wireshark`: `interactX: 2.5, interactY: 3.2` (Tile: 2, 2)
- `firepower`: `interactX: 5.0, interactY: 3.2` (Tile: 5, 2)
- `san_storage`: `interactX: 2.8, interactY: 5.2` (Tile: 2, 5)
- `elevator_up`: `interactX: 5.8, interactY: 1.8` (Tile: 6, 1)
- `secbot`: `interactX: 1.8, interactY: 5.8` (Tile: 1, 6)

**Pairwise Distances in Vault**:
- `wireshark` $\leftrightarrow$ `firepower`: $2.5000$ (OK, $\ge 1.3$)
- `wireshark` $\leftrightarrow$ `san_storage`: $2.0224$ (OK, $\ge 1.3$)
- `wireshark` $\leftrightarrow$ `elevator_up`: $3.5847$ (OK, $\ge 1.3$)
- `wireshark` $\leftrightarrow$ `secbot`: $2.6926$ (OK, $\ge 1.3$)
- `firepower` $\leftrightarrow$ `san_storage`: $2.9732$ (OK, $\ge 1.3$)
- `firepower` $\leftrightarrow$ `elevator_up`: $1.6125$ (OK, $\ge 1.3$)
- `firepower` $\leftrightarrow$ `secbot`: $4.1231$ (OK, $\ge 1.3$)
- `san_storage` $\leftrightarrow$ `elevator_up`: $4.5343$ (OK, $\ge 1.3$)
- **`san_storage` $\leftrightarrow$ `secbot`**: **$1.1662$** (**OVERLAPPING**: $< 1.3$)
- `elevator_up` $\leftrightarrow$ `secbot`: $5.6569$ (OK, $\ge 1.3$)

**Key Geometric Fact**: In the entire codebase across both rooms, there are **exactly two pairs** of interactive stations closer than radius $1.3$:
1. `marco` $\leftrightarrow$ `coffee` in Office ($d = 1.1662$).
2. `san_storage` $\leftrightarrow$ `secbot` in Vault ($d = 1.1662$).
Every other station is separated by at least $1.6125$ units from its nearest neighbor.

---

### 1.2 Inspection of `pipeline/run_qa_suite.mjs` Across Gates 2, 3, and 4

1. **Gate 2: Mobile Portrait (412x915) Invariants & Intro Dismissal (`run_qa_suite.mjs:121-136`)**:
   - Initial avatar spawn position: `playerPos = { x: 4, y: 5 }` (`src/components/IsometricOfficeCanvas.tsx:64`).
   - Distance from `{ x: 4, y: 5 }` to all Office spots:
     - `marco`: $\sqrt{(2.8 - 4)^2 + (5.2 - 5)^2} = \sqrt{1.44 + 0.04} = \sqrt{1.48} \approx 1.2166$ ($< 1.3$).
     - `umbrella`: $\sqrt{(5.5 - 4)^2 + (4.8 - 5)^2} = \sqrt{2.25 + 0.04} \approx 1.5133$ ($> 1.3$).
     - `terminal`: $\sqrt{(5 - 4)^2 + (3.2 - 5)^2} \approx 2.0591$ ($> 1.3$).
     - `coffee`: $\sqrt{(1.8 - 4)^2 + (5.8 - 5)^2} \approx 2.3409$ ($> 1.3$).
     - `rack`: $\sqrt{(2.5 - 4)^2 + (3.2 - 5)^2} \approx 2.3431$ ($> 1.3$).
     - `elevator_down`: $\sqrt{(5.8 - 4)^2 + (1.8 - 5)^2} \approx 3.6715$ ($> 1.3$).
   - Because only Marco is within $1.3$ ($1.2166 < 1.3$), both `spots.find()` and `nearest-neighbor` return `marco`.
   - In `src/components/HabboOffice.tsx:437-526`, the action dock render order is:
     ```tsx
     {activeSpot && activeSpot.id !== 'marco' ? (
       /* Station Action Card */
     ) : npcDialogue ? (
       /* Dialogue View with "HO CAPITO!" button */
     ) : activeSpot && activeSpot.id === 'marco' ? (
       /* Marco Standing Prompt "PARLA CON MARCO" */
     ) : (
       /* Free roaming */
     )}
     ```
   - Because `activeSpot.id === 'marco'`, the first branch is bypassed and the `npcDialogue` branch renders with the `HO CAPITO!` button.
   - `run_qa_suite.mjs:131` clicks `HO CAPITO!`, which invokes `setNpcDialogue(null)` and starts BGM.
   - `verifyViewportInvariants(page, 'Mobile Office Free Roam')` verifies layout bounds and canvas pixel integrity.

2. **Gate 3: Elevator Vertical Transit to -1F (`run_qa_suite.mjs:138-164`)**:
   - `run_qa_suite.mjs:141` clicks button `"Ascensore (-1)"`.
   - `HabboOffice.tsx:356` calls `handleQuickWalk('elevator_down')`, setting `targetSpotId = 'elevator_down'`.
   - `IsometricOfficeCanvas.tsx:106` sets `targetPos = { x: 5.8, y: 1.8 }`.
   - Avatar walks to `{ x: 5.8, y: 1.8 }`.
   - At `{ x: 5.8, y: 1.8 }`:
     - Distance to `elevator_down`: $0.0000$ ($< 1.3$).
     - Distance to next closest spot (`terminal` at `5, 3.2`): $1.6125$ ($> 1.3$).
     - All other spots are $> 3.0$.
   - Both `spots.find()` and `nearest-neighbor` resolve to `elevator_down`.
   - In `HabboOffice.tsx:476`, the button renders `'SCENDI AL DATACENTER (-1F)'`.
   - `run_qa_suite.mjs:150` matches `b.textContent.includes('SCENDI AL DATACENTER')` and clicks it.
   - Elevator transit succeeds, header switches to `'UNDERGROUND DATACENTER (-1F)'`.

3. **Gate 4: Wireshark DPI Minigame Interaction & Mitigation (`run_qa_suite.mjs:166-246`)**:
   - `run_qa_suite.mjs:171` clicks `"Wireshark DPI"`, setting `targetSpotId = 'wireshark'`.
   - Avatar walks to `{ x: 2.5, y: 3.2 }`.
   - At `{ x: 2.5, y: 3.2 }`:
     - Distance to `wireshark`: $0.0000$ ($< 1.3$).
     - Distance to next closest spot (`san_storage` at `2.8, 5.2`): $2.0224$ ($> 1.3$).
     - Distance to `firepower` ($5, 3.2$): $2.5000$ ($> 1.3$).
   - Both `spots.find()` and `nearest-neighbor` resolve to `wireshark`.
   - In `HabboOffice.tsx:484`, the button renders `'APRI CONSOLE WIRESHARK DPI'`.
   - `run_qa_suite.mjs:179` clicks it, enters the minigame, solves the DNS tunnel threat, returns to Datacenter, walks to `elevator_up` (`5.8, 1.8`), where `elevator_up` is the sole spot within $1.3$ (next closest is `1.6125`), clicks `'RISALI ALL\'UFFICIO (1F)'`, and returns to Office (1F).

---

### 1.3 Inspection of `pipeline/test_full_suite.mjs`
- Minigame 1 (`Rack 9300`): Walks to `(2.5, 3.2)`. Closest other spot is `terminal` ($d = 2.5000 > 1.3$). Resolves to `rack`.
- Minigame 2 (`CLI Admin`): Walks to `(5.0, 3.2)`. Closest other spots are `terminal` ($d = 0$) and `elevator_down` ($d = 1.6125 > 1.3$). Resolves to `terminal`.
- Minigame 3 (`SOC Wall`): Walks to `(5.5, 4.8)`. Closest other spot is `terminal` ($d = 1.6763 > 1.3$). Resolves to `umbrella`.
- All modal interactions (Skills, Avatar Customizer, Badges) are triggered via header/dock buttons, completely independent of spatial proximity.

---

### 1.4 The Current Proximity Shadowing Defect (`test_audio_adversarial.mjs`)
Executed command:
`cd /root/.gemini/antigravity-cli/scratch/cisco-cyber-office && node pipeline/test_audio_adversarial.mjs`
- Result: Exit code 2.
- Verbatim output:
  ```
  Empirical Proximity Analysis at Bar & Pizza: {
    distToCoffee: 0,
    distToMarco: '1.166',
    selectedBySpotsFind: 'marco',
    activeH3: 'Marco (Senior NetAdmin)',
    hasCoffeeActionButton: false
  }
  ⚠️ PROXIMITY SHADOWING BUG DETECTED: true
  [BUG CONFIRMED]: spots.find() selects Marco (dist 1.166) instead of Coffee (dist 0.000)!
  Action card renders "PARLA CON MARCO" instead of "PRENDI ESPRESSO & PIZZA"!
  ```
- Line `src/components/IsometricOfficeCanvas.tsx:227`:
  ```tsx
  const nearby = spots.find(s => Math.hypot(s.interactX - p.x, s.interactY - p.y) < 1.3) || null;
  ```
  Evaluates `marco` (index 3) before `coffee` (index 4). Because Marco's distance from Coffee (`1.1662`) is less than radius `1.3`, `spots.find()` always returns `marco`, making Coffee completely unreachable through the game canvas.

---

### 1.5 The Audio Mute Race Condition (`src/utils/audio.ts:181-186`)
In `src/utils/audio.ts:181-186`:
```ts
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
```
Observed by `reviewer_m1_2` under odd-parity programmatic rapid toggling:
- When unmuting, `this.resumeContext()` dispatches an asynchronous microtask.
- If a user/script toggles mute again while the promise is in flight, `this.isMuted` flips to `true` and schedules gain ramp to $0.0$.
- When the promise resolves, `.then()` unconditionally executes `this.rampGain(this.masterGainNode, this.masterVolume, 0.04)`.
- Result: `sound.isMuted === true`, but `masterGainNode.gain.value === 0.85`.

---

## 2. Logic Chain

### 2.1 Regression Impact on QA Gates 2, 3, and 4
1. **Mathematical Isolation Proof**:
   - For any target spot $S$ where the player arrives at $(S.interactX, S.interactY)$, the distance to $S$ is $0.0$.
   - For all stations used in Gate 2 (`marco` at spawn), Gate 3 (`elevator_down`), and Gate 4 (`wireshark` and `elevator_up`), the distance to the second-nearest spot $S_{other}$ is:
     - At spawn `{4, 5}`: $d(marco) = 1.2166 < 1.3$, next closest $d(umbrella) = 1.5133 > 1.3$.
     - At Elevator Down `{5.8, 1.8}`: $d(elevator) = 0.0000$, next closest $d(terminal) = 1.6125 > 1.3$.
     - At Wireshark `{2.5, 3.2}`: $d(wireshark) = 0.0000$, next closest $d(san\_storage) = 2.0224 > 1.3$.
     - At Elevator Up `{5.8, 1.8}`: $d(elevator) = 0.0000$, next closest $d(firepower) = 1.6125 > 1.3$.
   - Because in every single QA gate location, **only one spot is within $1.3$**, the candidate set `inRange` has size 1.
   - For a set of size 1, `find(predicate)` and `reduce(minBy distance)` are mathematically and behaviorally **identical**.
   - Therefore, nearest-neighbor resolution has **strictly 0.0% probability of altering Gate 2, Gate 3, or Gate 4 behavior**.

2. **Positive Rectification Proof**:
   - At `coffee` `{1.8, 5.8}`: $d(coffee) = 0.0000 < d(marco) = 1.1662 < 1.3$.
     - `spots.find()` returned `marco` (index 3).
     - `nearest-neighbor` resolves to `coffee` (distance $0.0000 < 1.1662$).
     - Rectifies Coffee station interaction in Office.
   - At `secbot` `{1.8, 5.8}` in Vault: $d(secbot) = 0.0000 < d(san\_storage) = 1.1662 < 1.3$.
     - `spots.find()` returned `san_storage` (index 2).
     - `nearest-neighbor` resolves to `secbot` (distance $0.0000 < 1.1662$).
     - Rectifies SecBot AI interaction in Vault.

### 2.2 Safety of Audio Mute Promise Guard
1. In `src/utils/audio.ts:181-186`, adding `if (this.isMuted) return;` at entry of `.then()`:
   - If the audio engine remains unmuted, `this.isMuted` is `false`, the guard is a no-op, and gain is ramped up normally.
   - If a mute occurred while `resumeContext()` was resolving, `this.isMuted` is `true`. The guard triggers immediately, preventing gain ramp-up and preserving `masterGainNode` at $0.0$.
   - This matches the guard already present in `attachGestureUnlock` (`audio.ts:106`) and `startBgm` (`audio.ts:200`).
   - The fix has **zero side effects** on normal audio operations, SFX synthesis, or QA test suites.

---

## 3. Caveats

1. **Canvas Click Resolution Consistency**:
   - In `IsometricOfficeCanvas.tsx:163-165`, canvas click targeting currently uses `interactiveSpots.find((s) => Math.hypot(s.tileX - targetX, s.tileY - targetY) < 1.3)`.
   - While `workstations.ts` tile coordinates for Marco `(2, 5)` and Coffee `(1, 6)` have distance $\sqrt{(2-1)^2 + (5-6)^2} = \sqrt{2} \approx 1.414 > 1.3$, an intermediate click at e.g. `(1.2, 5.8)` has distance $< 1.3$ to both.
   - To avoid subtle click-misrouting bugs, the worker **must** apply the nearest-neighbor resolution to both proximity detection (line 227) **and** click resolution (line 163).
2. **ESLint Warning**:
   - `IsometricOfficeCanvas.tsx:144` has a pre-existing ESLint warning (`react-hooks/exhaustive-deps` on `onChangeRoom`). This does not affect `npm run build` or tests, but should remain untouched unless explicitly scoped.

---

## 4. Conclusion

1. **Gate Invariant Assessment**:
   - Nearest-neighbor spot resolution **WILL NOT** affect Gate 2 (intro dismissal), Gate 3 (elevator transit), or Gate 4 (Wireshark DPI). All relevant stations are isolated by $> 1.51$ units from any neighbor.
2. **Defect Remediation**:
   - Nearest-neighbor resolution is the mathematically correct fix for the proximity shadowing bug identified in `test_audio_adversarial.mjs:381-422`.
   - The audio mute promise guard `if (this.isMuted) return;` completely secures the audio state machine against async promise interleaving.

---

## 5. Exact Acceptance Criteria for Worker Retry

The Worker retry must satisfy the following strict criteria:

### Criteria 1: Nearest-Neighbor Proximity Resolution in Canvas
In `src/components/IsometricOfficeCanvas.tsx`:
1. **Line ~227 (Proximity Detection)**: Replace `spots.find()` with:
   ```tsx
   const inRange = spots.filter(s => Math.hypot(s.interactX - p.x, s.interactY - p.y) < 1.3);
   const nearby = inRange.length > 0
     ? inRange.reduce((min, s) =>
         Math.hypot(s.interactX - p.x, s.interactY - p.y) <
         Math.hypot(min.interactX - p.x, min.interactY - p.y)
           ? s
           : min
       )
     : null;
   ```
2. **Line ~163 (Click Resolution)**: Replace `interactiveSpots.find()` with:
   ```tsx
   const clickedInRange = interactiveSpots.filter(
     (s) => Math.hypot(s.tileX - targetX, s.tileY - targetY) < 1.3
   );
   const spotClicked = clickedInRange.length > 0
     ? clickedInRange.reduce((min, s) =>
         Math.hypot(s.tileX - targetX, s.tileY - targetY) <
         Math.hypot(min.tileX - targetX, min.tileY - targetY)
           ? s
           : min
       )
     : null;
   ```

### Criteria 2: Audio Mute Promise Guard in Audio Engine
In `src/utils/audio.ts:181-186`:
Add the guard `if (this.isMuted) return;` inside the `resumeContext().then(...)` callback:
```ts
    } else {
      this.resumeContext().then(() => {
        if (this.isMuted) return;
        this.rampGain(this.masterGainNode, this.masterVolume, 0.04);
        this.startBgm();
        this.playClick();
      });
    }
```

### Criteria 3: E2E QA Suite Non-Regression (100% Pass)
- `npm run build` exits 0 (0 TypeScript errors, clean bundle).
- `node pipeline/run_qa_suite.mjs` exits 0 with all 5 Gates passing:
  - Gate 1: Build & TypeScript.
  - Gate 2: Mobile portrait layout, intro dialogue dismissal via `"HO CAPITO!"`, 0 overflow, 0 collisions.
  - Gate 3: Elevator transit to Datacenter Vault (-1F).
  - Gate 4: Wireshark DPI minigame interaction, filter, mitigation, and return to 1F.
  - Gate 5: Desktop widescreen (1920x1080) and 0 console/runtime errors.

### Criteria 4: Adversarial Test Suite Exit Code 0
- `node pipeline/test_audio_adversarial.mjs` must complete with **Exit Code 0** (previously exited with code 2).
- When standing at Bar & Pizza (`p = { x: 1.8, y: 5.8 }`):
  - `activeH3` must equal `"Bar Napoletano & Pizza"`.
  - Action button `"PRENDI ESPRESSO & PIZZA"` must render and be clickable.
  - `isCoffeeShadowedByMarco` must report `false`.

### Criteria 5: Full Gameplay & Audio Concurrency Suites Pass
- `node pipeline/test_full_suite.mjs` exits 0 (10/10 stages passed).
- `node pipeline/test_audio_suite.mjs` exits 0 (6/6 suites passed).
- `node pipeline/test_stress_audio.mjs` exits 0 (0 page errors, 0 orphaned gain).

---

## 6. Verification Method

To independently verify these findings:
```bash
# 1. Verify that Marco and Coffee are the sole overlapping pair in Office
cd /root/.gemini/antigravity-cli/scratch/cisco-cyber-office && node -e '
const spots = [
  { id: "rack", x: 2.5, y: 3.2 }, { id: "terminal", x: 5, y: 3.2 },
  { id: "umbrella", x: 5.5, y: 4.8 }, { id: "marco", x: 2.8, y: 5.2 },
  { id: "coffee", x: 1.8, y: 5.8 }, { id: "elevator_down", x: 5.8, y: 1.8 }
];
spots.forEach(a => spots.forEach(b => {
  if (a.id < b.id && Math.hypot(a.x - b.x, a.y - b.y) < 1.3)
    console.log("Overlap:", a.id, b.id, Math.hypot(a.x - b.x, a.y - b.y).toFixed(3));
}));
'
# Expected output: Overlap: coffee marco 1.166

# 2. Verify Gate 2 spawn point isolation
node -e '
const p = { x: 4, y: 5 };
const marcoDist = Math.hypot(2.8 - p.x, 5.2 - p.y);
console.log("Spawn dist to Marco:", marcoDist, "Is < 1.3:", marcoDist < 1.3);
'
# Expected output: Spawn dist to Marco: 1.21655 Is < 1.3: true

# 3. Reproduce current adversarial failure
node pipeline/test_audio_adversarial.mjs
# Expected output: Exit code 2, "⚠️ PROXIMITY SHADOWING BUG DETECTED: true"
```
