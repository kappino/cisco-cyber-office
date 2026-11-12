# Handoff Report: Explorer M3-2 — Coffee Break Emote Bubble & Golden Speed Trails System

## 1. Observation

### Existing Codebase Inspection

1. **Avatar Renderer (`src/canvas/characterRenderers.ts`)**:
   - Current function signature (lines 86-95):
     ```typescript
     export const drawCharmingHabboAvatar = (
       ctx: CanvasRenderingContext2D,
       p: TilePos,
       canvasW: number,
       dir: Direction,
       isWalking: boolean,
       frame: number,
       avatar: AvatarConfig,
       playerLevel: number
     ) => {
     ```
   - Current nametag positioning (lines 227-236):
     ```typescript
     // Floating Habbo Nametag
     ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
     ctx.fillRect(pt.x - 55, pt.y - 74 + breathe, 110, 18);
     ctx.strokeStyle = '#00bceb';
     ctx.lineWidth = 1;
     ctx.strokeRect(pt.x - 55, pt.y - 74 + breathe, 110, 18);

     ctx.fillStyle = '#ffffff';
     ctx.font = 'bold 10px monospace';
     ctx.textAlign = 'center';
     ctx.fillText(`[Lv.${playerLevel}] ${avatar.name}`, pt.x, pt.y - 61 + breathe);
     ```
   - *Observation*: There is currently no floating emote bubble rendered above the nametag, nor is there any visual speed trail or speed boost effect behind the avatar during movement.

2. **Canvas Lifecycle & Render Loop (`src/components/IsometricOfficeCanvas.tsx`)**:
   - Walking speed calculation (line 196):
     ```typescript
     const walkSpeed = 0.08 + stats.skills.caffeineEndurance * 0.02;
     ```
   - Footstep cadence (line 212):
     ```typescript
     const stepInterval = stats.skills.caffeineEndurance > 0 ? 9 : 11;
     ```
   - Player entity registration in depth sorter (lines 285-300):
     ```typescript
     const entities: Entity[] = [
       {
         id: 'player',
         depth: p.x + p.y,
         draw: (context) => drawCharmingHabboAvatar(
           context, 
           p, 
           canvas.width, 
           playerDirRef.current, 
           isWalkingRef.current, 
           frame, 
           avatar, 
           stats.level
         )
       }
     ];
     ```
   - *Observation*: The render loop currently does not track any `caffeineBoostTimerRef`. Walking speed only factors in the permanent passive skill `stats.skills.caffeineEndurance`, not the dynamic coffee boost. There is no historical position buffer for after-image trails.

3. **Coffee Action Triggering in Game Scene (`src/components/HabboOffice.tsx`)**:
   - In `handleCoffeeClick` (lines 99-103):
     ```typescript
     const handleCoffeeClick = () => {
       sound.playCoffee();
       onCoffeeBoost();
       setNpcDialogue("Pausa Napoletana: Ti sei gustato una tazza di espresso bollente e una fetta di pizza margherita! +40 XP guadagnati e velocità aumentata!");
     };
     ```
   - In `handleTriggerSpot` (lines 120-122):
     ```typescript
     } else if (spot.isCoffee) {
       handleCoffeeClick();
     }
     ```
   - In `IsometricOfficeCanvas` invocation (lines 253-267):
     ```tsx
     <IsometricOfficeCanvas
       avatar={avatar}
       stats={stats}
       currentRoom={currentRoom}
       level1Done={level1Done}
       level2Done={level2Done}
       level3Done={level3Done}
       level4Done={level4Done}
       activeSpot={activeSpot}
       setActiveSpot={setActiveSpot}
       onTriggerSpot={handleTriggerSpot}
       onChangeRoom={onRoomChange}
       targetSpotId={targetSpotId}
       onClearTargetSpot={() => setTargetSpotId(null)}
     />
     ```
   - *Observation*: `handleCoffeeClick` plays audio (`sound.playCoffee()`), triggers `onCoffeeBoost()` (which awards 40 XP in `App.tsx`), and sets dialogue text, but **passes zero information or trigger events to `IsometricOfficeCanvas`**. Consequently, the canvas cannot visually react to coffee consumption.

