# Handoff Report: Steam Particles & Floor Lighting Enhancements in `src/canvas/roomRenderers.ts`

**Explorer**: `explorer_m2_1`  
**Milestone**: Milestone 2 (R1 Visual Atmosphere & Isometric Particles)  
**Date**: 2026-11-12  

---

## 1. Observation

### 1.1 Existing Canvas Loop & Performance Baseline
- **Build Status**: Verified via `cd /root/.gemini/antigravity-cli/scratch/cisco-cyber-office && npm run build` (`tsc -b && vite build`):
  ```
  vite v5.4.21 building for production...
  ✓ built in 6.41s (0 TypeScript errors)
  ```
- **QA Suite Status**: Verified via `node pipeline/run_qa_suite.mjs`:
  ```
  === ALL 5 DETERMINISTIC QA GATES PASSED 100% ===
  Gate 1: Zero TS / bundler errors.
  Gate 2: Mobile Office Initial (323 color buckets, 0 overflow, 0 collisions).
  Gate 3: Elevator transit to -1F confirmed (136 color buckets).
  Gate 4: Wireshark DPI solved, ACL applied, badge awarded.
  Gate 5: Desktop Widescreen (316 color buckets, 0 runtime/console errors).
  ```
- **Frame Rate & Loop Architecture** (`src/components/IsometricOfficeCanvas.tsx`, lines 183-378):
  - Fixed canvas buffer size: `840 x 620` (line 384-385).
  - Main loop: driven by `requestAnimationFrame(render)` inside `useEffect` (lines 192-374).
  - Continuous integer frame counter: `animFrameRef.current++` (line 193) yields `const frame = animFrameRef.current;` (line 194).
  - Currently passed to `drawWarmHabboWalls(ctx, canvas.width, frame)` (line 275) and `drawUndergroundDatacenterWalls(ctx, canvas.width, frame)` (line 279), but **omitted** from `drawWarmParquetFloor(ctx, canvas.width, tgt)` (line 276), `drawUndergroundFloor(ctx, canvas.width, tgt)` (line 280), `drawChunkyAdminDesk(context, 5, 2, canvas.width, level2Done)` (line 316), and `drawChunkyNeapolitanBar(context, 1, 6, canvas.width)` (line 326).

### 1.2 Coffee Stations in `src/canvas/roomRenderers.ts`
- **Bar Napoletano** (`drawChunkyNeapolitanBar`, lines 555-615):
  - Station located at grid position `(1, 6)`.
  - Espresso machine drawn at lines 581-588:
    ```typescript
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(bx + 4, by - 20, 26, 22);
    ctx.fillStyle = '#475569';
    ctx.fillRect(bx + 8, by - 16, 18, 8);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(bx + 8, by + 2, 7, 3);
    ctx.fillRect(bx + 17, by + 2, 7, 3);
    ```
  - Currently, there is **no steam effect whatsoever** and no standalone freshly poured espresso ceramic cup on the front counter.
- **Admin Desk** (`drawChunkyAdminDesk`, lines 397-484):
  - Station located at grid position `(5, 2)`.
  - Steaming espresso cup at lines 457-462:
    ```typescript
    // Steaming Espresso Ceramic Cup
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(dx + 8, dy + 12, 8, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(dx + 11, dy + 6, 2, 4);
    ```
  - Currently, the steam is rendered as a completely static, non-animated 2x4 white rectangle (`ctx.fillRect(dx + 11, dy + 6, 2, 4)`).

### 1.3 Floor Renderers in `src/canvas/roomRenderers.ts`
- **Ufficio Panoramico Floor** (`drawWarmParquetFloor`, lines 245-283):
  - 8x8 grid rendering parquet wood tiles (`#b45309` / `#92400e`) with Cisco blue carpet (`#0369a1` / `#0284c7`) in center `c: 3..5, r: 3..5`.
  - Coordinates computed via `const pt = gridToScreen(c, r, canvasW);` allocating 64 `{ x, y }` objects per frame.
  - Panoramic window on left wall (`gx = 0`, `gy = 1.0..6.2`) shows sunset sky, setting sun, and Vesuvio.
  - Currently, parquet floor tiles have **no specular sheen or reflection** from the panoramic window.
