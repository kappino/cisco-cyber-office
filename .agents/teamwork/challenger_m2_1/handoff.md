# Adversarial Verification Report: Milestone 2 — Visual Particle & Hologram Systems

**Agent**: `challenger_m2_1`  
**Role**: EMPIRICAL CHALLENGER (critic, specialist)  
**Milestone**: Milestone 2 (R1 Visual Atmosphere, Isometric Particles & 3D Cisco Hologram)  
**Date**: 2026-11-12  
**Verdict**: **APPROVE**  

---

## 1. Observation

### 1.1 Production Build & Deterministic Test Suites
- `npm run build` (`tsc -b && vite build`):
  ```
  vite v5.4.21 building for production...
  ✓ 2540 modules transformed.
  dist/index.html                   1.07 kB │ gzip:   0.61 kB
  dist/assets/index-BOi4czps.css   40.67 kB │ gzip:   7.43 kB
  dist/assets/index-Biou-PCo.js   469.46 kB │ gzip: 143.02 kB
  ✓ built in 11.48s
  Command exited with code 0 (0 TypeScript errors).
  ```
- `node pipeline/run_qa_suite.mjs`:
  ```
  === STARTING 5-GATE DETERMINISTIC MULTI-AGENT QA SUITE ===
  [Gate 1/5] Production Build: [PASS] 0 TypeScript or bundler errors.
  [Gate 2/5] Mobile Portrait (412x915): [PASS] 0 overflow, 0 collisions, Canvas valid (371 buckets).
  [Gate 3/5] Elevator Vertical Transit to -1F: [PASS] 0 overflow, 0 collisions, Canvas valid (177 buckets).
  [Gate 4/5] Minigame 4 (Wireshark DPI): [PASS] 0 overflow, 0 collisions, badge awarded.
  [Gate 5/5] Desktop Widescreen (1920x1080): [PASS] 0 overflow, 0 collisions, Canvas valid (363 buckets), 0 console errors.
  === ALL 5 DETERMINISTIC QA GATES PASSED 100% ===
  ```
- `node pipeline/test_full_suite.mjs`:
  ```
  1. Office initial loaded
  2. Minigame 1 (Rack) open -> 3. completed
  4. Minigame 2 (CLI Terminal) open -> 5. completed
  6. Minigame 3 (Umbrella SOC) open -> 7. completed
  8. Skills Modal open -> 9. Avatar Customizer open -> 10. Badges Showcase open
  --- ALL INTEGRATION TESTS PASSED 100%! ---
  ```

### 1.2 Adversarial Stress Testing (`pipeline/test_milestone2_adversarial.mjs`)
Implemented 6 adversarial challenge harnesses executed directly inside Chromium:

1. **Challenge 1: `drawSteamPlume` Numerical Stability & Invariant Sweep**:
   - `totalArcs`: 60,152 particle evaluations across 10,000+ sequential animation frames and edge frames (`[0, 1, 60, 3600, 100000, 1000000, 99999999, Number.MAX_SAFE_INTEGER]`).
   - `nanOrInfCount`: 0.
   - `radiusViolations` (outside `[1.0, 5.0]`): 0 (`r` bounded strictly to `[1.2, 4.4]`).
   - `coordViolations` (`x` outside `[sx - 7, sx + 7]`, `y` outside `[sy - 25, sy]`): 0.
   - `alphaViolations` (outside `[0, 0.45]`): 0 (`alpha` strictly `(1 - t) * 0.42` in `[0, 0.42]`).

2. **Challenge 2: `drawCiscoHologram` 3D Geometry, Invariants & Bounding Box**:
   - `totalCalls`: 702,825 drawing operations checked across 10,000 frames for both Office 3D Bridge (`'office'`) and Vault 3D Shield (`'datacenter_vault'`).
   - `nanOrInfCount`: 0.
   - `boundingBoxViolations` on 840x620 canvas (outside `X ∈ [340, 500]`, `Y ∈ [260, 460]`): 0.
   - `negativeRadiusViolations`: 0 (all ellipse and arc radii strictly positive).
   - `gradientOffsetViolations`: 0 (all color stop offsets strictly within `[0, 1]`).
   - Viewport scaling: executed without error on mobile (412px) and widescreen (1920px).

