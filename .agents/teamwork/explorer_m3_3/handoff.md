# Handoff Report: Avatar Victory Celebration on Mission / Level Completion (Milestone 3 / Requirement R2)

## 1. Observation

### Source Code Audit & Locations

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
   - Current animation dynamics (lines 96-98):
     - Screen position: `const pt = gridToScreen(p.x, p.y, canvasW);`
     - Walking cycle: `const walkCycle = isWalking ? Math.sin(frame * 0.35) : 0;`
     - Idle breathing: `const breathe = !isWalking ? Math.sin(frame * 0.08) * 1.5 : 0;`
   - Floor shadow (lines 101-104):
     - Static ellipse anchored at `pt.x, pt.y + 16`, radii `20, 8`, fill `rgba(0, 0, 0, 0.6)`.
   - Shoes & Feet (lines 107-115):
     - Drawn at `pt.y + 8 +/- legOffset` where `legOffset = walkCycle * 4`. No vertical jump offset.
   - Arms & Hands (lines 139-148):
     - Torso arms hang vertically from `pt.y - 26 + breathe` down to `pt.y - 10`.
   - Eyes & Face (lines 160-175):
     - When `dir === 'SE' || dir === 'SW'`, renders rectangular white sclera (`4x5`) and pupils (`3x4`) with arc smile. No happy squinting `^^` eyes or victory expression.
   - Project Specification Target (`PROJECT.md` line 71):
     ```typescript
     drawCharmingHabboAvatar(ctx, p, canvasW, dir, isWalking, frame, avatar, playerLevel, isSitting, caffeineBoostTimer, celebrationTimer)
     ```

2. **Canvas Engine Lifecycle & Props (`src/components/IsometricOfficeCanvas.tsx`)**:
   - Props interface (lines 31-45):
     - Receives `level1Done: boolean`, `level2Done: boolean`, `level3Done: boolean`, `level4Done?: boolean`.
   - Main render loop (lines 184-389):
     - Executes via `requestAnimationFrame(render)` inside `useEffect([avatar, stats, currentRoom, level1Done, level2Done, level3Done, level4Done])`.
     - Increments `animFrameRef.current++` each frame.
     - Entity player call (lines 289-298):
       ```typescript
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
       ```
     - Currently lacks `celebrationTimerRef` and level completion delta detection.

3. **Application State & Minigame Transition Flow (`src/App.tsx` & Minigames)**:
   - In `App.tsx` (lines 198-224):
     - `handleLevel1Complete`, `handleLevel2Complete`, `handleLevel3Complete`, `handleLevel4Complete` set boolean states and award XP.
   - In `App.tsx` (lines 249-330):
     - Minigames (`screen === 'rack' | 'terminal' | 'umbrella' | 'wireshark'`) unmount `HabboOffice` using `<AnimatePresence mode="wait">`.
     - When the player solves a minigame, the completion modal prompts "TORNA ALL'UFFICIO" / "TORNA AL DATACENTER" which invokes `onBack()`.
     - `onBack()` restores `screen = 'office'`, remounting `HabboOffice` and `IsometricOfficeCanvas`.
   - In `WiresharkInspector.tsx` (lines 525-555):
     - Mitigation success modal renders over full screen; on click calls `setShowMitigationModal(false); onBack();`.
   - Baseline QA status:
     - `npm run build` exits 0 with 0 errors.
     - `node pipeline/run_qa_suite.mjs` passes 100% across all 5 Gates.

---

## 2. Logic Chain

1. **Parabolic Sine-Wave Leap Mechanics**:
   - *Observation*: The dispatch specifies `jumpY = -Math.abs(Math.sin(frame * 0.18)) * 18`.
   - *Analysis*:
     - `Math.sin(frame * 0.18)` has an oscillation period of `2 * PI / 0.18 ≈ 34.9` frames.
     - `Math.abs(Math.sin(...))` has a period of `PI / 0.18 ≈ 17.45` frames (~0.29 seconds per hop at 60 FPS).
     - Over `celebrationTimer = 180` frames (3.0 seconds), the avatar executes exactly `180 / 17.45 ≈ 10.3` bouncing hops.
     - Maximum jump height is `jumpY = -18` pixels at the apex.
   - *Isometric Floor Depth Realism*:
     - If only the torso and head were shifted by `jumpY`, the avatar would dislocate.
     - Therefore, the entire avatar body (feet, shoes, trousers, belt, torso, head, nametag) must displace upward by `jumpY`.
     - Concurrently, the floor shadow must remain pinned to the floor plane at `(pt.x, pt.y + 16)`.
     - To enhance depth perception, the shadow's scale should shrink slightly to `Math.max(0.65, 1 + jumpY / 36)` and its opacity fade to `0.6 * shadowScale` when the avatar is high in the air.

