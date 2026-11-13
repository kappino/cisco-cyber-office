import { registerCharacterTextures } from '../utils/characterTextures';
import Phaser from 'phaser';
import { registerCrispEnvironmentTextures, registerVesuviusWindows } from '../utils/hdTextures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.load.image('gulf-naples-hd', '/assets/environment/gulf-naples-hd.png');
    // 1. Character Spritesheets (160x256 px, 4 rows x 5 cols, 32x64 frame size)
    this.load.spritesheet('protagonist', '/assets/characters/protagonist_spritesheet.png', {
      frameWidth: 32,
      frameHeight: 64
    });
    this.load.spritesheet('rosaria', '/assets/characters/rosaria_spritesheet.png', {
      frameWidth: 32,
      frameHeight: 64
    });
    this.load.spritesheet('ciro', '/assets/characters/ciro_spritesheet.png', {
      frameWidth: 32,
      frameHeight: 64
    });
    this.load.spritesheet('marco', '/assets/characters/marco_spritesheet.png', {
      frameWidth: 32,
      frameHeight: 64
    });

    // 2. Isometric Floor Tiles (64x32 px)
    this.load.image('tile_parquet', '/assets/environment/tile_parquet.png');
    this.load.image('tile_corridor', '/assets/environment/tile_corridor.png');
    this.load.image('tile_server_grill', '/assets/environment/tile_server_grill.png');
    this.load.image('tile_server_solid', '/assets/environment/tile_server_solid.png');

    // 3. Walls & Doorways (64x80 px)
    this.load.image('wall_left', '/assets/environment/wall_left.png');
    this.load.image('wall_right', '/assets/environment/wall_right.png');
    this.load.image('door_frame', '/assets/environment/door_frame.png');

    // 4. Furniture & Equipment Sprites
    this.load.image('furniture_desk', '/assets/environment/furniture_desk.png');
    this.load.image('furniture_monstera', '/assets/environment/furniture_monstera.png');
    this.load.image('furniture_pizza_box', '/assets/environment/furniture_pizza_box.png');

    // 5. Multi-Frame Equipment Spritesheets
    this.load.spritesheet('furniture_rack_sw1_sheet', '/assets/environment/furniture_rack_sw1_sheet.png', {
      frameWidth: 64,
      frameHeight: 80
    });
    this.load.spritesheet('furniture_server_r1_sheet', '/assets/environment/furniture_server_r1_sheet.png', {
      frameWidth: 64,
      frameHeight: 96
    });
    this.load.spritesheet('furniture_bar_coffee_sheet', '/assets/environment/furniture_bar_coffee_sheet.png', {
      frameWidth: 80,
      frameHeight: 64
    });

    // 6. Panoramic Vesuvius Windows & Scenic Backdrop
    this.load.image('window_vesuvius_iso_morning', '/assets/environment/window_vesuvius_iso_morning.png');
    this.load.image('window_vesuvius_iso_sunset', '/assets/environment/window_vesuvius_iso_sunset.png');
    this.load.image('window_vesuvius_iso_night', '/assets/environment/window_vesuvius_iso_night.png');
  }

  create(): void {
    // Upgrade environment & furniture textures to crisp HD vector-canvas sprites
    registerCrispEnvironmentTextures(this);
    registerCharacterTextures(this);
    registerVesuviusWindows(this);

    const characters = ['protagonist', 'rosaria', 'ciro', 'marco'];

    // Register 4-direction Idle and Walk animations for all 4 characters
    characters.forEach((charKey) => {
      // Row 0: SE (South-East)
      this.anims.create({
        key: `${charKey}-idle-SE`,
        frames: [{ key: charKey, frame: 0 }],
        frameRate: 1
      });
      this.anims.create({
        key: `${charKey}-walk-SE`,
        frames: this.anims.generateFrameNumbers(charKey, { start: 1, end: 4 }),
        frameRate: 8,
        repeat: -1
      });

      // Row 1: SW (South-West)
      this.anims.create({
        key: `${charKey}-idle-SW`,
        frames: [{ key: charKey, frame: 5 }],
        frameRate: 1
      });
      this.anims.create({
        key: `${charKey}-walk-SW`,
        frames: this.anims.generateFrameNumbers(charKey, { start: 6, end: 9 }),
        frameRate: 8,
        repeat: -1
      });

      // Row 2: NE (North-East)
      this.anims.create({
        key: `${charKey}-idle-NE`,
        frames: [{ key: charKey, frame: 10 }],
        frameRate: 1
      });
      this.anims.create({
        key: `${charKey}-walk-NE`,
        frames: this.anims.generateFrameNumbers(charKey, { start: 11, end: 14 }),
        frameRate: 8,
        repeat: -1
      });

      // Row 3: NW (North-West)
      this.anims.create({
        key: `${charKey}-idle-NW`,
        frames: [{ key: charKey, frame: 15 }],
        frameRate: 1
      });
      this.anims.create({
        key: `${charKey}-walk-NW`,
        frames: this.anims.generateFrameNumbers(charKey, { start: 16, end: 19 }),
        frameRate: 8,
        repeat: -1
      });
    });

    // Equipment blink and steam animations
    this.anims.create({
      key: 'rack-sw1-blink',
      frames: this.anims.generateFrameNumbers('furniture_rack_sw1_sheet', { start: 0, end: 1 }),
      frameRate: 2,
      repeat: -1
    });

    this.anims.create({
      key: 'server-r1-blink',
      frames: this.anims.generateFrameNumbers('furniture_server_r1_sheet', { start: 0, end: 1 }),
      frameRate: 3,
      repeat: -1
    });

    this.anims.create({
      key: 'bar-coffee-steam',
      frames: this.anims.generateFrameNumbers('furniture_bar_coffee_sheet', { start: 0, end: 1 }),
      frameRate: 2,
      repeat: -1
    });

    // Transition immediately to the multi-room OfficeScene
    this.scene.start('OfficeScene');
  }
}