- **Underground Datacenter Vault Floor** (`drawUndergroundFloor`, lines 919-974):
  - 8x8 slate tiles with cold-aisle corridor at `c: 2..4, r: 2..4`.
  - Sub-floor blue cooling glow currently drawn at lines 943-948:
    ```typescript
    ctx.save();
    ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.beginPath();
    ctx.arc(pt.x, pt.y + TILE_H / 2, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ```
  - This glow is completely static: fixed radius (12px), fixed alpha (0.25), no pulsation.
  - There are **no cool mist particles** rising from the perforated floor ventilation grilles.

---

## 2. Logic Chain

### 2.1 Zero-Heap-Allocation Architecture
1. *Observation*: In JavaScript / V8 engines, template literal string evaluations (e.g. `` `rgba(254, 243, 199, ${alpha})` ``) and object instantiation (e.g. `{ x, y }`) allocate memory on the V8 nursery heap. In a 60 FPS loop rendering 64 tiles, multiple particles, and multiple objects, this generates several thousand heap allocations per second, triggering periodic Garbage Collection (GC) scavenges and frame drops.
2. *Inference*:
   - Use `const` color string definitions declared once at the module level (e.g. `const COLOR_STEAM = '#fef3c7';`, `const COLOR_CYAN_GLOW = '#38bdf8';`, `const COLOR_COOL_MIST = '#bae6fd';`).
   - Modulate transparency dynamically via `ctx.globalAlpha = scalarNumber;`. Because `globalAlpha` is an internal double property of the native C++ canvas context, setting it incurs **0 JS heap allocations**.
   - Inline the isometric math `ptX = (c - r) * halfW + originX; ptY = (c + r) * halfH + ORIGIN_Y;` directly in the 8x8 floor loops instead of calling `gridToScreen(c, r, canvasW)`. This eliminates 64 object allocations per frame per room (128 objects/frame avoided across environments = ~7,680 objects/second saved).
   - Compute particle positions, radii, and alphas using pure scalar trigonometric and modulo functions of the integer `frame` counter.

### 2.2 Procedural Steam Plume (`drawSteamPlume`)
1. *Observation*: Real espresso steam rises vertically in air, expands outwards as vapor cools, and dissipates to zero density near its apex.
2. *Inference*:
   - Particle lifecycle `t = ((frame * 0.4 + i * (60 / count)) % 60) / 60` normalizes particle age to `[0.0, 1.0)`.
   - Vertical rise: `y = sy - t * 24` creates smooth upward movement.
   - Horizontal organic waver: `x = sx + Math.sin(frame * 0.08 + i * 1.5) * (2 + t * 4)` simulates thermal air currents.
   - Expansion: `r = 1.2 + t * 3.2` expands particle radius from 1.2px to 4.4px.
   - Dissipation: `alpha = (1 - t) * 0.42` fades smoothly to 0.

### 2.3 Sunset Sheen on Parquet Floor (`drawWarmParquetFloor`)
1. *Observation*: In `drawWarmHabboWalls`, the arched panoramic window spans the left wall (`gx = 0, gy: 1.0..6.2`), with the golden setting sun centered at `sunX = (pWinTop1.x + pWinTop2.x) * 0.44`. Polished oak parquet flooring reflects this grazing golden light.
2. *Inference*:
   - The sunlight throw extends diagonally across the floor corridor `c: 0..5, r: 1..6`.
   - Beam axis is centered along `r = 3.2 + c * 0.3`.
   - Distance falloff: `falloff = (1 - c / 6.5) * (1 - Math.abs((r - 3.2) - c * 0.3) / 3.2)`.
   - Subtle atmospheric shimmer: `shimmer = Math.sin(frame * 0.04 + c * 0.7 + r * 0.5) * 0.04`.
   - Applying `ctx.fillStyle = COLOR_SUNSET_SHEEN` with `ctx.globalAlpha = sheenAlpha` paints a warm golden specular sheen on the parquet tiles.
   - Stroking the top-left tile facet (from `ptX - halfW, ptY + halfH` to `ptX, ptY`) with `COLOR_SUNSET_GLINT` (`#fef08a`) recreates the realistic varnish specular highlight facing the Naples sunset.

