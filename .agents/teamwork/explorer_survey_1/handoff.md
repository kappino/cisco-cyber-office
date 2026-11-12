# Handoff Report: Survey Exploration 1 — Canvas Rendering Pipeline, Isometric Environment, Particles & Avatar Animation Systems

## 1. Observation

### Codebase Structure, Build Setup & Baseline Status
- **Repository Architecture**: React 18 (`react@18.3.1`, `react-dom@18.3.1`) + Vite 5 (`vite@5.4.10`) + TypeScript 5.6 (`typescript@~5.6.2`) + TailwindCSS 3.4 + Framer Motion (`framer-motion@^14.12.0`) + Lucide React (`lucide-react@^1.72.0`).
- **Build Verification**: Executed `npm run build` (`tsc -b && vite build`):
  ```
  vite v5.4.21 building for production...
  ✓ built in 4.46s (Exit code: 0, 0 TypeScript errors)
  ```
- **Deterministic QA Suite**: Executed `node pipeline/run_qa_suite.mjs` against Chromium (Mobile `412x915` and Desktop `1920x1080`):
  ```
  === ALL 5 DETERMINISTIC QA GATES PASSED 100% ===
  Gate 1: Zero TS / bundler errors.
  Gate 2: Mobile Office Initial (312 color buckets, 0 overflow, 0 collisions).
  Gate 3: Elevator transit to -1F confirmed (142 color buckets).
  Gate 4: Wireshark DPI solved, ACL applied, badge awarded.
  Gate 5: Desktop Widescreen (325 color buckets, 0 runtime/console errors).
  ```

### Isometric Math & Grid System (`src/canvas/isoMath.ts`)
- **Projection Constants**:
  - `GRID_SIZE = 8` (8x8 tile matrix: `c: 0..7`, `r: 0..7`).
  - `TILE_W = 96` px, `TILE_H = 48` px (strict 2:1 dimetric ratio).
  - `ORIGIN_Y = 205` px, `originX = canvasW / 2` (420 px on 840 px canvas).
- **Coordinate Transforms**:
  - `gridToScreen(gx, gy, canvasW)` (lines 22-27):
    - `sx = (gx - gy) * (TILE_W / 2) + canvasW / 2`
    - `sy = (gx + gy) * (TILE_H / 2) + ORIGIN_Y`
  - `screenToGrid(sx, sy, canvasW)` (lines 29-36):
    - `gx = ((sx - originX) / 48 + (sy - ORIGIN_Y) / 24) / 2`
    - `gy = ((sy - ORIGIN_Y) / 24 - (sx - originX) / 48) / 2`
- **Entity Contract**:
  - `Entity` interface (lines 16-20): `{ id: string; depth: number; draw: (ctx: CanvasRenderingContext2D, animFrame: number) => void }`.
  - Depth formula: `depth = gridX + gridY`. Sorting: `entities.sort((a, b) => a.depth - b.depth)`.

### Canvas Rendering Pipeline & Lifecycle (`src/components/IsometricOfficeCanvas.tsx`)
- **Canvas Resolution**: Fixed buffer `width={840} height={620}` (lines 357-358). CSS class `w-full max-w-4xl h-auto`.
- **Render Loop**: Driven by `requestAnimationFrame(render)` inside `useEffect` (lines 173-351).
- **Frame State**: Integer counter `animFrameRef.current++` passed to all renderers.
- **Layers & Draw Sequence**:
  1. `ctx.clearRect(0, 0, canvas.width, canvas.height)`
  2. Radial gradient backdrop (`#1e2438`->`#090d16` for office; `#101726`->`#030712` for datacenter vault)
  3. Static room structures: walls (`drawWarmHabboWalls` or `drawUndergroundDatacenterWalls`), floors (`drawWarmParquetFloor` or `drawUndergroundFloor`), sunlight beams (`drawSunlightBeams`).
  4. Dynamic Depth-Sorted Entities: player avatar + room interactive objects.
- **Current Proximity & Movement**:
  - Walk speed: `walkSpeed = 0.08 + stats.skills.caffeineEndurance * 0.02` per frame.
  - Direction calculation: `dx >= 0 && dy >= 0 -> 'SE'`, `dx <= 0 && dy >= 0 -> 'SW'`, `dx >= 0 && dy <= 0 -> 'NE'`, `dx <= 0 && dy <= 0 -> 'NW'`.
  - Proximity radius: `Math.hypot(s.interactX - p.x, s.interactY - p.y) < 1.3`.

