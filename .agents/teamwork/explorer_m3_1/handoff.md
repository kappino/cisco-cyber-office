# Handoff Report: Milestone 3 — Living Avatar Seated Pose & Workstation Orientation (R2)

## 1. Observation

### Codebase Inspection & Geometry Analysis
- **Avatar Rendering Pipeline (`src/canvas/characterRenderers.ts`)**:
  - `drawCharmingHabboAvatar` is declared at lines 86-95:
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
  - Upper body elements currently reference standing coordinates:
    - Torso / Shirt: lines 128-133: `ctx.fillRect(pt.x - 13, pt.y - 28 + breathe, 26, 22)`.
    - Head: lines 155-157: `ctx.fillRect(pt.x - 11, pt.y - 48 + breathe, 22, 20)`.
    - Floating Nametag: lines 227-236: `ctx.fillRect(pt.x - 55, pt.y - 74 + breathe, 110, 18)`.
  - Standing legs/pants are drawn vertically:
    - Pants / Slacks: lines 117-119: `ctx.fillRect(pt.x - 8, pt.y - 6, 7, 15)` and `ctx.fillRect(pt.x + 1, pt.y - 6, 7, 15)`.
    - Shoes: lines 108-110: `ctx.fillRect(pt.x - 9, pt.y + 8 + legOffset, 8, 7)` and `ctx.fillRect(pt.x + 1, pt.y + 8 - legOffset, 8, 7)`.
  - Standing arms hang vertically:
    - Sleeves: lines 140-142: `ctx.fillRect(pt.x - 17, pt.y - 26 + breathe + armSwing, 4, 16)` and `ctx.fillRect(pt.x + 13, pt.y - 26 + breathe - armSwing, 4, 16)`.
    - Hands: lines 145-147: `ctx.fillRect(pt.x - 17, pt.y - 10 + breathe + armSwing, 4, 5)` and `ctx.fillRect(pt.x + 13, pt.y - 10 + breathe - armSwing, 4, 5)`.

- **Workstation Coordinates & Proximity Contract (`src/data/workstations.ts`)**:
  - 1F Panoramic Office Workstation (`terminal`):
    - Tile position: `(tileX: 5, tileY: 2)`.
    - Interaction target spot: `(interactX: 5, interactY: 3.2)` (lines 115-119).
    - Ergonomic office chair rendered in `src/canvas/roomRenderers.ts` at `pt.x, pt.y + 24` (line 760).
  - -1F Datacenter Vault Workstation (`wireshark`):
    - Tile position: `(tileX: 2, tileY: 2)`.
    - Interaction target spot: `(interactX: 2.5, interactY: 3.2)` (lines 37-41).
    - Rendered in `src/canvas/roomRenderers.ts` (`drawChunkyWiresharkConsole`, lines 1512-1612).

- **Movement & Animation Lifecycle (`src/components/IsometricOfficeCanvas.tsx`)**:
  - Movement update logic at lines 198-232 updates `isWalkingRef.current` to `true` when moving towards target, or `false` when target is reached (`dist <= 0.06`).
  - Direction calculation currently only handles walking vectors (lines 219-222). When movement terminates, the previous direction is preserved.
  - Avatar entity creation at lines 285-300:
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

- **Build & QA Verification Results**:
  - `npm run build` (`tsc -b && vite build`) built cleanly in 9.05s with 0 errors.
  - `node pipeline/run_qa_suite.mjs` passed all 5 gates 100% (Mobile layout, Elevator transit, Wireshark DPI minigame, Desktop widescreen, zero console errors).

---

## 2. Logic Chain

1. **Lowering Torso and Head by 8px**:
   - *Observation*: In canvas 2D screen coordinates, Y increases downward. Upper body parts (torso, collar, ears, head, hair, accessories, nametag) are anchored relative to `pt.y`.
   - *Reasoning*: Defining `sitOffset = isSitting ? 8 : 0` and `yShift = sitOffset + breathe` lowers the entire upper body by exactly 8 pixels downward toward the chair seat. Maintaining `yShift` across all upper body draw calls preserves Habbo pixel proportions without misalignments.