### 2.4 Cold-Aisle Glow & Cool Mist in Datacenter Vault (`drawUndergroundFloor`)
1. *Observation*: The cold aisle occupies tiles `c: 2..4, r: 2..4`. High-density server environments utilize pressurized sub-floor airflow (18-20°C) delivered through perforated tiles.
2. *Inference*:
   - Pulsing glow: `const pulse = 0.5 + 0.5 * Math.sin(frame * 0.06 + (c + r) * 0.8)`. Modulating arc radius `13 + pulse * 5` and `globalAlpha = 0.18 + pulse * 0.22` creates a smooth respiratory energy pulse.
   - Aisle outline pulse: When `pulse > 0.55`, stroking tile boundaries with `#38bdf8` highlights the cold aisle containment perimeter.
   - Perforated grille holes: 2x2 ventilation holes breathe with `globalAlpha = 0.6 + pulse * 0.4`.
   - Cool mist: 2 particles per cold aisle tile (18 particles total). Phase-seeded lifecycle `t = ((frame * 0.32 + mSeed) % 60) / 60` rises 24px vertically (`mistY = ptY + halfH - t * 24`), drifts slightly in airflow, and fades with `mistAlpha = Math.sin(t * Math.PI) * 0.28`.

---

## 3. Caveats
1. **Backward Compatibility**: To ensure other tests and potential legacy callers do not break, all updated functions in `roomRenderers.ts` (`drawWarmParquetFloor`, `drawUndergroundFloor`, `drawChunkyAdminDesk`, `drawChunkyNeapolitanBar`) declare `frame: number = 0` as a default parameter.
2. **File Ownership Discipline**: According to `TEAM_PROTOCOL.md`, `art-director` owns `src/canvas/roomRenderers.ts` and `gameplay-dev` owns `src/components/IsometricOfficeCanvas.tsx`. This report provides exact copy-pasteable diffs and code snippets for both agents.
3. **Canvas State Safety**: When adjusting `ctx.globalAlpha`, callers must either use `ctx.save()` / `ctx.restore()` or explicitly reset `ctx.globalAlpha = 1.0` before proceeding to avoid contaminating subsequent render operations.

---

## 4. Conclusion & Actionable Code Proposals

### 4.1 New Export: `drawSteamPlume` in `src/canvas/roomRenderers.ts`

Add module-level constants and the `drawSteamPlume` function near the top of `src/canvas/roomRenderers.ts`:

```typescript
// --- Procedural Rendering Constants (Zero Heap Allocation) ---
const COLOR_STEAM = '#fef3c7';
const COLOR_PARQUET_LIGHT = '#b45309';
const COLOR_PARQUET_DARK = '#92400e';
const COLOR_PARQUET_STROKE = '#78350f';
const COLOR_RUG_LIGHT = '#0284c7';
const COLOR_RUG_DARK = '#0369a1';
const COLOR_RUG_STROKE = '#075985';
const COLOR_SUNSET_SHEEN = '#fb923c';
const COLOR_SUNSET_GLINT = '#fef08a';
const COLOR_TARGET_FILL = 'rgba(254, 240, 138, 0.5)';
const COLOR_TARGET_STROKE = '#f59e0b';

const COLOR_VAULT_SLATE_1 = '#1e293b';
const COLOR_VAULT_SLATE_2 = '#151d2f';
const COLOR_VAULT_AISLE_1 = '#1e293b';
const COLOR_VAULT_AISLE_2 = '#0f172a';
const COLOR_VAULT_STROKE_DEF = '#090d16';
const COLOR_VAULT_STROKE_AISLE = '#0284c7';
const COLOR_VAULT_STROKE_PULSE = '#38bdf8';
const COLOR_CYAN_GLOW = '#38bdf8';
const COLOR_COOL_MIST = '#bae6fd';
const COLOR_TARGET_CYAN = 'rgba(56, 189, 248, 0.4)';
const PI2 = Math.PI * 2;

/**
 * Procedural rising steam plume with zero heap allocations per frame.
 * @param ctx 2D Canvas context
 * @param sx Source X coordinate (origin of steam)
 * @param sy Source Y coordinate (top of cup/vent)
 * @param frame Monotonic animation frame counter
 * @param count Number of staggered steam particles (default: 6)
 */
export const drawSteamPlume = (
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  frame: number,
  count = 6
) => {
  ctx.save();
  ctx.fillStyle = COLOR_STEAM;
  for (let i = 0; i < count; i++) {
    // Phase-shifted particle lifecycle [0, 1)
    const t = ((frame * 0.4 + i * (60 / count)) % 60) / 60;
    const y = sy - t * 24;
    const x = sx + Math.sin(frame * 0.08 + i * 1.5) * (2 + t * 4);
    const r = 1.2 + t * 3.2;
    // Dissipates to 0 as it ascends
    const alpha = (1 - t) * 0.42;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, PI2);
    ctx.fill();
  }
  ctx.restore();
};
```

