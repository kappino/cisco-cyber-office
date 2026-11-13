import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { createPhaserGame } from '../game/PhaserGame';
import { EventBus, InteractiveSpotData, TimePhase } from '../game/EventBus';
import { AvatarConfig, PlayerStats, RoomId } from '../types/game';

export interface Props {
  avatar?: AvatarConfig;
  stats?: PlayerStats;
  currentRoom?: RoomId | string;
  level1Done?: boolean;
  level2Done?: boolean;
  level3Done?: boolean;
  level4Done?: boolean;
  activeSpot?: InteractiveSpotData | null;
  setActiveSpot?: (spot: InteractiveSpotData | null) => void;
  onTriggerSpot: (spot: InteractiveSpotData) => void;
  onChangeRoom?: (room: RoomId) => void;
  targetSpotId?: string | null;
  onClearTargetSpot?: () => void;
  coffeeBoostTrigger?: number;
  celebrationTrigger?: number;
  timePhase?: TimePhase;
}

export const PhaserGameContainer: React.FC<Props> = ({
  currentRoom = 'office',
  setActiveSpot,
  onTriggerSpot,
  onChangeRoom,
  targetSpotId,
  onClearTargetSpot,
  coffeeBoostTrigger,
  celebrationTrigger,
  timePhase = 'sunset'
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const activeSpotRef = useRef<InteractiveSpotData | null>(null);
  const sceneReadyRef = useRef<boolean>(false);
  const pendingSpotRef = useRef<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    sceneReadyRef.current = false;
    // Mount Phaser Game Instance
    const game = createPhaserGame(containerRef.current);
    gameRef.current = game;

    // Bi-directional event listeners
    const handleSceneReady = () => {
      sceneReadyRef.current = true;
      EventBus.emit('SET_TIME_PHASE', timePhase);
      if (currentRoom) {
        EventBus.emit('CHANGE_ROOM', currentRoom);
      }
      if (pendingSpotRef.current) {
        EventBus.emit('NAVIGATE_TO', { spotId: pendingSpotRef.current });
        pendingSpotRef.current = null;
      }
    };

    const handleSpotEnter = (spot: InteractiveSpotData) => {
      activeSpotRef.current = spot;
      setActiveSpot?.(spot);
    };

    const handleSpotLeave = () => {
      activeSpotRef.current = null;
      setActiveSpot?.(null);
    };

    const handleSpotInteract = (spotId: string) => {
      if (activeSpotRef.current && activeSpotRef.current.id === spotId) {
        onTriggerSpot(activeSpotRef.current);
      }
    };

    const handleRoomChanged = (newRoom: string) => {
      onChangeRoom?.(newRoom as RoomId);
    };

    EventBus.on('SCENE_READY', handleSceneReady);
    EventBus.on('SPOT_ENTER', handleSpotEnter);
    EventBus.on('SPOT_LEAVE', handleSpotLeave);
    EventBus.on('SPOT_INTERACT', handleSpotInteract);
    EventBus.on('ROOM_CHANGED', handleRoomChanged);

    return () => {
      EventBus.off('SCENE_READY', handleSceneReady);
      EventBus.off('SPOT_ENTER', handleSpotEnter);
      EventBus.off('SPOT_LEAVE', handleSpotLeave);
      EventBus.off('SPOT_INTERACT', handleSpotInteract);
      EventBus.off('ROOM_CHANGED', handleRoomChanged);

      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  // Synchronize currentRoom with Phaser
  useEffect(() => {
    if (gameRef.current && sceneReadyRef.current) {
      EventBus.emit('CHANGE_ROOM', currentRoom);
    }
  }, [currentRoom]);

  // Synchronize targetSpotId navigation
  useEffect(() => {
    if (targetSpotId && gameRef.current) {
      if (sceneReadyRef.current) {
        EventBus.emit('NAVIGATE_TO', { spotId: targetSpotId });
      } else {
        pendingSpotRef.current = targetSpotId;
      }
      onClearTargetSpot?.();
    }
  }, [targetSpotId]);

  // Synchronize coffee boost trigger
  useEffect(() => {
    if (coffeeBoostTrigger && coffeeBoostTrigger > 0) {
      EventBus.emit('TRIGGER_COFFEE_BOOST');
    }
  }, [coffeeBoostTrigger]);

  // Synchronize victory celebration trigger
  useEffect(() => {
    if (celebrationTrigger && celebrationTrigger > 0) {
      EventBus.emit('TRIGGER_CELEBRATION');
    }
  }, [celebrationTrigger]);

  // Synchronize diurnal lighting phase
  useEffect(() => {
    EventBus.emit('SET_TIME_PHASE', timePhase);
  }, [timePhase]);

  return (
    <div className="relative w-full flex flex-col items-center">
      <div
        id="phaser-game-container"
        ref={containerRef}
        className="w-full max-w-4xl h-auto block bg-slate-950 rounded-2xl border-4 border-slate-700/80 shadow-2xl overflow-hidden cursor-pointer select-none"
        style={{ touchAction: 'manipulation', aspectRatio: '42 / 23' }}
        title="Tocca il pavimento per muoverti o avvicinati a una postazione per interagire!"
      />
    </div>
  );
};