2. **Horizontal Bent Thighs & Vertical Lower Legs**:
   - *Observation*: When standing, trousers span `pt.y - 6` to `pt.y + 9` (15px vertical).
   - *Reasoning*: When sitting with `sitOffset = 8`, the bottom of the torso sits at `pt.y + 2`. Drawing horizontal thighs from `pt.y + 2` to `pt.y + 8` (`fillRect(pt.x - 10, pt.y + 2, 9, 6)` and `fillRect(pt.x + 1, pt.y + 2, 9, 6)`) creates bent thighs resting forward on the chair cushion. Dropping lower legs vertically from the knees at `pt.y + 7` to `pt.y + 15` (`fillRect(pt.x - 8, pt.y + 7, 7, 8)` and `fillRect(pt.x + 2, pt.y + 7, 7, 8)`) with sneakers at `pt.y + 13..17` places the feet naturally on the floor.

3. **Typing Hands on Desk Surface with Alternating Tap Animation**:
   - *Observation*: In `drawChunkyAdminDesk`, desk surface and keyboard are located at `dy + 14 = pt.y - 6`.
   - *Reasoning*: When seated, arms reach forward onto the desk surface. Forearms are positioned at `pt.y - 14 + yShift` (`pt.y - 6`). Hands are placed at `pt.y - 12 + yShift` (`pt.y - 4`). Using `frame % 10 < 5` to toggle an alternating vertical displacement (`±1.5px`) between left and right hands creates a rapid, diegetic typing cadence on the keyboard.

4. **Interact Spot Proximity & Workstation Orientation**:
   - *Observation*: `terminal` interact spot is `(5, 3.2)` in `office` (desk at `(5, 2)`). `wireshark` interact spot is `(2.5, 3.2)` in `datacenter_vault` (console at `(2, 2)`). In both cases, the desk is situated North-West of the player (`dx <= 0 && dy <= 0`).
   - *Reasoning*: Computing Euclidean distance to the active room's workstation spot:
     - Office: `Math.hypot(5 - cur.x, 3.2 - cur.y) < 0.45`
     - Datacenter: `Math.hypot(2.5 - cur.x, 3.2 - cur.y) < 0.45`
     When distance < 0.45 and `!isWalkingRef.current`:
     - Avatar state becomes `isSitting = true`.
     - Direction updates to `playerDirRef.current = 'NW'` and `setPlayerDir('NW')` (guarded by `playerDirRef.current !== 'NW'` to prevent re-render loops).
     - When the player starts walking or moves outside the 0.45 threshold, `isSitting` transitions to `false`, immediately resuming standing posture and normal walking orientation.

5. **Zero Memory Allocation Guarantee**:
   - *Observation*: Allocating objects or arrays in `requestAnimationFrame` triggers garbage collection pressure.
   - *Reasoning*: The proximity check uses scalar arithmetic (`Math.hypot`) with fixed primitive numbers. No arrays, objects, or closures are instantiated per frame. All variables (`isNearTerminal`, `isNearWireshark`, `isSitting`, `yShift`, `typingOffset`) are primitive numbers/booleans allocated on the execution stack.

---

## 3. Caveats