### Room Environments & Objects (`src/canvas/roomRenderers.ts`)
- **Ufficio Panoramico (1F)**:
  - Walls: Left terracotta brick (`#7c2d12`), panoramic window showing Golfo di Napoli, Vesuvio with smoke plume (`(midWinX - 2, midWinY - 30 - smokeY * 0.4)`), animated golden sea reflections; Right brick wall with SSC Napoli and Futuro Remoto posters.
  - Floor: 8x8 oak parquet (`#b45309` / `#92400e`). Central Cisco Blue Carpet occupies `c: 3..5, r: 3..5` (`#0369a1` / `#0284c7`). **Tile (4, 4) in the center of the carpet is currently completely empty**.
  - Entities:
    - Server Rack (2, 2, depth 4)
    - Admin Desk (5, 2, depth 7): left monitor Cisco IOS CLI, right monitor Packet Tracer, coffee cup, ergonomic chair
    - SOC Threat Wall (6, 4, depth 10): rotating radar sweep line
    - Bar Napoletano (1, 6, depth 7): espresso machine, pizza box
    - Industrial Elevator (6, 1, depth 7)
    - Monstera Plant (7, 7, depth 14)
    - Marco NPC (2, 5, depth 7)
- **Datacenter Sotterraneo / Vault (-1F)**:
  - Walls: Reinforced concrete, cable ladder with fiber optics, rotating ventilation fan at (0, 3.5), right blast wall with telemetry panel and pulsing emergency red beacon.
  - Floor: Slate raised floor with central cold aisle cooling grilles at `c: 2..4, r: 2..4`. Sub-floor blue cooling glow is currently a static arc `rgba(56, 189, 248, 0.25)`.
  - Entities:
    - Wireshark DPI Console (2, 2, depth 4)
    - Cisco Firepower 4100 (5, 2, depth 7)
    - Cisco UCS SAN Vault (2, 5, depth 7)
    - Industrial Elevator (6, 1, depth 7)
    - SecBot Sentinel AI Drone (1, 6, depth 7, hovering `Math.sin(frame * 0.08) * 5`)

### Avatar System (`src/canvas/characterRenderers.ts`)
- **Current Avatar Function**: `drawCharmingHabboAvatar(ctx, p, canvasW, dir, isWalking, frame, avatar, playerLevel)` (lines 86-237).
- **Current Animation States**:
  - Walking: leg swing (`walkCycle = Math.sin(frame * 0.35) * 4`), arm swing (`armSwing = -walkCycle * 3`).
  - Idle: breathing bob (`breathe = Math.sin(frame * 0.08) * 1.5`).
  - Direction: 'SE' and 'SW' render front face and eyes; 'NE' and 'NW' render back of hair.
  - Customization: skin tone, hair style (`spiky`, `curly`, `cyber`, `short`), accessories (`glasses`, `cyber-visor`).
  - Nametag: floating pill with `[Lv.${playerLevel}] ${avatar.name}`.
- **Missing Avatar Capabilities (R2)**:
  - No seated pose or chair sitting animation.
  - No auto-orientation toward consoles/desks on arrival.
  - No coffee emote bubble or golden speed aura trails.
  - No victory celebration jump or sparkle stars on mission clear.

---

## 2. Logic Chain

1. **Deterministic 60 FPS Without Garbage Collection**:
   - *Observation*: The existing canvas loop in `IsometricOfficeCanvas.tsx` runs at 60 FPS via `requestAnimationFrame` using an incrementing integer `frame` counter. Existing animations in `roomRenderers.ts` (e.g. radar line, ventilation fan, SecBot hover, blinking LEDs) use pure trigonometric and modulo functions of `frame` without allocating heap objects.
   - *Inference*: Implementing particle systems (steam, golden trails, celebration stars) and screen data streams as procedural, frame-indexed mathematical functions (or static fixed-size circular buffers) ensures zero GC pauses, maintains 60 FPS, and avoids memory bloat.