4. **Interface Contract in `PROJECT.md` (lines 70-71)**:
   - Specification declares:
     ```typescript
     drawCharmingHabboAvatar(ctx, p, canvasW, dir, isWalking, frame, avatar, playerLevel, isSitting, caffeineBoostTimer, celebrationTimer)
     ```

5. **Empirical Verification Baseline (`pipeline/run_qa_suite.mjs`)**:
   - `npm run build`: exits code 0, 0 TypeScript errors.
   - `node pipeline/run_qa_suite.mjs`: ALL 5 GATES PASSED 100% (Mobile 412x915 layout 0 overflow, Datacenter -1F transit confirmed, Wireshark DPI minigame passed, Desktop 1920x1080 0 console errors).

---

## 2. Logic Chain

1. **Diegetic Emote Bubble Positioning & Motion**:
   - *Observation*: The nametag top boundary is at `pt.y - 74 + breathe`, with height 18px.
   - *Logic*: To place the comic/speech emote bubble floating directly above the player's nametag, the bubble's center should be at `pt.y - 94 + breathe + bobY`.
   - *Logic*: Specifying `bobY = Math.sin(frame * 0.1) * 2` creates an organic, gentle 2px floating bob oscillation at ~1 Hz (period = $2\pi / 0.1 \approx 62.8$ frames $\approx 1.05$ s).
   - *Logic*: Adding a triangular pointer tail at the bubble base pointing down to `pt.y - 76 + breathe + bobY` grounds the bubble diegetically to the avatar's nametag and head.

2. **Pixel Art Alternation (Espresso Cup & Pizza Slice)**:
   - *Observation*: The dialogue text in `HabboOffice.tsx:102` explicitly states *"Ti sei gustato una tazza di espresso bollente e una fetta di pizza margherita!"*.
   - *Logic*: Alternating between the steaming espresso cup and the pizza slice every 90 frames (1.5 seconds) using `const showPizza = Math.floor(frame / 90) % 2 === 1` delivers both iconic Neapolitan elements in a lively, animated comic bubble.
   - *Logic*: The espresso cup features brown porcelain (`#78350f`), golden hazelnut crema (`#d97706` and `#fbbf24`), white ceramic saucer (`#e2e8f0`), handle arc, and 2 procedural rising steam curves swaying via `Math.sin(frame * 0.15)` and `Math.cos(frame * 0.15)`.
   - *Logic*: The pizza slice features golden baked cornicione crust (`#c2410c`), crimson marinara base (`#dc2626`), melty mozzarella yellow wedge (`#fde047`), pepperoni slices (`#991b1b`), fresh green basil leaf dot (`#16a34a`), and a wispy rising steam curve.

3. **Zero-Heap-Allocation Circular Position Buffer**:
   - *Observation*: In a 60 FPS animation loop, creating array allocations (e.g. `[...history, pos]` or `{ x, y }`) creates ~180 object allocations per second, provoking V8 minor garbage collection stutters.
   - *Logic*: By pre-allocating a fixed 3-node ring buffer `speedTrailBufferRef` and a fixed 3-node echo array `speedTrailEchoesRef` using `useRef` upon component mount, we can update `.x`, `.y`, `.dir`, `.alpha`, and `.active` in-place.
   - *Logic*: Sampling player coordinates every 3 frames while `isWalkingRef.current && caffeineBoostTimerRef.current > 0` produces 3 distinct echoes spanning 3, 6, and 9 frames of history (~50 to 90 ms apart), yielding a clear, staggered trail behind the shoes.
   - *Logic*: Decaying gold alphas $[0.55, 0.35, 0.18]$ (using `rgba(251, 191, 36, alpha)`) create the illusion of an evaporating after-image aura. When the player stops walking, echoes smoothly decay (`alpha *= 0.82`) over ~5 frames rather than vanishing abruptly.

