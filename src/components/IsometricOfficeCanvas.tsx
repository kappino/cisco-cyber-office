import React, { useRef, useEffect, useState, useCallback } from 'react';
import { AvatarConfig, PlayerStats, RoomId } from '../types/game';
import { sound } from '../utils/audio';
import {
  GRID_SIZE,
  MEZZ_MAX_X,
  MEZZ_MAX_Y,
  STAIR_MIN_X,
  STAIR_MAX_X,
  TilePos,
  Direction,
  Entity,
  gridToScreen,
  getElevationAt,
  screenToGridWithElevation
} from '../canvas/isoMath';
import { InteractiveSpot, getInteractiveSpots } from '../data/workstations';
import {
  drawWarmHabboWalls,
  drawWarmParquetFloor,
  drawSunlightBeams,
  drawMezzanineFrontRail,
  drawMezzanineSideRail,
  drawChunkyServerRack,
  drawChunkyAdminDesk,
  drawChunkySocWall,
  drawChunkyNeapolitanBar,
  drawChunkyMonstera,
  drawUndergroundDatacenterWalls,
  drawUndergroundFloor,
  drawChunkyIndustrialElevator,
  drawChunkyWiresharkConsole,
  drawChunkyFirepowerWall,
  drawChunkySanVault,
  drawChunkySecBot,
  drawChunkyCracCoolingUnit
} from '../canvas/roomRenderers';
import {
  drawCharmingMarcoNpc,
  drawCharmingHabboAvatar,
  SpeedTrailPoint
} from '../canvas/characterRenderers';

export type { InteractiveSpot };

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
  coffeeBoostTrigger?: number;
}

const MIN_WALK = 0.35;
const MAX_WALK = GRID_SIZE - 0.35;

const isUpperDeck = (x: number, y: number): boolean => x < MEZZ_MAX_X && y < MEZZ_MAX_Y;

const clampWalkable = (v: number): number => Math.max(MIN_WALK, Math.min(MAX_WALK, v));

// Module-level record of completed levels to detect completion edge across minigame unmounts
const lastKnownLevels = {
  level1: false,
  level2: false,
  level3: false,
  level4: false,
  initialized: false,
};

