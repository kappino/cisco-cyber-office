import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { OfficeScene } from './scenes/OfficeScene';

export const GAME_WIDTH = 1680;
export const GAME_HEIGHT = 920;

export function createPhaserGame(parent: HTMLElement | string): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#dde3ec',
    pixelArt: false,
    roundPixels: false,
    loader: {
      imageLoadType: 'HTMLImageElement'
    },
    render: {
      preserveDrawingBuffer: true,
      antialias: true,
      pixelArt: false
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