- **Scope Boundary**: Emote bubble & speed trails are assigned to `explorer_m3_2`; victory celebration jump is assigned to `explorer_m3_3`. The parameter `isSitting` is provided as an optional 9th parameter with default `false` (`isSitting: boolean = false`) to maintain complete backwards compatibility with existing callers.
- **Seat Cushion Visual Grounding**: While `drawChunkyAdminDesk` has a static chair base, `drawChunkyWiresharkConsole` in the datacenter vault does not render a standalone chair. To ensure uniform visual quality across all rooms, `drawCharmingHabboAvatar` renders an ergonomic swivel chair cushion (`ellipse(pt.x, pt.y + 7, 16, 7)`) directly under the avatar's thighs when `isSitting === true`.
- **Keyboard Arrow Traversal**: When using keyboard navigation (Arrow keys/WASD), the player can stop anywhere. The 0.45 grid unit proximity radius allows snapping into the seated typing pose both when walking programmatically to the spot and when stopping nearby via manual keys.

---

## 4. Conclusion & Actionable Code Proposals

The seated pose and auto-orientation mechanism is fully designed, tested, and ready for integration.

### Summary of Changes

1. **`src/canvas/characterRenderers.ts`**:
   - Extend `drawCharmingHabboAvatar` with `isSitting: boolean = false`.
   - Apply `yShift = (isSitting ? 8 : 0) + breathe` to lower torso, head, ears, face, hair, and nametag by 8px.
   - Render horizontal bent thighs and vertical lower legs when seated.
   - Render typing arms and alternating tapping hands (`frame % 10 < 5`).
2. **`src/components/IsometricOfficeCanvas.tsx`**:
   - Detect proximity to terminal `(5, 3.2)` or wireshark `(2.5, 3.2)` with `dist < 0.45 && !isWalkingRef.current`.
   - Auto-orient `playerDirRef.current = 'NW'` and `setPlayerDir('NW')`.
   - Pass `isSitting` into `drawCharmingHabboAvatar`.

### Artifacts Delivered in This Directory
- **Patch file**: `/root/.gemini/antigravity-cli/scratch/cisco-cyber-office/.agents/teamwork/explorer_m3_1/m3_1_avatar_sitting.patch`
- **Full proposed characterRenderers**: `/root/.gemini/antigravity-cli/scratch/cisco-cyber-office/.agents/teamwork/explorer_m3_1/proposed_characterRenderers.ts`
- **Full proposed IsometricOfficeCanvas**: `/root/.gemini/antigravity-cli/scratch/cisco-cyber-office/.agents/teamwork/explorer_m3_1/proposed_IsometricOfficeCanvas.tsx`

### Concrete Code Diffs

#### Diff 1: `src/canvas/characterRenderers.ts`
```typescript
<<<<
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
  const pt = gridToScreen(p.x, p.y, canvasW);
  const walkCycle = isWalking ? Math.sin(frame * 0.35) : 0;
  const breathe = !isWalking ? Math.sin(frame * 0.08) * 1.5 : 0;
====
export const drawCharmingHabboAvatar = (
  ctx: CanvasRenderingContext2D,
  p: TilePos,
  canvasW: number,
  dir: Direction,
  isWalking: boolean,
  frame: number,
  avatar: AvatarConfig,
  playerLevel: number,
  isSitting: boolean = false
) => {
  const pt = gridToScreen(p.x, p.y, canvasW);
  const walkCycle = isWalking ? Math.sin(frame * 0.35) : 0;
  const sitOffset = isSitting ? 8 : 0;
  const breathe = isWalking
    ? 0
    : isSitting
      ? Math.sin(frame * 0.1) * 0.8
      : Math.sin(frame * 0.08) * 1.5;
  const yShift = sitOffset + breathe;
>>>>
```