4. **Event Coordination Between `HabboOffice` and `IsometricOfficeCanvas`**:
   - *Observation*: `handleCoffeeClick()` is invoked both when the player clicks the Action Dock "Bar & Pizza" button and when the player interacts with the coffee machine via keyboard or tap.
   - *Logic*: Introducing an incrementing counter state `coffeeBoostTrigger` in `HabboOffice.tsx` and passing it as a prop to `IsometricOfficeCanvas` ensures that every coffee action triggers a fresh 300-frame (5-second) boost timer (`caffeineBoostTimerRef.current = 300`).
   - *Logic*: When boosted, `walkSpeed` is multiplied by $1.5\times$ and `stepInterval` is reduced from $11 \to 6$ frames, giving the player immediate tactile and acoustic speed feedback alongside the visual trails.

5. **Multi-Agent Coordination Integrity**:
   - *Observation*: `explorer_m3_1` introduces `isSitting: boolean`, and `explorer_m3_3` introduces `celebrationTimer: number`.
   - *Logic*: Supporting `drawCharmingHabboAvatar(ctx, p, canvasW, dir, isWalking, frame, avatar, playerLevel, isSitting = false, caffeineBoostTimer = 0, celebrationTimer = 0, speedTrails?: readonly SpeedTrailPoint[])` ensures full backward compatibility with Milestone 2 (where only 8 args were supplied) while enabling all Milestone 3 features to coexist without signature collision.

---

## 3. Caveats

1. **Sitting and Caffeine Boost Concurrency**:
   - If a player drinks coffee and immediately sits down at a workstation (Admin Desk or Wireshark Console), the speed trails properly disappear (because `isWalkingRef.current` is `false`), but the floating emote bubble continues to bob happily above their nametag until the 300-frame timer elapses. This is diegetically coherent.
2. **Elevator Room Transit**:
   - If the player drinks coffee on 1F and immediately takes the elevator to -1F, `caffeineBoostTimerRef.current` should persist across the room change (or reset). Storing the timer ref in `IsometricOfficeCanvas` maintains the boost for the remaining duration.
3. **Canvas Bounds Clipping**:
   - When the avatar is at the very top edge of the room (tile `gx: 0, gy: 0`), `pt.y - 94` is approximately `111px` below the top of the canvas buffer (which is 620px tall), so the emote bubble will never clip outside the canvas viewport.

---

## 4. Conclusion & Actionable Implementation Plan

### Architecture Overview

| Component | Responsibility | Changes Required |
| :--- | :--- | :--- |
| `src/canvas/characterRenderers.ts` | Visual rendering of emote & speed aura | Export `SpeedTrailPoint`, `drawCaffeineEmoteBubble`, `drawGoldenSpeedTrails`. Enhance `drawCharmingHabboAvatar` with `caffeineBoostTimer` and `speedTrails`. |
| `src/components/IsometricOfficeCanvas.tsx` | Circular buffer & physics speed boost | Accept `coffeeBoostTrigger` prop. Maintain `caffeineBoostTimerRef`, 3-node ring buffer `speedTrailBufferRef`, 1.5x speed boost, and 6-frame footstep cadence. |
| `src/components/HabboOffice.tsx` | User action dispatch | Add `coffeeBoostTrigger` state, increment in `handleCoffeeClick`, pass to `IsometricOfficeCanvas`. |

---

### Concrete Code Diff & Snippets

#### 1. `src/canvas/characterRenderers.ts`