---

### 4.2 Integration into `drawChunkyNeapolitanBar` (`src/canvas/roomRenderers.ts`)

Update function signature and append counter cup with steam plume:

```typescript
// 7. Chunky Neapolitan Bar & Pizza Box
export const drawChunkyNeapolitanBar = (
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  canvasW: number,
  frame: number = 0
) => {
  const pt = gridToScreen(gx, gy, canvasW);
  const bw = 68;
  const bh = 36;
  const bx = pt.x - bw / 2;
  const by = pt.y - bh + 14;

  ctx.beginPath();
  ctx.ellipse(pt.x, pt.y + 12, 40, 12, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fill();

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, bw, bh);

  ctx.fillStyle = '#451a03';
  ctx.fillRect(bx, by + bh, bw, 8);

  // Faema E61 Espresso Machine
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(bx + 4, by - 20, 26, 22);
  ctx.fillStyle = '#475569';
  ctx.fillRect(bx + 8, by - 16, 18, 8);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(bx + 8, by + 2, 7, 3);
  ctx.fillRect(bx + 17, by + 2, 7, 3);

  // Portafilter handle
  ctx.fillStyle = '#94a3b8';
  ctx.beginPath();
  ctx.moveTo(bx + 34, by - 14);
  ctx.lineTo(bx + 43, by - 14);
  ctx.lineTo(bx + 44, by + 2);
  ctx.lineTo(bx + 33, by + 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#475569';
  ctx.fillRect(bx + 38, by - 17, 2, 3);

  // Ceramic espresso cup on the counter with dark roast crema
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(bx + 33, by + 2, 7, 8);
  ctx.fillStyle = '#3e1c00'; // rich Neapolitan espresso crema
  ctx.fillRect(bx + 34, by + 3, 5, 3);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(bx + 39, by + 4, 2, 4);

  // Steam plumes: freshly poured cup + espresso machine group heads
  drawSteamPlume(ctx, bx + 36, by + 1, frame, 6);
  drawSteamPlume(ctx, bx + 16, by - 4, frame + 30, 4);

  // Pizza box
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(bx + 46, by + 4, 20, 20);
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(bx + 46, by + 4, 20, 20);

  ctx.fillStyle = '#ea580c';
  ctx.beginPath();
  ctx.arc(bx + 56, by + 14, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(bx + 54, by + 12, 3, 3);
  ctx.fillRect(bx + 57, by + 14, 3, 3);
  ctx.fillStyle = '#16a34a';
  ctx.fillRect(bx + 55, by + 13, 2.5, 2.5);
};
```

---

### 4.3 Integration into `drawChunkyAdminDesk` (`src/canvas/roomRenderers.ts`)

Update function signature and cup steam:

```typescript
// 5. Chunky Admin Workstation Desk
export const drawChunkyAdminDesk = (
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  canvasW: number,
  done: boolean,
  frame: number = 0
) => {
  const pt = gridToScreen(gx, gy, canvasW);
  const dw = 76;
  const dh = 40;
  const dx = pt.x - dw / 2;
  const dy = pt.y - 20;

  ctx.beginPath();
  ctx.ellipse(pt.x, pt.y + 16, 46, 16, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fill();

  ctx.fillStyle = '#78350f';
  ctx.fillRect(dx, dy, dw, dh);
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 2;
  ctx.strokeRect(dx, dy, dw, dh);

  ctx.fillStyle = '#451a03';
  ctx.fillRect(dx, dy + dh, dw, 7);

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(dx + 2, dy + dh + 7, 4, 14);
  ctx.fillRect(dx + dw - 6, dy + dh + 7, 4, 14);

  // Left Monitor: Cisco IOS CLI
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(dx + 6, dy - 32, 30, 26);
  ctx.fillStyle = '#052e16';
  ctx.fillRect(dx + 8, dy - 30, 26, 22);
  ctx.fillStyle = done ? '#34d399' : '#10b981';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('Switch#', dx + 10, dy - 18);
  ctx.fillText('>_ cli', dx + 10, dy - 9);

  // Right Monitor: Packet Tracer
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(dx + 40, dy - 32, 30, 26);
  ctx.fillStyle = '#082f49';
  ctx.fillRect(dx + 42, dy - 30, 26, 22);
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(dx + 50, dy - 20, 3.5, 0, Math.PI * 2);
  ctx.arc(dx + 60, dy - 16, 3.5, 0, Math.PI * 2);
  ctx.arc(dx + 54, dy - 26, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Keyboard & Mouse
  ctx.fillStyle = '#334155';
  ctx.fillRect(dx + 22, dy + 14, 30, 10);
  ctx.fillStyle = '#64748b';
  ctx.fillRect(dx + 56, dy + 15, 6, 8);

  // Steaming Espresso Ceramic Cup with Handle & Crema
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(dx + 8, dy + 12, 8, 10);
  ctx.fillStyle = '#3e1c00'; // rich espresso crema
  ctx.fillRect(dx + 9, dy + 12, 6, 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(dx + 15, dy + 14, 2, 5);

  // Procedural rising steam plume from cup
  drawSteamPlume(ctx, dx + 12, dy + 10, frame, 5);

  // Ergonomic Chair
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(pt.x, pt.y + 24, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#475569';
  ctx.stroke();

  const badgeY = dy - 44;
  ctx.beginPath();
  ctx.arc(pt.x, badgeY, 13, 0, Math.PI * 2);
  ctx.fillStyle = done ? '#052e16' : '#451a03';
  ctx.fill();
  ctx.strokeStyle = done ? '#10b981' : '#f59e0b';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = done ? '#34d399' : '#fbbf24';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(done ? '✓' : '!', pt.x, badgeY + 4);
};
```

---

### 4.4 Sunset Sheen & Specular Highlights in `drawWarmParquetFloor` (`src/canvas/roomRenderers.ts`)

Rewrite `drawWarmParquetFloor` with inlined math, zero object allocations, sunset golden sheen, and varnish specular glints:

```typescript
// 2. Warm Parquet Floor with Cisco Blue Carpet in Center & Sunset Specular Sheen
export const drawWarmParquetFloor = (
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  tgt: TilePos | null,
  frame: number = 0
) => {
  const originX = canvasW * 0.5;
  const halfW = TILE_W * 0.5; // 48
  const halfH = TILE_H * 0.5; // 24

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      // Inlined projection: zero heap allocation
      const ptX = (c - r) * halfW + originX;
      const ptY = (c + r) * halfH + ORIGIN_Y;
      const isAlternate = (c + r) % 2 === 0;

      ctx.beginPath();
      ctx.moveTo(ptX, ptY);
      ctx.lineTo(ptX + halfW, ptY + halfH);
      ctx.lineTo(ptX, ptY + TILE_H);
      ctx.lineTo(ptX - halfW, ptY + halfH);
      ctx.closePath();

      const isRug = c >= 3 && c <= 5 && r >= 3 && r <= 5;

      if (isRug) {
        ctx.fillStyle = isAlternate ? COLOR_RUG_DARK : COLOR_RUG_LIGHT;
        ctx.fill();
        ctx.strokeStyle = COLOR_RUG_STROKE;
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.fillStyle = isAlternate ? COLOR_PARQUET_LIGHT : COLOR_PARQUET_DARK;
        ctx.fill();
        ctx.strokeStyle = COLOR_PARQUET_STROKE;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // --- SUNSET SPECULAR SHEEN & REFLECTIONS FROM PANORAMIC NAPLES WINDOW ---
      // Window is on left wall (gx = 0, gy: 1.0..6.2). Golden light casts across corridor c: 0..5, r: 1..6.
      if (c <= 5 && r >= 1 && r <= 6) {
        const beamDist = Math.abs((r - 3.2) - c * 0.3);
        if (beamDist < 3.2) {
          const falloff = (1 - c / 6.5) * (1 - beamDist / 3.2);
          const shimmer = Math.sin(frame * 0.04 + c * 0.7 + r * 0.5) * 0.04;
          const sheenAlpha = Math.max(0, Math.min(0.26, falloff * 0.22 + shimmer));

          if (sheenAlpha > 0.015) {
            // Warm golden specular sheen fill
            ctx.fillStyle = COLOR_SUNSET_SHEEN;
            ctx.globalAlpha = sheenAlpha;
            ctx.fill();

            // Specular varnish glint on tile top-left facet facing panoramic window
            ctx.strokeStyle = COLOR_SUNSET_GLINT;
            ctx.lineWidth = 1.2;
            ctx.globalAlpha = sheenAlpha * 1.6;
            ctx.beginPath();
            ctx.moveTo(ptX - halfW, ptY + halfH);
            ctx.lineTo(ptX, ptY);
            ctx.stroke();

            // Reset alpha
            ctx.globalAlpha = 1.0;
          }
        }
      }

      if (tgt && Math.round(tgt.x) === c && Math.round(tgt.y) === r) {
        ctx.fillStyle = COLOR_TARGET_FILL;
        ctx.fill();
        ctx.strokeStyle = COLOR_TARGET_STROKE;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    }
  }
};
```

