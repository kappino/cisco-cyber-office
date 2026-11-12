import React, { useRef, useEffect, useState } from 'react';
import { AvatarConfig, PlayerStats } from '../types/game';
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
  drawChunkyTrophyShowcase,
  drawChunkyMonstera
} from '../canvas/roomRenderers';
import {
  drawCharmingMarcoNpc,
  drawCharmingHabboAvatar
} from '../canvas/characterRenderers';

export type { InteractiveSpot };

interface Props {
  avatar: AvatarConfig;
  stats: PlayerStats;
  level1Done: boolean;
  level2Done: boolean;
  level3Done: boolean;
  activeSpot: InteractiveSpot | null;
  setActiveSpot?: (spot: InteractiveSpot | null) => void;
  onTriggerSpot: (spot: InteractiveSpot) => void;
  targetSpotId?: string | null;
  onClearTargetSpot?: () => void;
}

export const IsometricOfficeCanvas: React.FC<Props> = ({
  avatar,
  stats,
  level1Done,
  level2Done,
  level3Done,
  activeSpot,
  setActiveSpot,
  onTriggerSpot,
  targetSpotId,
  onClearTargetSpot
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

  useEffect(() => {
    setActiveSpotRef.current = setActiveSpot;
  }, [setActiveSpot]);

  const interactiveSpots = getInteractiveSpots(level1Done, level2Done, level3Done);

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
  }, [targetSpotId, onClearTargetSpot, level1Done, level2Done, level3Done]);

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
          onTriggerSpot(activeSpot);
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
  }, [activeSpot, onTriggerSpot]);

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

    const spotClicked = interactiveSpots.find(
      (s) => Math.hypot(s.tileX - targetX, s.tileY - targetY) < 1.3
    );

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
    const spots = getInteractiveSpots(level1Done, level2Done, level3Done);

    const render = () => {
      animFrameRef.current++;
      const frame = animFrameRef.current;
      const walkSpeed = 0.08 + stats.skills.caffeineEndurance * 0.02;

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

          if (dx >= 0 && dy >= 0) setPlayerDir('SE');
          else if (dx <= 0 && dy >= 0) setPlayerDir('SW');
          else if (dx >= 0 && dy <= 0) setPlayerDir('NE');
          else if (dx <= 0 && dy <= 0) setPlayerDir('NW');
        } else {
          setPlayerPos({ x: tgt.x, y: tgt.y });
          setTargetPos(null);
          isWalkingRef.current = false;
        }
      } else {
        isWalkingRef.current = false;
      }

      // Proximity check (triggers only when nearby station changes)
      const p = playerPosRef.current;
      const nearby = spots.find(s => Math.hypot(s.interactX - p.x, s.interactY - p.y) < 1.3) || null;
      const nearbyId = nearby ? nearby.id : null;
      if (nearbyId !== currentSpotIdRef.current) {
        currentSpotIdRef.current = nearbyId;
        if (setActiveSpotRef.current) {
          setActiveSpotRef.current(nearby);
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // --- Retro Studio Vignette Backdrop ---
      const bgGrad = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 80, canvas.width / 2, canvas.height / 2, 450);
      bgGrad.addColorStop(0, '#1e2438');
      bgGrad.addColorStop(1, '#090d16');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // --- 1. COZY LOFT BRICK WALLS & VIBRANT VESUVIO WINDOW ---
      drawWarmHabboWalls(ctx, canvas.width, frame);

      // --- 2. WARM GOLDEN PARQUET FLOOR TILES WITH CARPET ---
      drawWarmParquetFloor(ctx, canvas.width, tgt);

      // --- 3. SUNLIGHT BEAMS FROM VESUVIO WINDOW ---
      drawSunlightBeams(ctx, canvas.width);

      // --- 4. DEPTH-SORTED ISOMETRIC ENTITIES ---
      const entities: Entity[] = [
        {
          id: 'player',
          depth: p.x + p.y,
          draw: (context) => drawCharmingHabboAvatar(context, p, canvas.width, playerDirRef.current, isWalkingRef.current, frame, avatar, stats.level)
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
          draw: (context) => drawChunkyAdminDesk(context, 5, 2, canvas.width, level2Done)
        },
        {
          id: 'umbrella',
          depth: 6 + 4,
          draw: (context) => drawChunkySocWall(context, 6, 4, canvas.width, level3Done, frame)
        },
        {
          id: 'coffee',
          depth: 1 + 6,
          draw: (context) => drawChunkyNeapolitanBar(context, 1, 6, canvas.width)
        },
        {
          id: 'trophy',
          depth: 6 + 1,
          draw: (context) => drawChunkyTrophyShowcase(context, 6, 1, canvas.width)
        },
        {
          id: 'plant',
          depth: 7 + 7,
          draw: (context) => drawChunkyMonstera(context, 7, 7, canvas.width)
        }
      ];

      entities.sort((a, b) => a.depth - b.depth);
      entities.forEach(ent => ent.draw(ctx, frame));

      reqId = requestAnimationFrame(render);
    };

    reqId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(reqId);
  }, [avatar, stats, level1Done, level2Done, level3Done]);

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