2. **Central Cisco Hologram Placement (R1)**:
   - *Observation*: `drawWarmParquetFloor` explicitly defines a 3x3 Cisco Blue Carpet at `c: 3..5, r: 3..5` (lines 258-265). Currently, there is no entity stationed at the carpet center `(gx: 4, gy: 4)`.
   - *Inference*: Placing a new entity `hologram` at `gx: 4, gy: 4` with `depth: 8` perfectly centers the rotating Cisco 3D hologram in the room. In the Datacenter Vault, this same tile `(4, 4)` is the center of the cold aisle, which can house a glowing cybersecurity data hologram or rotating badge.

3. **Multi-Station Seated Poses & Auto-Orientation (R2)**:
   - *Observation*: `drawChunkyAdminDesk` renders an ergonomic office chair at `(pt.x, pt.y + 24)` facing the desk at `gx: 5, gy: 2`. The interact spot is `interactX: 5, interactY: 3.2`. Similarly, `drawChunkyWiresharkConsole` is at `(2, 2)` with interact spot `(2.5, 3.2)`.
   - *Inference*: In `IsometricOfficeCanvas.tsx`, when the player arrives at `interactSpot` for `terminal` or `wireshark` (`dist < 0.3` and `!isWalking`), the avatar state should transition to `isSitting = true` and orient `dir = 'NW'`. In `characterRenderers.ts`, `isSitting` drops the torso by 8px, draws legs bent forward onto the seat, and raises hands to type on the keyboard with alternating finger taps.

4. **Diegetic Emotes & Speed Trails (R2)**:
   - *Observation*: In `HabboOffice.tsx`, clicking coffee calls `onCoffeeBoost()` and sets a message, but does not provide visual canvas feedback.
   - *Inference*: Adding a `caffeineBoostTimer` (e.g. 300 frames / 5 seconds) to `IsometricOfficeCanvas.tsx` allows:
     a) Rendering a floating Habbo emote bubble above the avatar's nametag displaying a steaming espresso cup or pizza slice.
     b) Emitting a 3-point golden after-image trail behind the player when walking.
     c) Temporarily boosting `walkSpeed`.

5. **Victory Celebration (R2)**:
   - *Observation*: `App.tsx` updates `level1Done`..`level4Done`. These boolean flags are passed down to `IsometricOfficeCanvas.tsx`.
   - *Inference*: Tracking previous completion states via a ref inside `IsometricOfficeCanvas.tsx` allows detecting the instant a level is completed, triggering a 180-frame celebration sequence: a sine-wave jump (`jumpY = -Math.sin(...) * 20`), cheering pose (`\o/`), happy eyes, and radial burst of golden sparkle stars.

6. **Decoupled Architecture & Team Protocols**:
   - *Observation*: `TEAM_PROTOCOL.md` assigns `src/canvas/roomRenderers.ts`, `src/canvas/characterRenderers.ts`, and `src/canvas/isoMath.ts` to `art-director`, and `src/components/IsometricOfficeCanvas.tsx` to `gameplay-dev`.
   - *Inference*: All visual drawing routines (hologram, steam particles, screen data streams, sitting poses, celebration stars, emote bubbles) belong in `roomRenderers.ts` and `characterRenderers.ts`. All state transitions (sitting detection, coffee boost countdown, celebration triggers) belong in `IsometricOfficeCanvas.tsx`. This avoids cross-agent collision.

---

## 3. Caveats

- **No Shared Dynamic State In Types Yet**: `AvatarConfig` in `src/types/game.ts` only holds persistent customization (hair, skin, clothing colors). Transient animation states (`isSitting`, `isCelebrating`, `caffeineBoostRemaining`) should be passed as optional arguments to `drawCharmingHabboAvatar` or managed inside `IsometricOfficeCanvas.tsx` rather than mutating `AvatarConfig` in LocalStorage.
- **Puppeteer Headless Canvas Testing**: `pipeline/run_qa_suite.mjs` verifies color bucket diversity (`uniqueColors >= 12` and `nonBlackPixels > 25%`). Dynamic particles, glowing floor reflections, and rotating holograms will enrich the color space without breaking any pixel thresholds.
- **Mobile Touch Coordinates**: Click-to-walk uses `screenToGrid` with canvas scaling. Sitting detection must allow a reasonable proximity threshold (`0.4 - 0.6` grid units) so both mobile touch and desktop clicks reliably snap into the seated position.