---

### 4.5 Pulsing Cyan Glow & Cool Mist in `drawUndergroundFloor` (`src/canvas/roomRenderers.ts`)

Rewrite `drawUndergroundFloor` with inlined math, zero object allocations, sinusoidal pulsing glow, glowing grilles, and 18 cool mist particles:

```typescript
// 12. Raised Datacenter Floor with Perforated Cooling Grilles & Cool Mist Particles
export const drawUndergroundFloor = (
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  tgt: TilePos | null,
  frame: number = 0
) => {
  const originX = canvasW * 0.5;
  const halfW = TILE_W * 0.5; // 48
  const halfH = TILE_H * 0.5; // 24

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      // Inlined projection: zero heap allocation
      const ptX = (c - r) * halfW + originX;
      const ptY = (c + r) * halfH + ORIGIN_Y;
      const isAlternate = (c + r) % 2 === 0;

      ctx.beginPath();
      ctx.moveTo(ptX, ptY);
      ctx.lineTo(ptX + halfW, ptY + halfH);
      ctx.lineTo(ptX, ptY + TILE_H);
      ctx.lineTo(ptX - halfW, ptY + halfH);
      ctx.closePath();

      // Cold aisle perforated tiles down the central corridor
      const isColdAisle = (c >= 2 && c <= 4 && r >= 2 && r <= 4);

      if (isColdAisle) {
        ctx.fillStyle = isAlternate ? COLOR_VAULT_AISLE_1 : COLOR_VAULT_AISLE_2;
        ctx.fill();

        // Sinusoidal pulsing glow calculation
        const pulse = 0.5 + 0.5 * Math.sin(frame * 0.06 + (c + r) * 0.8);
        ctx.strokeStyle = pulse > 0.55 ? COLOR_VAULT_STROKE_PULSE : COLOR_VAULT_STROKE_AISLE;
        ctx.lineWidth = pulse > 0.55 ? 1.8 : 1.5;
        ctx.stroke();

        // Sub-floor cyan cooling glow (expands and breathes)
        const glowRadius = 13 + pulse * 5;
        const glowAlpha = 0.18 + pulse * 0.22;
        ctx.fillStyle = COLOR_CYAN_GLOW;
        ctx.globalAlpha = glowAlpha;
        ctx.beginPath();
        ctx.arc(ptX, ptY + halfH, glowRadius, 0, PI2);
        ctx.fill();

        // Perforated grille holes with illuminated ventilation airflow
        ctx.globalAlpha = 0.6 + pulse * 0.4;
        for (let dx = -8; dx <= 8; dx += 8) {
          for (let dy = -4; dy <= 4; dy += 4) {
            ctx.fillRect(ptX + dx, ptY + halfH + dy, 2, 2);
          }
        }
        ctx.globalAlpha = 1.0;

        // Cool mist particles rising from sub-floor pressurized airflow
        for (let m = 0; m < 2; m++) {
          const mSeed = c * 7 + r * 13 + m * 31;
          const t = ((frame * 0.32 + mSeed) % 60) / 60;
          const mistY = (ptY + halfH) - t * 24;
          const mistX = ptX + Math.sin(frame * 0.07 + mSeed) * (3 + t * 4);
          const mistR = 1.0 + t * 2.8;
          const mistAlpha = Math.sin(t * Math.PI) * 0.28;

          if (mistAlpha > 0.02) {
            ctx.fillStyle = COLOR_COOL_MIST;
            ctx.globalAlpha = mistAlpha;
            ctx.beginPath();
            ctx.arc(mistX, mistY, mistR, 0, PI2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1.0;
      } else {
        ctx.fillStyle = isAlternate ? COLOR_VAULT_SLATE_1 : COLOR_VAULT_SLATE_2;
        ctx.fill();
        ctx.strokeStyle = COLOR_VAULT_STROKE_DEF;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      if (tgt && Math.round(tgt.x) === c && Math.round(tgt.y) === r) {
        ctx.fillStyle = COLOR_TARGET_CYAN;
        ctx.fill();
        ctx.strokeStyle = COLOR_CYAN_GLOW;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    }
  }
};
```

