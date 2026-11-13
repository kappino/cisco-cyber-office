import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { OfficeScene } from './scenes/OfficeScene';

export const GAME_WIDTH = 840;
export const GAME_HEIGHT = 390;

export function createPhaserGame(parent: HTMLElement | string): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#0d121f',
    pixelArt: true,
    roundPixels: true,
    loader: {
      imageLoadType: 'HTMLImageElement'
    },
    render: {
      preserveDrawingBuffer: true,
      antialias: false,
      pixelArt: true
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false
      }
    },
    scene: [BootScene, OfficeScene]
  };

  return new Phaser.Game(config);
}