---

## 4. Conclusion & Actionable Recommendations

### Architectural Split & Module Work Breakdown

| Feature | Target File | Owning Agent | Implementation Details |
| :--- | :--- | :--- | :--- |
| **Steam Particles** | `src/canvas/roomRenderers.ts` | `art-director` | Procedural 6-particle steam plume generator in `drawChunkyNeapolitanBar` and `drawChunkyAdminDesk`. Rises 24px, expands, and fades with sine waver. |
| **Animated CLI / Packet Screens** | `src/canvas/roomRenderers.ts` | `art-director` | Multi-line scrolling Cisco IOS text (`show ip route`, `vlan 20`, blinking block cursor) in `drawChunkyAdminDesk`; live glowing packet pulses in Packet Tracer; scrolling hex/threat lines in `drawChunkySocWall` & `drawChunkyWiresharkConsole`. |
| **Sunset Reflections & Blue Floor Glow** | `src/canvas/roomRenderers.ts` | `art-director` | `drawWarmParquetFloor`: warm golden specular sheen on parquet tiles in window throw (`rgba(251, 146, 60, ...)`). `drawUndergroundFloor`: dynamic pulsing cyan cooling glow (`rgba(56, 189, 248, pulse)`) and upward cool air particles. |
| **Rotating Cisco Hologram** | `src/canvas/roomRenderers.ts` & `IsometricOfficeCanvas.tsx` | `art-director` + `gameplay-dev` | New function `drawCiscoHologram(ctx, gx, gy, canvasW, frame)`: circular projector base on carpet, translucent blue projection cone, 3D rotating 9-bar Cisco bridge / cyber shield, scanline flicker, orbiting sparks. Added as entity at (4, 4) in `IsometricOfficeCanvas.tsx`. |
| **Avatar Seated Pose** | `src/canvas/characterRenderers.ts` & `IsometricOfficeCanvas.tsx` | `art-director` + `gameplay-dev` | `drawCharmingHabboAvatar`: add `isSitting: boolean`. Torso lowered 8px, legs drawn horizontal onto chair, hands on desk typing. `IsometricOfficeCanvas.tsx`: detect proximity to `terminal` (5, 2) and `wireshark` (2, 2) to trigger sitting. |
| **Coffee Emote & Golden Speed Trails** | `src/canvas/characterRenderers.ts` & `IsometricOfficeCanvas.tsx` | `art-director` + `gameplay-dev` | `drawCharmingHabboAvatar`: add `coffeeBoostTimer: number`. Render floating emote bubble above nametag (steaming cup / pizza slice) and 3 golden silhouette after-images trailing feet when walking. |
| **Celebration Jump & Stars** | `src/canvas/characterRenderers.ts` & `IsometricOfficeCanvas.tsx` | `art-director` + `gameplay-dev` | `drawCharmingHabboAvatar`: add `celebrationTimer: number`. Sine-wave leap (`jumpY`), cheering pose (`\o/`), happy eyes, and ring of 8 orbiting sparkling golden stars. |

### Concrete Implementation Snippets

#### 1. Steam Particle System (`roomRenderers.ts`)
```typescript
export const drawSteamPlume = (ctx: CanvasRenderingContext2D, sx: number, sy: number, frame: number, count = 6) => {
  ctx.save();
  for (let i = 0; i < count; i++) {
    const t = ((frame * 0.4 + i * (60 / count)) % 60) / 60; // 0..1 lifecycle
    const y = sy - t * 24;
    const x = sx + Math.sin(frame * 0.08 + i * 1.5) * (3 + t * 4);
    const r = 1.5 + t * 3.5;
    const alpha = (1 - t) * 0.45;
    ctx.fillStyle = `rgba(254, 243, 199, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};