3. **Challenge 3: Floor Systems Stress Test (`drawWarmParquetFloor` & `drawUndergroundFloor`)**:
   - `parquetCalls`: 3,000 frames with varying `tgt` (`null`, `{x:0, y:0}`, `{x:4, y:4}`, `{x:7, y:7}`, boundary `{-1, 8}`, non-integer `{3.5, 4.5}`).
   - `datacenterCalls`: 3,000 frames.
   - `nanOrInfCount`: 0.
   - `alphaLeaks` (`ctx.globalAlpha !== 1.0` after render): 0.

4. **Challenge 4: Multi-Monitor Workstations & Console Renderers**:
   - Tested 3,000 frames across `drawChunkyAdminDesk`, `drawChunkySocWall`, `drawChunkyWiresharkConsole`, `drawChunkyNeapolitanBar`.
   - `nanOrInfCount`: 0.
   - `exceptions`: 0.

5. **Challenge 5: Mathematical Oracle on Depth Sorting at Tile `(4, 4)` (Depth 8)**:
   - Evaluated 1,444 discrete grid positions `(gx, gy)` across `[0, 7.6] x [0, 7.6]`.
   - Positions correctly sorted behind hologram (`playerIdx < holoIdx` when `gx + gy < 8.0`): 814.
   - Positions correctly sorted in front of hologram (`playerIdx > holoIdx` when `gx + gy > 8.0`): 595.
   - Boundary plane evaluations (`gx + gy == 8.0`): 35.
   - Grid depth inversion errors: 0.
   - Radial orbital sweep around `(4, 4)` across 5 radii (0.5 to 2.5 tiles) over 360° (1,800 points): 0 depth inversion errors.

6. **Challenge 6: Live In-Engine Browser Movement & Depth Sorting Transition**:
   - Observed frame-by-frame draw dispatch order as avatar moved through waypoints `(2,2)` [depth 4.0], `(3,3)` [depth 6.0], `(3.5, 4.0)` [depth 7.5], `(4.5, 4.0)` [depth 8.5], `(5,5)` [depth 10.0], `(6,6)` [depth 12.0].
   - Order transitioned seamlessly from `[..., player, ..., hologram]` to `[..., hologram, ..., player]` across boundary depth 8.0.
   - Datacenter Vault (-1F) hologram rendering verified live following elevator vertical transit.
   - Browser console errors: 0. Browser page errors: 0.

---

## 2. Logic Chain

1. **Particle System Stability**:
   - Line 109 in `src/canvas/roomRenderers.ts` defines `t = ((frame * 0.4 + i * (60 / count)) % 60) / 60`. For all positive integer frames, `(frame * 0.4 + i * (60 / count))` modulo 60 yields `[0, 60)`, so `t ∈ [0, 1)`.
   - `r = 1.2 + t * 3.2` is guaranteed bounded in `[1.2, 4.4] > 0`.
   - `alpha = (1 - t) * 0.42` is guaranteed bounded in `[0, 0.42]`.
   - Empirically confirmed across 60,152 particle evaluations with 0 violations (Observation 1.2, Challenge 1).

2. **Hologram Geometry & Viewport Containment**:
   - `drawCiscoHologram` at tile `(4, 4)` projects to `baseX = 420`, `baseY = 421`, `holoCenterY ≈ 349`.
   - Cisco 9-bar depth scaling `(cosA + 1.6) / 2.6` scales bar heights deterministically between `0.23` and `1.0`, ensuring `bh > 0` and `bw >= 2`.
   - All 702,825 drawing operations across 10,000 frames fell strictly within `X ∈ [340, 500]`, `Y ∈ [260, 460]` (Observation 1.2, Challenge 2). Zero pixels escape into screen margins or cause buffer overflows.