```typescript
// Add SpeedTrailPoint interface and exported renderers:

export interface SpeedTrailPoint {
  x: number;
  y: number;
  dir: Direction;
  alpha: number;
  active: boolean;
}

/**
 * Renders the diegetic Habbo emote bubble floating above the player's nametag.
 * Features a gentle floating bob motion, drop shadow, speech bubble tail,
 * and pixel art that alternates between a steaming espresso cup and a Neapolitan pizza slice.
 */
export const drawCaffeineEmoteBubble = (
  ctx: CanvasRenderingContext2D,
  anchorX: number,
  nametagTopY: number,
  frame: number,
  caffeineBoostTimer: number
) => {
  ctx.save();

  // Gentle floating bob motion (Math.sin(frame * 0.1) * 2)
  const bobY = Math.sin(frame * 0.1) * 2;
  const bubbleAlpha = Math.min(1, caffeineBoostTimer / 25);
  ctx.globalAlpha = bubbleAlpha;

  // Geometry
  const bubbleW = 36;
  const bubbleH = 26;
  const bubbleCenterX = anchorX;
  const bubbleCenterY = nametagTopY - 20 + bobY;
  const bx = bubbleCenterX - bubbleW / 2;
  const by = bubbleCenterY - bubbleH / 2;
  const radius = 6;

  // 1. Drop Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.roundRect(bx + 1.5, by + 1.5, bubbleW, bubbleH, radius);
  ctx.fill();

  // 2. Bubble Body & Pointer Tail
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(bx, by, bubbleW, bubbleH, radius);
  ctx.fill();

  // Pointer Tail pointing down towards the nametag
  ctx.beginPath();
  ctx.moveTo(bubbleCenterX - 4, by + bubbleH - 1);
  ctx.lineTo(bubbleCenterX, nametagTopY - 3 + bobY);
  ctx.lineTo(bubbleCenterX + 4, by + bubbleH - 1);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Outline
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(bx, by, bubbleW, bubbleH, radius);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(bubbleCenterX - 4, by + bubbleH);
  ctx.lineTo(bubbleCenterX, nametagTopY - 3 + bobY);
  ctx.lineTo(bubbleCenterX + 4, by + bubbleH);
  ctx.stroke();

  // Erase inner seam between bubble and tail
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bubbleCenterX - 3, by + bubbleH);
  ctx.lineTo(bubbleCenterX + 3, by + bubbleH);
  ctx.stroke();

  // 3. Pixel Art Inside Bubble (Alternates every 90 frames / 1.5s)
  const showPizza = Math.floor(frame / 90) % 2 === 1;

  if (!showPizza) {
    // === PIXEL ART STEAMING ESPRESSO CUP ===
    const cupY = bubbleCenterY + 2;

    // Ceramic Saucer
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(bubbleCenterX - 8, cupY + 6, 16, 2);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(bubbleCenterX - 6, cupY + 7, 12, 1);

    // Brown Porcelain Cup
    ctx.fillStyle = '#78350f';
    ctx.fillRect(bubbleCenterX - 6, cupY - 2, 12, 8);
    ctx.fillRect(bubbleCenterX - 5, cupY + 5, 10, 1.5);

    // Cup Highlight
    ctx.fillStyle = '#b45309';
    ctx.fillRect(bubbleCenterX - 5, cupY - 1, 2, 6);

    // Porcelain Handle
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(bubbleCenterX + 7, cupY + 2, 2.5, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();

    // Golden Crema
    ctx.fillStyle = '#d97706';
    ctx.fillRect(bubbleCenterX - 5, cupY - 3, 10, 2);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(bubbleCenterX - 2, cupY - 3, 4, 1.5);

    // Rising Steam Curves (Procedural animated wisps)
    const steamWiggle1 = Math.sin(frame * 0.15) * 2;
    const steamWiggle2 = Math.cos(frame * 0.15) * 2;

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.8)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(bubbleCenterX - 2, cupY - 4);
    ctx.quadraticCurveTo(bubbleCenterX - 2 + steamWiggle1, cupY - 8, bubbleCenterX - 1, cupY - 12);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(bubbleCenterX + 2, cupY - 4);
    ctx.quadraticCurveTo(bubbleCenterX + 2 + steamWiggle2, cupY - 9, bubbleCenterX + 3, cupY - 13);
    ctx.stroke();
  } else {
    // === PIXEL ART NEAPOLITAN PIZZA SLICE ===
    const pizzaY = bubbleCenterY;

    // Baked Golden Cornicione Crust
    ctx.fillStyle = '#c2410c';
    ctx.beginPath();
    ctx.moveTo(bubbleCenterX - 8, pizzaY - 7);
    ctx.lineTo(bubbleCenterX + 8, pizzaY - 7);
    ctx.lineTo(bubbleCenterX + 7, pizzaY - 4);
    ctx.lineTo(bubbleCenterX - 7, pizzaY - 4);
    ctx.closePath();
    ctx.fill();

    // Red Tomato Marinara Wedge
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(bubbleCenterX - 7, pizzaY - 4);
    ctx.lineTo(bubbleCenterX + 7, pizzaY - 4);
    ctx.lineTo(bubbleCenterX, pizzaY + 8);
    ctx.closePath();
    ctx.fill();

    // Melted Mozzarella Layer
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.moveTo(bubbleCenterX - 5, pizzaY - 3);
    ctx.lineTo(bubbleCenterX + 5, pizzaY - 3);
    ctx.lineTo(bubbleCenterX, pizzaY + 6);
    ctx.closePath();
    ctx.fill();

    // Pepperoni / Salamino Dots
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(bubbleCenterX - 3, pizzaY - 2, 2.5, 2.5);
    ctx.fillRect(bubbleCenterX + 1, pizzaY + 1, 2.5, 2.5);

    // Fresh Basil Leaf Dot
    ctx.fillStyle = '#16a34a';
    ctx.fillRect(bubbleCenterX, pizzaY - 2, 2, 2);

    // Mozzarella drip at tip
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(bubbleCenterX - 0.5, pizzaY + 8, 1, 2);

    // Rising Warm Steam
    const pizzaSteam = Math.sin(frame * 0.15) * 1.5;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bubbleCenterX, pizzaY - 8);
    ctx.quadraticCurveTo(bubbleCenterX + pizzaSteam, pizzaY - 11, bubbleCenterX, pizzaY - 14);
    ctx.stroke();
  }

  ctx.restore();
};

/**
 * Renders the 3-point golden speed aura after-image echoes trailing the avatar's feet.
 * Decays with rgba(251, 191, 36, alpha).
 */
export const drawGoldenSpeedTrails = (
  ctx: CanvasRenderingContext2D,
  trails: readonly SpeedTrailPoint[],
  canvasW: number,
  frame: number
) => {
  ctx.save();

  // Iterate oldest-to-newest so younger echoes draw on top
  for (let i = trails.length - 1; i >= 0; i--) {
    const trail = trails[i];
    if (!trail.active || trail.alpha <= 0.01) continue;

    const tPt = gridToScreen(trail.x, trail.y, canvasW);
    const alpha = trail.alpha;

    // 1. Golden Floor Speed Aura Oval
    ctx.beginPath();
    ctx.ellipse(tPt.x, tPt.y + 16, 18, 7, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(251, 191, 36, ${alpha * 0.45})`;
    ctx.fill();

    // 2. Golden Footwear After-Image
    ctx.fillStyle = `rgba(251, 191, 36, ${alpha})`;
    ctx.fillRect(tPt.x - 8, tPt.y + 8, 7, 7);
    ctx.fillRect(tPt.x + 1, tPt.y + 8, 7, 7);

    // Sole Highlights
    ctx.fillStyle = `rgba(254, 240, 138, ${alpha})`;
    ctx.fillRect(tPt.x - 8, tPt.y + 13, 7, 2);
    ctx.fillRect(tPt.x + 1, tPt.y + 13, 7, 2);

    // Faint Shin / Trousers Silhouette
    ctx.fillStyle = `rgba(245, 158, 11, ${alpha * 0.7})`;
    ctx.fillRect(tPt.x - 7, tPt.y - 2, 6, 10);
    ctx.fillRect(tPt.x + 1, tPt.y - 2, 6, 10);

    // 3. Trailing Speed Sparkles
    ctx.fillStyle = `rgba(252, 211, 77, ${alpha})`;
    const sparkY = tPt.y + 12 - ((frame * 0.7 + i * 4) % 10);
    ctx.fillRect(tPt.x - 6 + ((i * 6) % 12), sparkY, 2, 2);
  }

  ctx.restore();
};