---

### 4.6 Updates to `src/components/IsometricOfficeCanvas.tsx`

Pass `frame` to all floor and coffee station renderers:

```diff
--- a/src/components/IsometricOfficeCanvas.tsx
+++ b/src/components/IsometricOfficeCanvas.tsx
@@ -273,8 +273,8 @@
       // --- 1. ROOM WALLS & FLOORS ---
       if (currentRoom === 'office') {
         drawWarmHabboWalls(ctx, canvas.width, frame);
-        drawWarmParquetFloor(ctx, canvas.width, tgt);
+        drawWarmParquetFloor(ctx, canvas.width, tgt, frame);
         drawSunlightBeams(ctx, canvas.width);
       } else {
         drawUndergroundDatacenterWalls(ctx, canvas.width, frame);
-        drawUndergroundFloor(ctx, canvas.width, tgt);
+        drawUndergroundFloor(ctx, canvas.width, tgt, frame);
       }

@@ -314,5 +314,5 @@
           {
             id: 'terminal',
             depth: 5 + 2,
-            draw: (context) => drawChunkyAdminDesk(context, 5, 2, canvas.width, level2Done)
+            draw: (context) => drawChunkyAdminDesk(context, 5, 2, canvas.width, level2Done, frame)
           },
@@ -324,5 +324,5 @@
           {
             id: 'coffee',
             depth: 1 + 6,
-            draw: (context) => drawChunkyNeapolitanBar(context, 1, 6, canvas.width)
+            draw: (context) => drawChunkyNeapolitanBar(context, 1, 6, canvas.width, frame)
           },
```

---

## 5. Verification Method

To verify these implementations independently:

1. **Compiler Integrity & Zero Errors**:
   ```bash
   cd /root/.gemini/antigravity-cli/scratch/cisco-cyber-office
   npm run build
   ```
   *Expected Result*: Exits with code 0; 0 TypeScript errors.

2. **Automated 5-Gate Deterministic QA Suite**:
   ```bash
   cd /root/.gemini/antigravity-cli/scratch/cisco-cyber-office
   node pipeline/run_qa_suite.mjs
   ```
   *Expected Result*: All 5 gates PASS (100%):
   - Gate 1: Build 0 errors.
   - Gate 2: Mobile portrait 412x915 layout 0 overflow, canvas >= 12 color buckets.
   - Gate 3: Elevator vertical transit to Datacenter Vault (-1F) passes.
   - Gate 4: Wireshark DPI console interaction passes.
   - Gate 5: Desktop widescreen 1920x1080 layout passes, 0 console errors.

3. **Zero-Heap-Allocation Verification**:
   - In Google Chrome DevTools: Open `Performance` tab -> check `Memory` checkbox -> Record 5 seconds of canvas loop.
   - *Expected Result*: Heap allocation timeline shows a completely flat line (0 heap allocations per frame; no sawtooth pattern or GC pauses).
   - Canvas FPS remains locked at a rock-solid 60 FPS (frame execution time `< 2.5 ms`).

4. **Visual Atmospheric Acceptance**:
   - **Office (1F)**: Espresso cup on Bar Napoletano and Admin Desk emit continuous, natural rising steam wafts. Parquet floor tiles catch warm golden sunset specular sheen and facet glints from the panoramic window.
   - **Datacenter Vault (-1F)**: Central cold aisle tiles (2..4, 2..4) pulse with respiratory cyan/blue glow, and cool mist particles continuously rise into the cold aisle corridor.