3. **Floor Lighting State Hygiene**:
   - Parquet specular sheen sets `ctx.globalAlpha = sheenAlpha` (max 0.26) and top-left glint sets `sheenAlpha * 1.6` (max 0.416). Line 430 explicitly resets `ctx.globalAlpha = 1.0`.
   - Datacenter sub-floor pulse modulates `glowAlpha` (0.18..0.40) and cool mist (max 0.28). Lines 1380 and 1399 explicitly reset `ctx.globalAlpha = 1.0`.
   - Across 6,000 frame invocations, exactly 0 globalAlpha state leaks occurred (Observation 1.2, Challenge 3).

4. **Depth Sorting Invariant at `(4, 4)` (Depth 8.0)**:
   - In dimetric projection, depth is monotonically linear: `depth = gridX + gridY`.
   - Central hologram entity has fixed depth `4 + 4 = 8.0` (`IsometricOfficeCanvas.tsx:306, 350`).
   - Player depth is `p.x + p.y` (`IsometricOfficeCanvas.tsx:288`).
   - Sorting by `a.depth - b.depth` guarantees that whenever `p.x + p.y < 8.0`, the player renders before the hologram (occluded by hologram base/cone); whenever `p.x + p.y > 8.0`, the hologram renders before the player (player drawn on top).
   - This invariant was confirmed 100% sound across 1,444 grid points, 1,800 radial points, and live frame-by-frame browser navigation (Observation 1.2, Challenges 5 & 6).

5. **Regression & QA Invariance**:
   - Production build compiles cleanly with 0 TypeScript errors (Observation 1.1).
   - All 5 deterministic QA Gates passed 100% across mobile and desktop widescreen viewports (Observation 1.1).
   - All 10 full gameplay integration tests passed 100% (Observation 1.1).

---

## 3. Caveats

- **Negative Frame Counters**: In hypothetical scenarios where `frame < 0`, standard JS `% 60` returns a negative number which could invert particle lifecycle `t`. However, in `IsometricOfficeCanvas.tsx`, `animFrameRef.current` starts at 0 and only increments via `requestAnimationFrame`. Thus `frame >= 0` is an invariant guaranteed by the engine runtime.
- **Hologram Interaction**: Tile `(4, 4)` is intentionally a non-interactive visual centerpiece and does not register an entry in `workstations.ts`, ensuring player movement across the central carpet remains unobstructed.

---

## 4. Conclusion

**Verdict: APPROVE**

Milestone 2 (R1 Visual Atmosphere, Isometric Particles & 3D Cisco Hologram) fulfills all functional and non-functional requirements:
- The particle, floor, and hologram systems are 100% numerically stable (0 NaN, 0 Infinity, 0 unhandled exceptions across thousands of frames).
- Visual coordinates remain strictly bounded without raster clipping or buffer overflow.
- Depth sorting relative to the hologram entity at `(4, 4)` (depth 8) is mathematically and visually verified in both Office and Vault environments.
- All project build, QA, and integration test suites pass at 100%.

The implementation is verified ready for Milestone 3 (Living Avatar & Diegetic Interactions).

---

## 5. Verification Method

To independently reproduce this verification:

```bash
cd /root/.gemini/antigravity-cli/scratch/cisco-cyber-office

# 1. Typecheck & Production Build
npm run build

# 2. Run Deterministic 5-Gate Multi-Agent QA Suite
node pipeline/run_qa_suite.mjs

# 3. Run Full Gameplay Integration Suite
node pipeline/test_full_suite.mjs

# 4. Run Adversarial Empirical Verification Suite (6 Challenges)
node pipeline/test_milestone2_adversarial.mjs
```

### Invalidation Conditions:
- Any `nanOrInfCount > 0` in any particle or hologram drawing routine.
- Any hologram drawing operation falling outside bounding box `[340..500 x 260..460]`.
- Any `alphaLeaks > 0` after floor render routines.
- Any depth sorting inversion where player at `p.x + p.y < 8.0` is rendered after hologram, or player at `p.x + p.y > 8.0` is rendered before hologram.
- Any failure in `npm run build`, `run_qa_suite.mjs`, or `test_full_suite.mjs`.