2. **Cheerful Raised Arms Pose (`\o/`)**:
   - *Observation*: In default idle/walk, arms extend downward from `pt.y - 26` to `pt.y - 10`.
   - *Analysis*:
     - During celebration (`celebrationTimer > 0`), arms must raise upward and outward in a triumphant V-shape (`\o/`).
     - Adding an energetic cheering pump `armWave = Math.sin(frame * 0.3) * 2.5` creates dynamic excitement.
     - Left arm raises from shoulder `pt.x - 17` upward to `pt.x - 21, pt.y - 44 + animY + armWave`, with left hand thrust at `pt.y - 49`.
     - Right arm raises from shoulder `pt.x + 13` upward to `pt.x + 16, pt.y - 44 + animY - armWave`, with right hand thrust at `pt.y - 49`.

3. **Happy Squinting Eyes (`^^` Pixel Arcs)**:
   - *Observation*: Normal eye rendering uses filled rectangles (`4x5` white sclera, `3x4` dark pupil) and a standard smile arc.
   - *Analysis*:
     - When `celebrationTimer > 0` and facing forward (`dir === 'SE' || dir === 'SW'`), eyes switch to happy squinting anime/retro arcs (`^^`).
     - Modeled with inverted canvas arcs:
       `ctx.arc(pt.x - 4 + shift, pt.y - 39 + animY, 3, Math.PI * 1.15, Math.PI * 1.85);`
       `ctx.arc(pt.x + 4 + shift, pt.y - 39 + animY, 3, Math.PI * 1.15, Math.PI * 1.85);`
     - The mouth opens into a cheerful smile (`:D`) with ruby tongue highlight and warm rose blushing cheeks (`rgba(244, 63, 94, 0.45)`).

4. **Ring of 8 Orbiting Golden Sparkle Stars**:
   - *Observation*: Requirement R2 specifies a ring of 8 golden sparkle stars orbiting the head with radial expansion and sparkle twinkle.
   - *Analysis*:
     - Number of stars: `starCount = 8`.
     - Orbit center: `pt.x, pt.y - 46 + animY` (moves with the head during jumping).
     - Radial expansion: `radialExpand = Math.sin(frame * 0.15) * 5`, yielding `rx = 30 + radialExpand` (25px to 35px) and `ry = 14 + radialExpand * 0.45` (11.75px to 16.25px).
     - Orbit speed: `orbitAngle = frame * 0.08`.
     - Twinkle phase: `twinkle = 0.5 + 0.5 * Math.sin(frame * 0.28 + i * 1.3)`.
     - Star geometry: 4-pointed golden sparkle diamond (`#fbbf24`), white-hot core (`#ffffff`), and translucent golden aura (`rgba(251, 191, 36, 0.45 * twinkle)`).
     - Zero heap allocations: drawn procedurally via canvas path transforms without object instantiation.

5. **Level Completion Transition Detection in `IsometricOfficeCanvas.tsx`**:
   - *Observation*: When a user navigates to a minigame, `IsometricOfficeCanvas` unmounts. If state were stored solely in a React `useRef` initialized with current props on mount, returning from a completed minigame would initialize `prevLevelsRef` with `levelXDone = true`, missing the `false -> true` transition edge!
   - *Inference*:
     - A module-level cache `lastKnownLevels` retains level state across component unmount/remount cycles within the session.
     - On first app load (`!lastKnownLevels.initialized`), `lastKnownLevels` records the initial state without celebrating (preventing false celebration on page refresh).
     - On subsequent mounts (such as returning to `'office'` after completing a minigame):
       `prevLevelsRef` is initialized from `lastKnownLevels`.
       The `useEffect` detects `!prev.levelX && levelXDone`, sets `celebrationTimerRef.current = 180`, plays `sound.playSuccess()`, and synchronizes `lastKnownLevels`.
     - When `handleReset()` resets all levels to `false`, `justCompleted` evaluates to `false` (no false trigger on reset).
     - In the render loop, `celebrationTimerRef.current` decrements each frame (`if (celebrationTimerRef.current > 0) celebrationTimerRef.current--`).
     - Modals and minigames are unaffected because the celebration occurs naturally in the background canvas after modal dismissal.

