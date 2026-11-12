import React, { useRef, useEffect, useState } from 'react';
import { AvatarConfig, PlayerStats, RoomId } from '../types/game';
import { sound } from '../utils/audio';
import { GRID_SIZE, TilePos, Direction, Entity, screenToGrid } from '../canvas/isoMath';
import { InteractiveSpot, getInteractiveSpots } from '../data/workstations';
import {
  drawWarmHabboWalls,
  drawWarmParquetFloor,
  drawSunlightBeams,
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
  drawCiscoHologram
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

  // Player position
  const [playerPos, setPlayerPos] = useState<TilePos>({ x: 4, y: 5 });
  const [targetPos, setTargetPos] = useState<TilePos | null>(null);
  const [playerDir, setPlayerDir] = useState<Direction>('SE');

  const animFrameRef = useRef<number>(0);
  const isWalkingRef = useRef<boolean>(false);
  const playerPosRef = useRef<TilePos>({ x: 4, y: 5 });
  const targetPosRef = useRef<TilePos | null>(null);
  const playerDirRef = useRef<Direction>('SE');
  const currentSpotIdRef = useRef<string | null>(null);
  const setActiveSpotRef = useRef(setActiveSpot);
  const lastStepFrameRef = useRef<number>(0);
  const stepFootRef = useRef<boolean>(false);

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

  // When room changes, position player near the elevator
  useEffect(() => {
    setPlayerPos({ x: 5.2, y: 2.2 });
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
        setTargetPos({ x: spot.interactX, y: spot.interactY });
      }
      if (onClearTargetSpot) {
        onClearTargetSpot();
      }
    }
  }, [targetSpotId, onClearTargetSpot, interactiveSpots]);

  // Keyboard navigation
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
        const nx = Math.max(0.6, Math.min(GRID_SIZE - 1.2, cur.x + dx));
        const ny = Math.max(0.6, Math.min(GRID_SIZE - 1.2, cur.y + dy));
        setTargetPos({ x: nx, y: ny });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSpot, onTriggerSpot, onChangeRoom]);

  // Canvas click
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const grid = screenToGrid(mouseX, mouseY, canvas.width);
    const targetX = Math.max(0.6, Math.min(GRID_SIZE - 1.2, grid.x));
    const targetY = Math.max(0.6, Math.min(GRID_SIZE - 1.2, grid.y));

    sound.playClick();

    const spotsInClickRange = interactiveSpots.filter(
      (s) => Math.hypot(s.tileX - targetX, s.tileY - targetY) < 1.3
    );
    const spotClicked = spotsInClickRange.length > 0
      ? spotsInClickRange.reduce((min, s) =>
          Math.hypot(s.tileX - targetX, s.tileY - targetY) <
          Math.hypot(min.tileX - targetX, min.tileY - targetY)
            ? s
            : min
        )
      : null;

    if (spotClicked) {
      setTargetPos({ x: spotClicked.interactX, y: spotClicked.interactY });
    } else {
      setTargetPos({ x: targetX, y: targetY });
    }
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

          if (dx >= 0 && dy >= 0) setPlayerDir('SE');
          else if (dx <= 0 && dy >= 0) setPlayerDir('SW');
          else if (dx >= 0 && dy <= 0) setPlayerDir('NE');
          else if (dx <= 0 && dy <= 0) setPlayerDir('NW');
        } else {
          setPlayerPos({ x: tgt.x, y: tgt.y });
          setTargetPos(null);
          isWalkingRef.current = false;
          lastStepFrameRef.current = 0;
        }
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
        // Smoothly fade out active echoes when stopped
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

      // Proximity check (triggers only when nearby station changes) - Nearest Neighbor resolution
      const p = playerPosRef.current;
      const inRange = spots.filter(s => Math.hypot(s.interactX - p.x, s.interactY - p.y) < 1.3);
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

      // --- 1. ROOM WALLS & FLOORS ---
      if (currentRoom === 'office') {
        drawWarmHabboWalls(ctx, canvas.width, frame);
        drawWarmParquetFloor(ctx, canvas.width, tgt, frame);
        drawSunlightBeams(ctx, canvas.width);
      } else {
        drawUndergroundDatacenterWalls(ctx, canvas.width, frame);
        drawUndergroundFloor(ctx, canvas.width, tgt, frame);
      }

      // --- 2. DEPTH-SORTED ISOMETRIC ENTITIES ---
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
        }
      ];

      if (currentRoom === 'office') {
        entities.push(
          {
            id: 'cisco_hologram',
            depth: 4 + 4,
            draw: (context) => drawCiscoHologram(context, 4, 4, canvas.width, frame, 'office')
          },
          {
            id: 'marco',
            depth: 2 + 5,
            draw: (context) => drawCharmingMarcoNpc(context, 2, 5, canvas.width, frame)
          },
          {
            id: 'rack',
            depth: 2 + 2,
            draw: (context) => drawChunkyServerRack(context, 2, 2, canvas.width, level1Done, frame)
          },
          {
            id: 'terminal',
            depth: 5 + 2,
            draw: (context) => drawChunkyAdminDesk(context, 5, 2, canvas.width, level2Done, frame)
          },
          {
            id: 'umbrella',
            depth: 6 + 4,
            draw: (context) => drawChunkySocWall(context, 6, 4, canvas.width, level3Done, frame)
          },
          {
            id: 'coffee',
            depth: 1 + 6,
            draw: (context) => drawChunkyNeapolitanBar(context, 1, 6, canvas.width, frame)
          },
          {
            id: 'elevator_down',
            depth: 6 + 1,
            draw: (context) => drawChunkyIndustrialElevator(context, 6, 1, canvas.width, 'office', frame)
          },
          {
            id: 'plant',
            depth: 7 + 7,
            draw: (context) => drawChunkyMonstera(context, 7, 7, canvas.width)
          }
        );
      } else {
        // Underground Datacenter Vault entities
        entities.push(
          {
            id: 'datacenter_hologram',
            depth: 4 + 4,
            draw: (context) => drawCiscoHologram(context, 4, 4, canvas.width, frame, 'datacenter_vault')
          },
          {
            id: 'wireshark',
            depth: 2 + 2,
            draw: (context) => drawChunkyWiresharkConsole(context, 2, 2, canvas.width, level4Done, frame)
          },
          {
            id: 'firepower',
            depth: 5 + 2,
            draw: (context) => drawChunkyFirepowerWall(context, 5, 2, canvas.width, frame)
          },
          {
            id: 'san_storage',
            depth: 2 + 5,
            draw: (context) => drawChunkySanVault(context, 2, 5, canvas.width, frame)
          },
          {
            id: 'elevator_up',
            depth: 6 + 1,
            draw: (context) => drawChunkyIndustrialElevator(context, 6, 1, canvas.width, 'datacenter_vault', frame)
          },
          {
            id: 'secbot',
            depth: 1 + 6,
            draw: (context) => drawChunkySecBot(context, 1, 6, canvas.width, frame)
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
        onClick={handleCanvasClick}
        className="w-full max-w-4xl h-auto bg-slate-950 rounded-2xl border-4 border-slate-700/80 shadow-2xl cursor-pointer"
        title="Tocca il pavimento per muoverti o avvicinati a una postazione per interagire!"
      />
    </div>
  );
};