export const IsometricOfficeCanvas: React.FC<Props> = ({
  avatar,
  stats,
  currentRoom = 'office',
  level1Done,
  level2Done,
  level3Done,
  level4Done = false,
  activeSpot,
  setActiveSpot,
  onTriggerSpot,
  onChangeRoom,
  targetSpotId,
  onClearTargetSpot,
  coffeeBoostTrigger
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Player position (open center-front lounge clear of furniture and stairs)
  const [playerPos, setPlayerPos] = useState<TilePos>({ x: 3.8, y: 5.2 });
  const [targetPos, setTargetPos] = useState<TilePos | null>(null);
  const [playerDir, setPlayerDir] = useState<Direction>('SE');

  const animFrameRef = useRef<number>(0);
  const isWalkingRef = useRef<boolean>(false);
  const playerPosRef = useRef<TilePos>({ x: 3.8, y: 5.2 });
  const targetPosRef = useRef<TilePos | null>(null);
  const waypointsRef = useRef<TilePos[]>([]);
  const playerDirRef = useRef<Direction>('SE');
  const prevRoomRef = useRef<RoomId>(currentRoom);
  const currentSpotIdRef = useRef<string | null>(null);
  const setActiveSpotRef = useRef(setActiveSpot);
  const lastStepFrameRef = useRef<number>(0);
  const stepFootRef = useRef<boolean>(false);
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);

  const caffeineBoostTimerRef = useRef<number>(0);
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

  // Route player between split levels through the central staircase (2.9, 2.2..3.25)
  const navigateTo = useCallback((dest: TilePos) => {
    const cur = playerPosRef.current;
    const fromUpper = isUpperDeck(cur.x, cur.y);
    const toUpper = isUpperDeck(dest.x, dest.y);

    if (fromUpper === toUpper) {
      waypointsRef.current = [];
      setTargetPos(dest);
      return;
    }

    const stairBottom: TilePos = { x: 2.9, y: 3.28 };
    const stairTop: TilePos = { x: 2.9, y: 2.18 };
    const route = fromUpper ? [stairTop, stairBottom, dest] : [stairBottom, stairTop, dest];
    const filtered = route.filter((wp, idx) => {
      if (idx === route.length - 1) return true;
      return Math.hypot(wp.x - cur.x, wp.y - cur.y) > 0.25;
    });

    const first = filtered.shift() || dest;
    waypointsRef.current = filtered;
    setTargetPos(first);
  }, []);

  // Handle coffeeBoostTrigger
  useEffect(() => {
    if (coffeeBoostTrigger && coffeeBoostTrigger > 0) {
      caffeineBoostTimerRef.current = 300; // 5 seconds at 60 FPS
    }
  }, [coffeeBoostTrigger]);

  // Detect level completion transition
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

  useEffect(() => {
    setActiveSpotRef.current = setActiveSpot;
  }, [setActiveSpot]);

  const interactiveSpots = getInteractiveSpots(currentRoom, level1Done, level2Done, level3Done, level4Done);

  // When room actually changes, position player near the wall elevator
  useEffect(() => {
    if (prevRoomRef.current === currentRoom) {
      return;
    }
    prevRoomRef.current = currentRoom;
    waypointsRef.current = [];
    setPlayerPos({ x: 6.0, y: 1.5 });
    setTargetPos(null);
    setPlayerDir('SW');
    currentSpotIdRef.current = null;
    if (setActiveSpotRef.current) {
      setActiveSpotRef.current(null);
    }
  }, [currentRoom]);

  // Sync refs
  useEffect(() => { playerPosRef.current = playerPos; }, [playerPos]);
  useEffect(() => { targetPosRef.current = targetPos; }, [targetPos]);
  useEffect(() => { playerDirRef.current = playerDir; }, [playerDir]);

  // Programmatic movement towards a spot
  useEffect(() => {
    if (targetSpotId) {
      const spot = interactiveSpots.find(s => s.id === targetSpotId);
      if (spot) {
        sound.playClick();
        navigateTo({ x: spot.interactX, y: spot.interactY });
      }
      if (onClearTargetSpot) {
        onClearTargetSpot();
      }
    }
  }, [targetSpotId, onClearTargetSpot, interactiveSpots, navigateTo]);

  // Keyboard navigation (respecting mezzanine balustrade except at stairs)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      let dx = 0;
      let dy = 0;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { dx = -1; dy = -1; }
      else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { dx = 1; dy = 1; }
      else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { dx = -1; dy = 1; }
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { dx = 1; dy = -1; }
      else if (e.key === ' ' || e.key === 'e' || e.key === 'E' || e.key === 'Enter') {
        if (activeSpot) {
          if (activeSpot.isElevator && activeSpot.targetRoom && onChangeRoom) {
            sound.playElevator();
            onChangeRoom(activeSpot.targetRoom);
          } else {
            onTriggerSpot(activeSpot);
          }
        }
      }

      if (dx !== 0 || dy !== 0) {
        const cur = playerPosRef.current;
        const nx = clampWalkable(cur.x + dx);
        const ny = clampWalkable(cur.y + dy);
        // Prevent stepping directly through the glass balustrade with keyboard
        const curUp = isUpperDeck(cur.x, cur.y);
        const nxtUp = isUpperDeck(nx, ny);
        const inStairCorridor = nx >= STAIR_MIN_X && nx <= STAIR_MAX_X;
        if (curUp !== nxtUp && !inStairCorridor) {
          navigateTo({ x: nx, y: ny });
        } else {
          waypointsRef.current = [];
          setTargetPos({ x: nx, y: ny });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSpot, onTriggerSpot, onChangeRoom, navigateTo]);

  // Process canvas tap/click at exact canvas buffer coordinates
  const processCanvasTap = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientLeft = canvas.clientLeft || 0;
    const clientTop = canvas.clientTop || 0;
    const contentW = canvas.clientWidth || rect.width;
    const contentH = canvas.clientHeight || rect.height;
    if (contentW <= 0 || contentH <= 0) return;

    const mouseX = ((clientX - rect.left - clientLeft) / contentW) * canvas.width;
    const mouseY = ((clientY - rect.top - clientTop) / contentH) * canvas.height;

    sound.playClick();

    // 1. Check screen-space visual hit against tall/wall-mounted spots (e.g., wall-integrated elevator!)
    let bestScreenSpot: InteractiveSpot | null = null;
    let bestScreenDist = 42;
    for (const s of interactiveSpots) {
      const sPt = gridToScreen(s.tileX, s.tileY, canvas.width, getElevationAt(s.tileX, s.tileY));
      const hitY = sPt.y + (s.screenHitOffsetY ?? -18);
      const d = Math.hypot(mouseX - sPt.x, mouseY - hitY);
      if (d < bestScreenDist) {
        bestScreenDist = d;
        bestScreenSpot = s;
      }
    }

    if (bestScreenSpot) {
      navigateTo({ x: bestScreenSpot.interactX, y: bestScreenSpot.interactY });
      return;
    }

    // 2. Elevation-aware floor tile picking across the full walkable surface
    const grid = screenToGridWithElevation(mouseX, mouseY, canvas.width);
    const targetX = clampWalkable(grid.x);
    const targetY = clampWalkable(grid.y);

    // Tight floor proximity check so nearby floor taps still walk cleanly where tapped
    const spotsInRange = interactiveSpots.filter(
      (s) => Math.hypot(s.tileX - targetX, s.tileY - targetY) < 0.72
    );
    const spotClicked = spotsInRange.length > 0
      ? spotsInRange.reduce((min, s) =>
          Math.hypot(s.tileX - targetX, s.tileY - targetY) <
          Math.hypot(min.tileX - targetX, min.tileY - targetY)
            ? s
            : min
        )
      : null;

    if (spotClicked) {
      navigateTo({ x: spotClicked.interactX, y: spotClicked.interactY });
    } else {
      navigateTo({ x: targetX, y: targetY });
    }
  }, [interactiveSpots, navigateTo]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    pointerDownRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const start = pointerDownRef.current;
    pointerDownRef.current = null;
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 14) {
      return; // User was scrolling/swiping the page
    }
    processCanvasTap(e.clientX, e.clientY);
  };

  // Main Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let reqId: number;
    const spots = getInteractiveSpots(currentRoom, level1Done, level2Done, level3Done, level4Done);

    const render = () => {
      animFrameRef.current++;
      const frame = animFrameRef.current;

      // Decrement timers
      if (caffeineBoostTimerRef.current > 0) {
        caffeineBoostTimerRef.current--;
      }
      if (celebrationTimerRef.current > 0) {
        celebrationTimerRef.current--;
      }

      const isCaffeineBoosted = caffeineBoostTimerRef.current > 0;
      const boostMultiplier = isCaffeineBoosted ? 1.5 : 1.0;
      const walkSpeed = (0.08 + stats.skills.caffeineEndurance * 0.02) * boostMultiplier;
      const stepInterval = isCaffeineBoosted ? 6 : (stats.skills.caffeineEndurance > 0 ? 9 : 11);

      const cur = playerPosRef.current;
      const tgt = targetPosRef.current;

      if (tgt) {
        const dx = tgt.x - cur.x;
        const dy = tgt.y - cur.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 0.06) {
          isWalkingRef.current = true;
          const nx = cur.x + (dx / dist) * walkSpeed;
          const ny = cur.y + (dy / dist) * walkSpeed;
          setPlayerPos({ x: nx, y: ny });

          if (frame - lastStepFrameRef.current >= stepInterval) {
            lastStepFrameRef.current = frame;
            stepFootRef.current = !stepFootRef.current;
            sound.playFootstep(stepFootRef.current);
          }

          if (Math.abs(dy) >= Math.abs(dx) * 0.35) {
            if (dx >= 0 && dy >= 0) setPlayerDir('SE');
            else if (dx <= 0 && dy >= 0) setPlayerDir('SW');
            else if (dx >= 0 && dy <= 0) setPlayerDir('NE');
            else setPlayerDir('NW');
          } else {
            if (dx >= 0 && dy >= 0) setPlayerDir('SE');
            else if (dx <= 0 && dy >= 0) setPlayerDir('SW');
            else if (dx >= 0 && dy <= 0) setPlayerDir('NE');
            else setPlayerDir('NW');
          }
        } else {
          setPlayerPos({ x: tgt.x, y: tgt.y });
          if (waypointsRef.current.length > 0) {
            const nextWp = waypointsRef.current.shift()!;
            setTargetPos(nextWp);
          } else {
            setTargetPos(null);
            isWalkingRef.current = false;
            lastStepFrameRef.current = 0;
          }
        }
      } else {
        isWalkingRef.current = false;
        lastStepFrameRef.current = 0;
      }

      // Sitting & workstation orientation detection:
      // Terminal is at (2.9, 0.85) with chair at (2.9, 1.85) -> player faces NE toward monitors!
      // Wireshark is at (2.3, 0.85) with chair at (2.3, 1.85) -> player faces NE toward monitor!
      const isNearTerminal = currentRoom === 'office' && Math.hypot(2.9 - cur.x, 1.85 - cur.y) < 0.45;
      const isNearWireshark = currentRoom === 'datacenter_vault' && Math.hypot(2.3 - cur.x, 1.85 - cur.y) < 0.45;
      const isSitting = !isWalkingRef.current && (isNearTerminal || isNearWireshark);

      if (isSitting && playerDirRef.current !== 'NE') {
        playerDirRef.current = 'NE';
        setPlayerDir('NE');
      }

      // Update speed trail circular buffer (Zero heap allocations)
      const echoes = speedTrailEchoesRef.current;
      const buffer = speedTrailBufferRef.current;

      if (isCaffeineBoosted && isWalkingRef.current) {
        if (frame - lastTrailSampleFrameRef.current >= 3) {
          lastTrailSampleFrameRef.current = frame;
          const head = speedTrailHeadRef.current;
          buffer[head].x = cur.x;
          buffer[head].y = cur.y;
          buffer[head].dir = playerDirRef.current;
          buffer[head].active = true;
          buffer[head].frame = frame;
          speedTrailHeadRef.current = (head + 1) % 3;
        }

        const head = speedTrailHeadRef.current;
        const baseAlphas = [0.55, 0.35, 0.18];
        const timerFade = caffeineBoostTimerRef.current < 30 ? caffeineBoostTimerRef.current / 30 : 1;

        for (let i = 0; i < 3; i++) {
          const bufIdx = (head - 1 - i + 3) % 3;
          const sample = buffer[bufIdx];
          echoes[i].x = sample.x;
          echoes[i].y = sample.y;
          echoes[i].dir = sample.dir;
          echoes[i].active = sample.active && (frame - sample.frame < 24);
          echoes[i].alpha = baseAlphas[i] * timerFade;
        }
      } else {
        for (let i = 0; i < 3; i++) {
          if (echoes[i].active) {
            echoes[i].alpha *= 0.82;
            if (echoes[i].alpha < 0.02) {
              echoes[i].active = false;
              echoes[i].alpha = 0;
            }
          }
        }
        if (!isCaffeineBoosted) {
          for (let j = 0; j < 3; j++) {
            buffer[j].active = false;
          }
        }
      }

      // Proximity check (triggers only when nearby station changes)
      const p = playerPosRef.current;
      const inRange = spots.filter(s => Math.hypot(s.interactX - p.x, s.interactY - p.y) < 1.2);
      const nearby = inRange.length > 0
        ? inRange.reduce((min, s) =>
            Math.hypot(s.interactX - p.x, s.interactY - p.y) <
            Math.hypot(min.interactX - p.x, min.interactY - p.y)
              ? s
              : min
          )
        : null;
      const nearbyId = nearby ? nearby.id : null;
      if (nearbyId !== currentSpotIdRef.current) {
        currentSpotIdRef.current = nearbyId;
        if (setActiveSpotRef.current) {
          setActiveSpotRef.current(nearby);
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // --- Room Atmosphere Backdrop ---
      const bgGrad = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        80,
        canvas.width / 2,
        canvas.height / 2,
        450
      );
      if (currentRoom === 'office') {
        bgGrad.addColorStop(0, '#1e2438');
        bgGrad.addColorStop(1, '#090d16');
      } else {
        bgGrad.addColorStop(0, '#101726');
        bgGrad.addColorStop(1, '#030712');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Final destination marker (last waypoint if multi-step, else tgt)
      const finalTgt = waypointsRef.current.length > 0
        ? waypointsRef.current[waypointsRef.current.length - 1]
        : tgt;

      // --- 1. ROOM WALLS, WALL-INTEGRATED ELEVATOR & SPLIT-LEVEL FLOORS ---
      if (currentRoom === 'office') {
        drawWarmHabboWalls(ctx, canvas.width, frame);
        drawChunkyIndustrialElevator(ctx, 6.3, 0.2, canvas.width, 'office', frame);
        drawWarmParquetFloor(ctx, canvas.width, finalTgt, frame);
        drawSunlightBeams(ctx, canvas.width);
      } else {
        drawUndergroundDatacenterWalls(ctx, canvas.width, frame);
        drawChunkyIndustrialElevator(ctx, 6.3, 0.2, canvas.width, 'datacenter_vault', frame);
        drawUndergroundFloor(ctx, canvas.width, finalTgt, frame);
      }

      // --- 2. DEPTH-SORTED ISOMETRIC ENTITIES (Clean, Ordered, Uncluttered) ---
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
            isSitting,
            caffeineBoostTimerRef.current,
            celebrationTimerRef.current,
            speedTrailEchoesRef.current
          )
        },
        // Mezzanine tempered glass balustrade segments sorted by depth
        {
          id: 'rail_front_left',
          depth: MEZZ_MAX_Y + 1.0,
          draw: (context) => drawMezzanineFrontRail(
            context,
            canvas.width,
            'left',
            currentRoom === 'office' ? 'rgba(56, 189, 248, 0.16)' : 'rgba(6, 182, 212, 0.22)'
          )
        },
        {
          id: 'rail_front_right',
          depth: MEZZ_MAX_Y + 4.4,
          draw: (context) => drawMezzanineFrontRail(
            context,
            canvas.width,
            'right',
            currentRoom === 'office' ? 'rgba(56, 189, 248, 0.16)' : 'rgba(6, 182, 212, 0.22)'
          )
        },
        {
          id: 'rail_side',
          depth: MEZZ_MAX_X + 1.5,
          draw: (context) => drawMezzanineSideRail(
            context,
            canvas.width,
            currentRoom === 'office' ? 'rgba(56, 189, 248, 0.16)' : 'rgba(6, 182, 212, 0.22)'
          )
        }
      ];

      if (currentRoom === 'office') {
        entities.push(
          {
            id: 'rack',
            depth: 0.9 + 1.0,
            draw: (context) => drawChunkyServerRack(context, 0.9, 1.0, canvas.width, level1Done, frame)
          },
          {
            id: 'terminal',
            depth: 2.9 + 0.85,
            draw: (context) => drawChunkyAdminDesk(context, 2.9, 0.85, canvas.width, level2Done, frame, isSitting)
          },
          {
            id: 'umbrella',
            depth: 6.7 + 4.1,
            draw: (context) => drawChunkySocWall(context, 6.7, 4.1, canvas.width, level3Done, frame)
          },
          {
            id: 'coffee',
            depth: 0.9 + 5.1,
            draw: (context) => drawChunkyNeapolitanBar(context, 0.9, 5.1, canvas.width, frame)
          },
          {
            id: 'marco',
            depth: 2.2 + 6.5,
            draw: (context) => drawCharmingMarcoNpc(context, 2.2, 6.5, canvas.width, frame)
          },
          {
            id: 'plant_sw',
            depth: 0.65 + 7.15,
            draw: (context) => drawChunkyMonstera(context, 0.65, 7.15, canvas.width)
          }
        );
      } else {
        // Underground Datacenter Vault entities (Clean Two-Level Layout)
        entities.push(
          {
            id: 'wireshark',
            depth: 2.3 + 0.85,
            draw: (context) => drawChunkyWiresharkConsole(context, 2.3, 0.85, canvas.width, level4Done, frame, isSitting)
          },
          {
            id: 'firepower',
            depth: 4.1 + 0.9,
            draw: (context) => drawChunkyFirepowerWall(context, 4.1, 0.9, canvas.width, frame)
          },
          {
            id: 'san_storage',
            depth: 0.95 + 4.8,
            draw: (context) => drawChunkySanVault(context, 0.95, 4.8, canvas.width, frame)
          },
          {
            id: 'secbot',
            depth: 1.3 + 6.7,
            draw: (context) => drawChunkySecBot(context, 1.3, 6.7, canvas.width, frame)
          },
          {
            id: 'crac_cooling',
            depth: 6.75 + 4.5,
            draw: (context) => drawChunkyCracCoolingUnit(context, 6.75, 4.5, canvas.width, frame)
          }
        );
      }

      entities.sort((a, b) => a.depth - b.depth);
      entities.forEach(ent => ent.draw(ctx, frame));

      reqId = requestAnimationFrame(render);
    };

    reqId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(reqId);
  }, [avatar, stats, currentRoom, level1Done, level2Done, level3Done, level4Done]);

  return (
    <div className="relative w-full flex flex-col items-center">
      <canvas
        ref={canvasRef}
        width={840}
        height={620}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        style={{ touchAction: 'manipulation' }}
        className="w-full max-w-4xl h-auto block bg-slate-950 rounded-2xl border-4 border-slate-700/80 shadow-2xl cursor-pointer select-none"
        title="Tocca il pavimento per muoverti o avvicinati a una postazione per interagire!"
      />
    </div>
  );
};