// In drawCharmingHabboAvatar update signature and call sites:
export const drawCharmingHabboAvatar = (
  ctx: CanvasRenderingContext2D,
  p: TilePos,
  canvasW: number,
  dir: Direction,
  isWalking: boolean,
  frame: number,
  avatar: AvatarConfig,
  playerLevel: number,
  isSitting: boolean = false,
  caffeineBoostTimer: number = 0,
  celebrationTimer: number = 0,
  speedTrails?: readonly SpeedTrailPoint[]
) => {
  // 1. Render Golden Speed Trails before floor shadow
  if (speedTrails && speedTrails.length > 0 && caffeineBoostTimer > 0) {
    drawGoldenSpeedTrails(ctx, speedTrails, canvasW, frame);
  }

  const pt = gridToScreen(p.x, p.y, canvasW);
  // ... existing body drawing ...

  // Floating Habbo Nametag
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fillRect(pt.x - 55, pt.y - 74 + breathe, 110, 18);
  ctx.strokeStyle = '#00bceb';
  ctx.lineWidth = 1;
  ctx.strokeRect(pt.x - 55, pt.y - 74 + breathe, 110, 18);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`[Lv.${playerLevel}] ${avatar.name}`, pt.x, pt.y - 61 + breathe);

  // 2. Render Floating Emote Bubble above nametag during caffeine boost
  if (caffeineBoostTimer > 0) {
    drawCaffeineEmoteBubble(ctx, pt.x, pt.y - 74 + breathe, frame, caffeineBoostTimer);
  }
};
```

---

#### 2. `src/components/IsometricOfficeCanvas.tsx`

```typescript
// Add coffeeBoostTrigger to Props interface:
interface Props {
  avatar: AvatarConfig;
  stats: PlayerStats;
  currentRoom?: RoomId;
  level1Done: boolean;
  level2Done: boolean;
  level3Done: boolean;
  level4Done?: boolean;
  activeSpot: InteractiveSpot | null;
  setActiveSpot?: (spot: InteractiveSpot | null) => void;
  onTriggerSpot: (spot: InteractiveSpot) => void;
  onChangeRoom?: (room: RoomId) => void;
  targetSpotId?: string | null;
  onClearTargetSpot?: () => void;
  coffeeBoostTrigger?: number; // Milestone 3: Caffeine boost event trigger
}