---

## 3. Caveats

1. **Walking During Celebration**: If the user clicks to walk while celebrating, the parabolic jump offset `jumpY` gracefully supersedes the idle breathing `breathe`, and feet combine `jumpY` with walking cycle `legOffset`. However, for maximum visual charm, the avatar's raised arms and happy eyes take precedence until the celebration timer expires.
2. **Audio Concurrency**: `sound.playSuccess()` is called when the celebration triggers. If the audio is muted via HUD button (`sound.isMuted`), the SoundEngine's MasterGain will silently absorb the sound without throwing any error.
3. **Multi-Agent Parameter Coordination**:
   - `explorer_m3_1` introduces `isSitting: boolean = false`.
   - `explorer_m3_2` introduces `caffeineBoostTimer: number = 0`.
   - `explorer_m3_3` introduces `celebrationTimer: number = 0`.
   All three parameters are defined with default fallback values in `drawCharmingHabboAvatar` matching `PROJECT.md` line 71.

---

## 4. Conclusion & Actionable Code Proposals

### A. Proposed Changes in `src/canvas/characterRenderers.ts`

```typescript
// Replace lines 86-95 of src/canvas/characterRenderers.ts:
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
  celebrationTimer: number = 0
) => {
  const pt = gridToScreen(p.x, p.y, canvasW);
  const isCelebrating = celebrationTimer > 0;

  // Parabolic/sine-wave leap during celebration (or idle breathing / walking)
  const jumpY = isCelebrating ? -Math.abs(Math.sin(frame * 0.18)) * 18 : 0;
  const walkCycle = isWalking ? Math.sin(frame * 0.35) : 0;
  const breathe = !isWalking && !isCelebrating ? Math.sin(frame * 0.08) * 1.5 : 0;
  const animY = isCelebrating ? jumpY : breathe;

  // Floor Shadow - dynamically scales down when leaping high
  const shadowScale = isCelebrating ? Math.max(0.65, 1 + jumpY / 36) : 1;
  ctx.beginPath();
  ctx.ellipse(pt.x, pt.y + 16, 20 * shadowScale, 8 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(0, 0, 0, ${0.6 * shadowScale})`;
  ctx.fill();

  // Shoes & Pants (entire avatar lifts off floor when jumping)
  const legOffset = walkCycle * 4;
  const footY = isCelebrating ? pt.y + 8 + jumpY : pt.y + 8;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(pt.x - 9, footY + legOffset, 8, 7);
  ctx.fillRect(pt.x + 1, footY - legOffset, 8, 7);
  // White Sneaker Soles
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(pt.x - 9, footY + 5 + legOffset, 8, 2);
  ctx.fillRect(pt.x + 1, footY + 5 - legOffset, 8, 2);

  // Denim Trousers / Slacks
  const pantsY = isCelebrating ? pt.y - 6 + jumpY : pt.y - 6;
  ctx.fillStyle = avatar.pantsColor;
  ctx.fillRect(pt.x - 8, pantsY, 7, 15);
  ctx.fillRect(pt.x + 1, pantsY, 7, 15);

  // Belt & Buckle
  const beltY = isCelebrating ? pt.y - 7 + jumpY : pt.y - 7;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(pt.x - 9, beltY, 18, 3);
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(pt.x - 2, beltY, 4, 3);

  // Torso / Shirt with white collar
  ctx.fillStyle = avatar.shirtColor;
  ctx.fillRect(pt.x - 13, pt.y - 28 + animY, 26, 22);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1;
  ctx.strokeRect(pt.x - 13, pt.y - 28 + animY, 26, 22);

  // Collar
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(pt.x - 4, pt.y - 28 + animY, 8, 4);

  // Arms & Hands Pose
  if (isCelebrating) {
    // Cheerful raised arms pose (\o/) with energetic arm pump
    const armWave = Math.sin(frame * 0.3) * 2.5;

    // Left Arm (\)
    ctx.fillStyle = avatar.shirtColor;
    ctx.fillRect(pt.x - 17, pt.y - 36 + animY + armWave, 4, 12);
    ctx.fillRect(pt.x - 21, pt.y - 44 + animY + armWave, 5, 10);
    // Left Hand
    ctx.fillStyle = avatar.skinTone;
    ctx.fillRect(pt.x - 22, pt.y - 49 + animY + armWave, 5, 5);

    // Right Arm (/)
    ctx.fillStyle = avatar.shirtColor;
    ctx.fillRect(pt.x + 13, pt.y - 36 + animY - armWave, 4, 12);
    ctx.fillRect(pt.x + 16, pt.y - 44 + animY - armWave, 5, 10);
    // Right Hand
    ctx.fillStyle = avatar.skinTone;
    ctx.fillRect(pt.x + 17, pt.y - 49 + animY - armWave, 5, 5);
  } else {
    // Default arms (or sitting pose)
    const armSwing = isWalking ? -walkCycle * 3 : 0;
    ctx.fillStyle = avatar.shirtColor;
    ctx.fillRect(pt.x - 17, pt.y - 26 + animY + armSwing, 4, 16);
    ctx.fillRect(pt.x + 13, pt.y - 26 + animY - armSwing, 4, 16);

    // Hands
    ctx.fillStyle = avatar.skinTone;
    ctx.fillRect(pt.x - 17, pt.y - 10 + animY + armSwing, 4, 5);
    ctx.fillRect(pt.x + 13, pt.y - 10 + animY - armSwing, 4, 5);
  }

  // Ears
  ctx.fillStyle = avatar.skinTone;
  ctx.fillRect(pt.x - 13, pt.y - 41 + animY, 2, 5);
  ctx.fillRect(pt.x + 11, pt.y - 41 + animY, 2, 5);

  // Head
  ctx.fillStyle = avatar.skinTone;
  ctx.fillRect(pt.x - 11, pt.y - 48 + animY, 22, 20);
  ctx.strokeRect(pt.x - 11, pt.y - 48 + animY, 22, 20);

  // Face Direction & Expressive Eyes
  if (dir === 'SE' || dir === 'SW') {
    const shift = dir === 'SE' ? 2 : -2;

    if (isCelebrating) {
      // Happy squinting eyes (^^ retro pixel arcs)
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';

      // Left eye (^)
      ctx.beginPath();
      ctx.arc(pt.x - 4 + shift, pt.y - 39 + animY, 3, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();

      // Right eye (^)
      ctx.beginPath();
      ctx.arc(pt.x + 4 + shift, pt.y - 39 + animY, 3, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();

      // Joyful open mouth / smile (:D)
      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.arc(pt.x + shift, pt.y - 33 + animY, 4.5, 0, Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Rosy blush cheeks
      ctx.fillStyle = 'rgba(244, 63, 94, 0.45)';
      ctx.beginPath();
      ctx.ellipse(pt.x - 7 + shift, pt.y - 34 + animY, 2.5, 1.5, 0, 0, Math.PI * 2);
      ctx.ellipse(pt.x + 7 + shift, pt.y - 34 + animY, 2.5, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Normal open eyes and subtle smile
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(pt.x - 6 + shift, pt.y - 41 + animY, 4, 5);
      ctx.fillRect(pt.x + 2 + shift, pt.y - 41 + animY, 4, 5);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(pt.x - 5 + shift, pt.y - 40 + animY, 3, 4);
      ctx.fillRect(pt.x + 3 + shift, pt.y - 40 + animY, 3, 4);

      // Smile
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(pt.x + shift, pt.y - 33 + animY, 4, 0, Math.PI);
      ctx.stroke();
    }

    // Accessories
    if (avatar.accessory === 'cyber-visor') {
      ctx.fillStyle = '#00bceb';
      ctx.fillRect(pt.x - 9 + shift, pt.y - 42 + animY, 18, 7);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(pt.x - 7 + shift, pt.y - 41 + animY, 5, 2);
    } else if (avatar.accessory === 'glasses') {
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(pt.x - 8 + shift, pt.y - 42 + animY, 6, 6);
      ctx.strokeRect(pt.x + 2 + shift, pt.y - 42 + animY, 6, 6);
      ctx.beginPath();
      ctx.moveTo(pt.x - 2 + shift, pt.y - 39 + animY);
      ctx.lineTo(pt.x + 2 + shift, pt.y - 39 + animY);
      ctx.stroke();
    }
  }

  // Hair Style
  ctx.fillStyle = avatar.hairColor;
  if (avatar.hairStyle === 'spiky') {
    ctx.beginPath();
    ctx.moveTo(pt.x - 13, pt.y - 48 + animY);
    ctx.lineTo(pt.x - 7, pt.y - 58 + animY);
    ctx.lineTo(pt.x - 2, pt.y - 50 + animY);
    ctx.lineTo(pt.x + 4, pt.y - 59 + animY);
    ctx.lineTo(pt.x + 9, pt.y - 50 + animY);
    ctx.lineTo(pt.x + 13, pt.y - 48 + animY);
    ctx.closePath();
    ctx.fill();
  } else if (avatar.hairStyle === 'curly') {
    ctx.beginPath();
    ctx.arc(pt.x - 8, pt.y - 51 + animY, 6, 0, Math.PI * 2);
    ctx.arc(pt.x, pt.y - 54 + animY, 7, 0, Math.PI * 2);
    ctx.arc(pt.x + 8, pt.y - 51 + animY, 6, 0, Math.PI * 2);
    ctx.fill();
  } else if (avatar.hairStyle === 'cyber') {
    ctx.fillRect(pt.x - 4, pt.y - 58 + animY, 8, 12);
    ctx.fillStyle = '#00bceb';
    ctx.fillRect(pt.x - 12, pt.y - 50 + animY, 24, 3);
  } else {
    ctx.beginPath();
    ctx.moveTo(pt.x - 12, pt.y - 48 + animY);
    ctx.quadraticCurveTo(pt.x, pt.y - 57 + animY, pt.x + 12, pt.y - 48 + animY);
    ctx.lineTo(pt.x + 12, pt.y - 44 + animY);
    ctx.lineTo(pt.x - 12, pt.y - 44 + animY);
    ctx.closePath();
    ctx.fill();
  }

  // Ring of 8 Golden Sparkle Stars orbiting the head during celebration
  if (isCelebrating) {
    ctx.save();
    const starCount = 8;
    const orbitAngle = frame * 0.08;
    const radialExpand = Math.sin(frame * 0.15) * 5;
    const rx = 30 + radialExpand;
    const ry = 14 + radialExpand * 0.45;
    const headCenterY = pt.y - 46 + animY;

    for (let i = 0; i < starCount; i++) {
      const angle = orbitAngle + (i * Math.PI * 2) / starCount;
      const starX = pt.x + Math.cos(angle) * rx;
      const starY = headCenterY + Math.sin(angle) * ry;

      // Depth perspective: stars in front are slightly larger than stars behind
      const depthFactor = (Math.sin(angle) + 2) / 3; // 0.33 to 1.0

      // Sparkle twinkle
      const twinkle = 0.5 + 0.5 * Math.sin(frame * 0.28 + i * 1.3);
      const starR = (3 + twinkle * 3) * depthFactor;

      // 1. Soft golden aura glow
      ctx.fillStyle = `rgba(251, 191, 36, ${0.45 * twinkle})`;
      ctx.beginPath();
      ctx.arc(starX, starY, starR * 1.8, 0, Math.PI * 2);
      ctx.fill();

      // 2. 4-point golden sparkle diamond
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(starX, starY - starR);
      ctx.lineTo(starX + starR * 0.35, starY - starR * 0.35);
      ctx.lineTo(starX + starR, starY);
      ctx.lineTo(starX + starR * 0.35, starY + starR * 0.35);
      ctx.lineTo(starX, starY + starR);
      ctx.lineTo(starX - starR * 0.35, starY + starR * 0.35);
      ctx.lineTo(starX - starR, starY);
      ctx.lineTo(starX - starR * 0.35, starY - starR * 0.35);
      ctx.closePath();
      ctx.fill();

      // 3. Bright white-hot center core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(starX, starY - starR * 0.5);
      ctx.lineTo(starX + starR * 0.2, starY);
      ctx.lineTo(starX, starY + starR * 0.5);
      ctx.lineTo(starX - starR * 0.2, starY);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // Floating Habbo Nametag
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fillRect(pt.x - 55, pt.y - 74 + animY, 110, 18);
  ctx.strokeStyle = '#00bceb';
  ctx.lineWidth = 1;
  ctx.strokeRect(pt.x - 55, pt.y - 74 + animY, 110, 18);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`[Lv.${playerLevel}] ${avatar.name}`, pt.x, pt.y - 61 + animY);
};
```

---

### B. Proposed Changes in `src/components/IsometricOfficeCanvas.tsx`

```typescript
// 1. Module-level record of completed levels (persists across minigame unmounts):
const lastKnownLevels = {
  level1: false,
  level2: false,
  level3: false,
  level4: false,
  initialized: false,
};

// 2. Inside IsometricOfficeCanvas component:
  const celebrationTimerRef = useRef<number>(0);
  const prevLevelsRef = useRef<{
    level1: boolean;
    level2: boolean;
    level3: boolean;
    level4: boolean;
  }>({
    level1: lastKnownLevels.initialized ? lastKnownLevels.level1 : level1Done,
    level2: lastKnownLevels.initialized ? lastKnownLevels.level2 : level2Done,
    level3: lastKnownLevels.initialized ? lastKnownLevels.level3 : level3Done,
    level4: lastKnownLevels.initialized ? lastKnownLevels.level4 : !!level4Done,
  });

  // Detect level completion transition:
  useEffect(() => {
    if (!lastKnownLevels.initialized) {
      lastKnownLevels.level1 = level1Done;
      lastKnownLevels.level2 = level2Done;
      lastKnownLevels.level3 = level3Done;
      lastKnownLevels.level4 = !!level4Done;
      lastKnownLevels.initialized = true;
      prevLevelsRef.current = {
        level1: level1Done,
        level2: level2Done,
        level3: level3Done,
        level4: !!level4Done,
      };
      return;
    }

    const prev = prevLevelsRef.current;
    const justCompleted =
      (!prev.level1 && level1Done) ||
      (!prev.level2 && level2Done) ||
      (!prev.level3 && level3Done) ||
      (!prev.level4 && !!level4Done);

    if (justCompleted) {
      celebrationTimerRef.current = 180; // 3.0 seconds at 60 FPS
      sound.playSuccess();
    }

    prevLevelsRef.current = {
      level1: level1Done,
      level2: level2Done,
      level3: level3Done,
      level4: !!level4Done,
    };
    lastKnownLevels.level1 = level1Done;
    lastKnownLevels.level2 = level2Done;
    lastKnownLevels.level3 = level3Done;
    lastKnownLevels.level4 = !!level4Done;
  }, [level1Done, level2Done, level3Done, level4Done]);

// 3. Inside the render loop:
  const render = () => {
    animFrameRef.current++;
    const frame = animFrameRef.current;

    // Decrement celebration timer
    if (celebrationTimerRef.current > 0) {
      celebrationTimerRef.current--;
    }
    // ...
    // In depth-sorted entity draw:
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
          false,                      // isSitting
          0,                          // caffeineBoostTimer
          celebrationTimerRef.current // celebrationTimer
        )
      }
    ];
```

---

## 5. Verification Method

1. **Build Compilation Test**:
   ```bash
   cd /root/.gemini/antigravity-cli/scratch/cisco-cyber-office
   npm run build
   ```
   *Expected Output*: Exit code 0, 0 TypeScript errors or warning breaks.

2. **Full Deterministic Multi-Agent QA Test**:
   ```bash
   cd /root/.gemini/antigravity-cli/scratch/cisco-cyber-office
   node pipeline/run_qa_suite.mjs
   ```
   *Expected Output*:
   - Gate 1: PASS (0 build errors)
   - Gate 2: PASS (Mobile initial view, >= 12 color buckets)
   - Gate 3: PASS (Elevator vertical transit)
   - Gate 4: PASS (Wireshark DPI solved, ACL applied, return to office)
   - Gate 5: PASS (Desktop widescreen 1920x1080 layout, 0 runtime/console errors)

3. **Invalidation Conditions**:
   - Spawning heap allocations (e.g. `new Array()`, object literals) per frame in the celebration star loop.
   - Initializing `prevLevelsRef` on page load in a way that triggers celebration on simple browser refresh (F5).
   - Disrupting the z-index hierarchy between game modals (`z-50`) and canvas layer (`z-10`).