```typescript
<<<<
  // Floor Shadow
  ctx.beginPath();
  ctx.ellipse(pt.x, pt.y + 16, 20, 8, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fill();

  // Shoes & Pants
  const legOffset = walkCycle * 4;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(pt.x - 9, pt.y + 8 + legOffset, 8, 7);
  ctx.fillRect(pt.x + 1, pt.y + 8 - legOffset, 8, 7);
  // White Sneaker Soles
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(pt.x - 9, pt.y + 13 + legOffset, 8, 2);
  ctx.fillRect(pt.x + 1, pt.y + 13 - legOffset, 8, 2);

  // Denim Trousers / Slacks
  ctx.fillStyle = avatar.pantsColor;
  ctx.fillRect(pt.x - 8, pt.y - 6, 7, 15);
  ctx.fillRect(pt.x + 1, pt.y - 6, 7, 15);
====
  // Floor Shadow & Office Chair Base
  if (isSitting) {
    // Swivel chair floor shadow
    ctx.beginPath();
    ctx.ellipse(pt.x, pt.y + 17, 18, 7, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fill();

    // Ergonomic office chair seat cushion
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.ellipse(pt.x, pt.y + 7, 16, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    // Standing floor shadow
    ctx.beginPath();
    ctx.ellipse(pt.x, pt.y + 16, 20, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fill();
  }

  // Legs, Thighs & Shoes
  if (isSitting) {
    // Horizontal bent thighs resting forward on the office chair
    ctx.fillStyle = avatar.pantsColor;
    ctx.fillRect(pt.x - 10, pt.y + 2, 9, 6); // left bent thigh
    ctx.fillRect(pt.x + 1, pt.y + 2, 9, 6);  // right bent thigh

    // Lower legs dropping vertically toward floor
    ctx.fillRect(pt.x - 8, pt.y + 7, 7, 8);  // left shin
    ctx.fillRect(pt.x + 2, pt.y + 7, 7, 8);  // right shin

    // Shoes
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(pt.x - 8, pt.y + 13, 7, 4);
    ctx.fillRect(pt.x + 2, pt.y + 13, 7, 4);

    // White Sneaker Soles resting on floor
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(pt.x - 8, pt.y + 16, 7, 2);
    ctx.fillRect(pt.x + 2, pt.y + 16, 7, 2);
  } else {
    // Standing / Walking legs & shoes
    const legOffset = walkCycle * 4;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(pt.x - 9, pt.y + 8 + legOffset, 8, 7);
    ctx.fillRect(pt.x + 1, pt.y + 8 - legOffset, 8, 7);
    // White Sneaker Soles
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(pt.x - 9, pt.y + 13 + legOffset, 8, 2);
    ctx.fillRect(pt.x + 1, pt.y + 13 - legOffset, 8, 2);

    // Denim Trousers / Slacks
    ctx.fillStyle = avatar.pantsColor;
    ctx.fillRect(pt.x - 8, pt.y - 6, 7, 15);
    ctx.fillRect(pt.x + 1, pt.y - 6, 7, 15);
  }
>>>>
```

```typescript
<<<<
  // Arms
  const armSwing = isWalking ? -walkCycle * 3 : 0;
  ctx.fillStyle = avatar.shirtColor;
  ctx.fillRect(pt.x - 17, pt.y - 26 + breathe + armSwing, 4, 16);
  ctx.fillRect(pt.x + 13, pt.y - 26 + breathe - armSwing, 4, 16);

  // Hands
  ctx.fillStyle = avatar.skinTone;
  ctx.fillRect(pt.x - 17, pt.y - 10 + breathe + armSwing, 4, 5);
  ctx.fillRect(pt.x + 13, pt.y - 10 + breathe - armSwing, 4, 5);
====
  // Arms & Hands
  if (isSitting) {
    // Typing arms reaching forward to desk surface
    ctx.fillStyle = avatar.shirtColor;
    ctx.fillRect(pt.x - 16, pt.y - 24 + yShift, 4, 12); // left upper sleeve
    ctx.fillRect(pt.x + 12, pt.y - 24 + yShift, 4, 12); // right upper sleeve

    // Forearms resting forward on desk
    ctx.fillRect(pt.x - 15, pt.y - 14 + yShift, 6, 4);
    ctx.fillRect(pt.x + 9, pt.y - 14 + yShift, 6, 4);

    // Typing hands on desk surface with alternating finger tap animation (frame % 10 < 5)
    const isTapLeft = (frame % 10 < 5);
    const leftHandOffset = isTapLeft ? 1.5 : -1.5;
    const rightHandOffset = isTapLeft ? -1.5 : 1.5;

    ctx.fillStyle = avatar.skinTone;
    ctx.fillRect(pt.x - 13, pt.y - 12 + yShift + leftHandOffset, 5, 4);
    ctx.fillRect(pt.x + 8, pt.y - 12 + yShift + rightHandOffset, 5, 4);
  } else {
    // Standing arms
    const armSwing = isWalking ? -walkCycle * 3 : 0;
    ctx.fillStyle = avatar.shirtColor;
    ctx.fillRect(pt.x - 17, pt.y - 26 + yShift + armSwing, 4, 16);
    ctx.fillRect(pt.x + 13, pt.y - 26 + yShift - armSwing, 4, 16);

    // Standing hands
    ctx.fillStyle = avatar.skinTone;
    ctx.fillRect(pt.x - 17, pt.y - 10 + yShift + armSwing, 4, 5);
    ctx.fillRect(pt.x + 13, pt.y - 10 + yShift - armSwing, 4, 5);
  }
>>>>
```