// Inside IsometricOfficeCanvas component:
const SPEED_TRAIL_SAMPLE_INTERVAL = 3;
const SPEED_TRAIL_COUNT = 3;

export const IsometricOfficeCanvas: React.FC<Props> = ({
  // ... existing props
  coffeeBoostTrigger,
}) => {
  // ... existing refs
  const caffeineBoostTimerRef = useRef<number>(0);

  // Pre-allocated circular buffer (ZERO heap allocations per frame)
  const speedTrailBufferRef = useRef<Array<{ x: number; y: number; dir: Direction; active: boolean; frame: number }>>([
    { x: 4, y: 5, dir: 'SE', active: false, frame: 0 },
    { x: 4, y: 5, dir: 'SE', active: false, frame: 0 },
    { x: 4, y: 5, dir: 'SE', active: false, frame: 0 }
  ]);
  const speedTrailHeadRef = useRef<number>(0);
  const lastTrailSampleFrameRef = useRef<number>(0);

  // Pre-allocated array of 3 echoes passed to avatar renderer
  const speedTrailEchoesRef = useRef<[SpeedTrailPoint, SpeedTrailPoint, SpeedTrailPoint]>([
    { x: 4, y: 5, dir: 'SE', alpha: 0, active: false },
    { x: 4, y: 5, dir: 'SE', alpha: 0, active: false },
    { x: 4, y: 5, dir: 'SE', alpha: 0, active: false }
  ]);

  // Handle coffeeBoostTrigger
  useEffect(() => {
    if (coffeeBoostTrigger && coffeeBoostTrigger > 0) {
      caffeineBoostTimerRef.current = 300; // 5 seconds at 60 FPS
    }
  }, [coffeeBoostTrigger]);

  // Inside render() in useEffect:
  const render = () => {
    animFrameRef.current++;
    const frame = animFrameRef.current;

    // Decrement caffeine boost timer
    if (caffeineBoostTimerRef.current > 0) {
      caffeineBoostTimerRef.current--;
    }

    const isCaffeineBoosted = caffeineBoostTimerRef.current > 0;
    const boostMultiplier = isCaffeineBoosted ? 1.5 : 1.0;
    const walkSpeed = (0.08 + stats.skills.caffeineEndurance * 0.02) * boostMultiplier;

    // Faster footstep cadence during boost
    const stepInterval = isCaffeineBoosted ? 6 : (stats.skills.caffeineEndurance > 0 ? 9 : 11);

    // ... handle target movement ...

    // Update speed trail circular buffer (Zero heap allocations)
    const echoes = speedTrailEchoesRef.current;
    const buffer = speedTrailBufferRef.current;

    if (isCaffeineBoosted && isWalkingRef.current) {
      if (frame - lastTrailSampleFrameRef.current >= SPEED_TRAIL_SAMPLE_INTERVAL) {
        lastTrailSampleFrameRef.current = frame;
        const head = speedTrailHeadRef.current;
        buffer[head].x = cur.x;
        buffer[head].y = cur.y;
        buffer[head].dir = playerDirRef.current;
        buffer[head].active = true;
        buffer[head].frame = frame;
        speedTrailHeadRef.current = (head + 1) % SPEED_TRAIL_COUNT;
      }

      const head = speedTrailHeadRef.current;
      const baseAlphas = [0.55, 0.35, 0.18]; // Decaying gold alpha
      const timerFade = caffeineBoostTimerRef.current < 30 ? caffeineBoostTimerRef.current / 30 : 1;

      for (let i = 0; i < SPEED_TRAIL_COUNT; i++) {
        const bufIdx = (head - 1 - i + SPEED_TRAIL_COUNT) % SPEED_TRAIL_COUNT;
        const sample = buffer[bufIdx];
        echoes[i].x = sample.x;
        echoes[i].y = sample.y;
        echoes[i].dir = sample.dir;
        echoes[i].active = sample.active && (frame - sample.frame < 24);
        echoes[i].alpha = baseAlphas[i] * timerFade;
      }
    } else {
      // Smoothly fade out active echoes when stopped
      for (let i = 0; i < SPEED_TRAIL_COUNT; i++) {
        if (echoes[i].active) {
          echoes[i].alpha *= 0.82;
          if (echoes[i].alpha < 0.02) {
            echoes[i].active = false;
            echoes[i].alpha = 0;
          }
        }
      }
      if (!isCaffeineBoosted) {
        for (let j = 0; j < SPEED_TRAIL_COUNT; j++) {
          buffer[j].active = false;
        }
      }
    }

    // Pass caffeineBoostTimer and speedTrails to player entity:
    const entities: Entity[] = [
      {
        id: 'player',
        depth: p.x + p.y,
        draw: (context) => drawCharmingHabboAvatar(
          context,
          p,
          canvas.width,
          playerDirRef.current,
          isWalkingRef.current,
          frame,
          avatar,
          stats.level,
          false, // isSitting (coordinated with explorer_m3_1)
          caffeineBoostTimerRef.current, // caffeineBoostTimer
          0, // celebrationTimer (coordinated with explorer_m3_3)
          speedTrailEchoesRef.current // speedTrails (zero heap allocation)
        )
      }
    ];
```

---

#### 3. `src/components/HabboOffice.tsx`

```typescript
// Add coffeeBoostTrigger state:
const [coffeeBoostTrigger, setCoffeeBoostTrigger] = useState<number>(0);

// In handleCoffeeClick:
const handleCoffeeClick = () => {
  sound.playCoffee();
  onCoffeeBoost();
  setCoffeeBoostTrigger(k => k + 1);
  setNpcDialogue("Pausa Napoletana: Ti sei gustato una tazza di espresso bollente e una fetta di pizza margherita! +40 XP guadagnati e velocità aumentata!");
};

// In JSX:
<IsometricOfficeCanvas
  avatar={avatar}
  stats={stats}
  currentRoom={currentRoom}
  level1Done={level1Done}
  level2Done={level2Done}
  level3Done={level3Done}
  level4Done={level4Done}
  activeSpot={activeSpot}
  setActiveSpot={setActiveSpot}
  onTriggerSpot={handleTriggerSpot}
  onChangeRoom={onRoomChange}
  targetSpotId={targetSpotId}
  onClearTargetSpot={() => setTargetSpotId(null)}
  coffeeBoostTrigger={coffeeBoostTrigger}
/>
```

---

## 5. Verification Method

To independently verify the implementation:

1. **Build & Type Check**:
   ```bash
   cd /root/.gemini/antigravity-cli/scratch/cisco-cyber-office
   npm run build
   ```
   *Expected Result*: Exits with code 0; 0 TypeScript errors.

2. **Deterministic 5-Gate QA Suite**:
   ```bash
   cd /root/.gemini/antigravity-cli/scratch/cisco-cyber-office
   node pipeline/run_qa_suite.mjs
   ```
   *Expected Result*: 100% PASS on all 5 gates. Gate 2 color buckets $\ge 12$, zero layout overflow, 0 console errors.

3. **In-Browser Interactive Coffee Boost Verification**:
   - Navigate to the office scene.
   - Click the "Bar & Pizza" quick button or tap on the Neapolitan Bar at tile `(1, 6)`.
   - Click "PRENDI ESPRESSO & PIZZA".
   - *Verify*:
     1. Sound plays (`sound.playCoffee()`).
     2. Dialogue card displays *"Pausa Napoletana: Ti sei gustato una tazza di espresso bollente e una fetta di pizza margherita! +40 XP guadagnati e velocità aumentata!"*.
     3. An animated Habbo comic bubble appears above the player's nametag, bobbing gently via `Math.sin(frame * 0.1) * 2`.
     4. Inside the bubble, a pixel-art steaming espresso cup (brown porcelain, crema, rising steam curves) renders, alternating every 1.5 seconds with a Neapolitan pizza slice.
     5. Tap the floor to walk: the avatar moves visibly faster ($1.5\times$ speed), footsteps click faster (6 frames), and 3 golden speed aura echoes (`rgba(251, 191, 36, alpha)`) trail behind the shoes.
     6. When the avatar stops, the echoes smoothly decay within 5 frames without freezing or snapping.
     7. After 5 seconds (300 frames), the emote bubble fades out smoothly.

4. **Invalidation Conditions**:
   - Any per-frame object or array allocation inside `render()` or `drawGoldenSpeedTrails` (e.g. `[...trail]` or `{ x, y }`).
   - Breaking the 5 QA gates in `pipeline/run_qa_suite.mjs`.
   - Modifying `AvatarConfig` in LocalStorage for transient animation states instead of ephemeral refs.