```

#### 2. Rotating Cisco Hologram (`roomRenderers.ts`)
```typescript
export const drawCiscoHologram = (ctx: CanvasRenderingContext2D, gx: number, gy: number, canvasW: number, frame: number) => {
  const pt = gridToScreen(gx, gy, canvasW);
  const rot = frame * 0.04;
  const pulse = 0.5 + Math.sin(frame * 0.1) * 0.2;

  // 1. Projector Base Emitter on Floor
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(pt.x, pt.y + 12, 34, 16, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  ctx.strokeStyle = `rgba(0, 188, 235, ${pulse + 0.3})`;
  ctx.lineWidth = 2;
  ctx.stroke();

  // 2. Upward Hologram Light Cone
  const coneGrad = ctx.createLinearGradient(pt.x, pt.y + 12, pt.x, pt.y - 70);
  coneGrad.addColorStop(0, 'rgba(0, 188, 235, 0.35)');
  coneGrad.addColorStop(1, 'rgba(0, 188, 235, 0.0)');
  ctx.beginPath();
  ctx.moveTo(pt.x - 28, pt.y + 12);
  ctx.lineTo(pt.x - 42, pt.y - 65);
  ctx.lineTo(pt.x + 42, pt.y - 65);
  ctx.lineTo(pt.x + 28, pt.y + 12);
  ctx.closePath();
  ctx.fillStyle = coneGrad;
  ctx.fill();

  // 3. 3D Rotating Cisco 9-Bar Bridge Logo
  const barHeights = [10, 16, 22, 28, 36, 28, 22, 16, 10];
  const barWidth = 3;
  const radius = 26;
  const holoCenterY = pt.y - 48 + Math.sin(frame * 0.06) * 4;

  for (let i = 0; i < 9; i++) {
    const angle = rot + (i - 4) * 0.24;
    const bx = pt.x + Math.sin(angle) * radius;
    const depthScale = (Math.cos(angle) + 1.6) / 2.6;
    const bh = barHeights[i] * depthScale;
    const bAlpha = 0.4 + (Math.cos(angle) + 1) * 0.3;

    ctx.fillStyle = `rgba(56, 189, 248, ${bAlpha})`;
    ctx.fillRect(bx - (barWidth * depthScale) / 2, holoCenterY - bh / 2, barWidth * depthScale, bh);
  }

  // 4. Scanline flicker
  const scanY = holoCenterY - 30 + ((frame * 1.5) % 50);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pt.x - 30, scanY);
  ctx.lineTo(pt.x + 30, scanY);
  ctx.stroke();

  ctx.restore();
};
```

#### 3. Seated Avatar & Typing Hands (`characterRenderers.ts`)
```typescript
// Inside drawCharmingHabboAvatar:
if (isSitting) {
  // Sitting on chair: drop torso & head by 8px
  // Draw horizontal thighs:
  ctx.fillStyle = avatar.pantsColor;
  ctx.fillRect(pt.x - 10, pt.y + 2, 10, 8); // left thigh
  ctx.fillRect(pt.x + 1, pt.y + 2, 10, 8);  // right thigh
  // Lower legs dropping toward floor:
  ctx.fillRect(pt.x - 8, pt.y + 8, 7, 8);
  ctx.fillRect(pt.x + 3, pt.y + 8, 7, 8);
  // Typing hands animation:
  const typingOffset = (frame % 10 < 5) ? 1.5 : -1.5;
  ctx.fillStyle = avatar.skinTone;
  ctx.fillRect(pt.x - 14, pt.y - 4 + typingOffset, 5, 4);
  ctx.fillRect(pt.x + 9, pt.y - 4 - typingOffset, 5, 4);
}
```

---

## 5. Verification Method

To independently verify these findings and ensure 100% adherence to all project constraints:

1. **Build Integrity Verification**:
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
   *Expected Result*: All 5 gates PASS:
   - Gate 1: Build 0 errors.
   - Gate 2: Mobile portrait 412x915 layout 0 overflow, canvas >= 12 color buckets.
   - Gate 3: Elevator vertical transit to Datacenter Vault (-1F) passes.
   - Gate 4: Wireshark DPI console interaction passes.
   - Gate 5: Desktop widescreen 1920x1080 layout passes, 0 console errors.

3. **Invalidation Conditions**:
   - Any modification to `pipeline/*` or `ART_STANDARDS.md` violating dimetric 2:1 ratio (96x48) or depth formula `x + y`.
   - Any React state update loop inside `requestAnimationFrame` causing framerate drops below 60 FPS or memory leaks.
   - Any cross-module write violation outside the `TEAM_PROTOCOL.md` ownership matrix.