#### Diff 2: `src/components/IsometricOfficeCanvas.tsx`
```typescript
<<<<
      } else {
        isWalkingRef.current = false;
        lastStepFrameRef.current = 0;
      }

      // Proximity check (triggers only when nearby station changes)
====
      } else {
        isWalkingRef.current = false;
        lastStepFrameRef.current = 0;
      }

      // Sitting & workstation orientation detection (Milestone 3 / R2)
      // Check proximity to terminal (5, 2) [interact (5, 3.2)] or wireshark (2, 2) [interact (2.5, 3.2)]
      const isNearTerminal = currentRoom === 'office' && Math.hypot(5 - cur.x, 3.2 - cur.y) < 0.45;
      const isNearWireshark = currentRoom === 'datacenter_vault' && Math.hypot(2.5 - cur.x, 3.2 - cur.y) < 0.45;
      const isSitting = !isWalkingRef.current && (isNearTerminal || isNearWireshark);

      if (isSitting && playerDirRef.current !== 'NW') {
        playerDirRef.current = 'NW';
        setPlayerDir('NW');
      }

      // Proximity check (triggers only when nearby station changes)
>>>>
```

```typescript
<<<<
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
====
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
            isSitting
          )
        }
      ];
>>>>
```

---

## 5. Verification Method

To independently verify these findings and proposed changes:

1. **Verify TypeScript Compilation**:
   ```bash
   cd /root/.gemini/antigravity-cli/scratch/cisco-cyber-office
   npm run build
   ```
   *Expected Result*: Exits with code 0; 0 TypeScript errors.

2. **Verify QA Automation Suite**:
   ```bash
   cd /root/.gemini/antigravity-cli/scratch/cisco-cyber-office
   node pipeline/run_qa_suite.mjs
   ```
   *Expected Result*: All 5 gates PASS:
   - Gate 1: Zero TS/bundler errors.
   - Gate 2: Mobile portrait 412x915 layout invariants & canvas pixel integrity.
   - Gate 3: Elevator transit to -1F confirmed.
   - Gate 4: Wireshark DPI minigame interaction passes.
   - Gate 5: Desktop widescreen 1920x1080 layout passes, 0 console errors.

3. **Verify Zero Heap Allocations**:
   - Inspect the inner `render()` body in `IsometricOfficeCanvas.tsx`.
   - Verify that `Math.hypot` is called strictly on scalar primitives without allocating arrays, intermediate objects, or closures.

4. **Invalidation Conditions**:
   - Calling `setPlayerDir('NW')` unconditionally on every frame without checking `playerDirRef.current !== 'NW'`, which would cause React render thrashing.
   - Any modification that disrupts `walkSpeed` or character depth sorting formula `p.x + p.y`.
