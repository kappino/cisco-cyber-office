import { HD_DENSITY, hdTextureKeys } from '../utils/hdTextures';
import Phaser from 'phaser';
import { EventBus, InteractiveSpotData, RoomDevice, TimePhase } from '../EventBus';
import {
  gridToScreen,
  screenToGrid,
  getIsometricDepth,
  getDirectionFromVector,
  Direction
} from '../utils/isoMath';
import { ROOM_CONFIGS, RoomConfig } from '../data/roomData';
import { buildOfficeArchitecture, officeElevation } from '../utils/officeArchitecture';

export class OfficeScene extends Phaser.Scene {
  // Player state
  private player!: Phaser.GameObjects.Sprite;
  private playerGridX: number = 3.5;
  private playerGridY: number = 4.5;
  private playerDir: Direction = 'SE';
  private isWalking: boolean = false;
  private baseSpeed: number = 5.0; // responsive grid units per second
  private speedMultiplier: number = 1.0;
  private caffeineTimer: number = 0;

  // Navigation & Input state
  private targetWaypoint: { gx: number; gy: number; spotId?: string } | null = null;
  private currentRoomId: string = 'office';
  private activeSpot: InteractiveSpotData | null = null;
  private timePhase: TimePhase = 'sunset';

  // Keyboard controls
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    SPACE: Phaser.Input.Keyboard.Key;
    ENTER: Phaser.Input.Keyboard.Key;
  };

  // Rendering containers & groups
  private roomObjects: Phaser.GameObjects.GameObject[] = [];
  private promptContainer!: Phaser.GameObjects.Container;
  private promptText!: Phaser.GameObjects.Text;
  private promptIcon!: Phaser.GameObjects.Text;
  private windowSprite: Phaser.GameObjects.Image | null = null;

  // Dispositivi generati dal lab CML della stanza (1:1 con i nodi)
  private deviceObjects: Phaser.GameObjects.GameObject[] = [];
  private deviceSpots: InteractiveSpotData[] = [];
  private deviceSolid = new Set<string>();
  private devicesByRoom: Record<string, RoomDevice[]> = {};

  constructor() {
    super('OfficeScene');
  }

  create(): void {
    // 1. Setup keyboard controls
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasdKeys = this.input.keyboard.addKeys('W,A,S,D,SPACE,ENTER') as typeof this.wasdKeys;
    }

    // 2. Setup touch / mouse click-to-move
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.handlePointerDown(pointer);
    });

    // 3. Setup Action Prompt HUD indicator in world space
    this.setupActionPrompt();

    // 4. Register EventBus listeners
    this.registerEventBusListeners();

    // 5. Build initial room (Room 1 Entrance / Office)
    this.buildRoom(this.currentRoomId, 'init');

    // Frame isometric room tightly inside canvas
    this.cameras.main.centerOn(420, 252);
    this.cameras.main.setZoom(2.1);

    // 6. Signal scene ready
    EventBus.emit('SCENE_READY', 'OfficeScene');
  }

  private setupActionPrompt(): void {
    this.promptContainer = this.add.container(0, 0);
    this.promptContainer.setDepth(2000);
    this.promptContainer.setVisible(false);

    const bg = this.add.rectangle(0, 0, 180, 32, 0x0f172a, 0.92);
    bg.setStrokeStyle(2, 0xf59e0b);

    this.promptIcon = this.add.text(-76, -8, '◆', { fontSize: '13px', color: '#fbbf24' });
    this.promptText = this.add.text(-56, -7, '', {
      fontSize: '10px',
      color: '#fef08a',
      fontStyle: 'bold',
      fontFamily: 'monospace'
    });

    this.promptContainer.add([bg, this.promptIcon, this.promptText]);
  }

  private registerEventBusListeners(): void {
    const handleNavigateTo = (data: { tileX?: number; tileY?: number; spotId?: string }) => {
      if (data.spotId) {
        let room = ROOM_CONFIGS[this.currentRoomId];
        let spot = this.spotsOf(room).find((s) => s.id === data.spotId);

        // If spot is not in current room, switch to the room containing it
        if (!spot) {
          for (const [rId, rConfig] of Object.entries(ROOM_CONFIGS)) {
            const found = rConfig.spots.find((s) => s.id === data.spotId);
            if (found) {
              this.buildRoom(rId, 'direct');
              room = rConfig;
              spot = found;
              break;
            }
          }
        }

        if (spot) {
          this.targetWaypoint = {
            gx: spot.interactX,
            gy: spot.interactY,
            spotId: data.spotId
          };
          return;
        }
      }

      if (typeof data.tileX === 'number' && typeof data.tileY === 'number') {
        this.targetWaypoint = { gx: data.tileX, gy: data.tileY, spotId: data.spotId };
      }
    };

    const handleChangeRoom = (roomId: string) => {
      if (ROOM_CONFIGS[roomId] && roomId !== this.currentRoomId) {
        this.buildRoom(roomId, 'direct');
      }
    };

    const handleSetTimePhase = (phase: TimePhase) => {
      this.timePhase = phase;
      this.updateLightingAndWindow();
    };

    const handleTriggerCelebration = () => {
      this.celebrateSuccess();
    };

    const handleTriggerCoffeeBoost = () => {
      this.caffeineTimer = 8.0; // 8 seconds speed boost
      this.speedMultiplier = 1.6;
    };

    const handleSetRoomDevices = (payload: { roomId: string; devices: RoomDevice[] }) => {
      this.devicesByRoom[payload.roomId] = payload.devices;
      if (payload.roomId === this.currentRoomId) this.renderDevices();
    };

    EventBus.on('SET_ROOM_DEVICES', handleSetRoomDevices);
    EventBus.on('NAVIGATE_TO', handleNavigateTo);
    EventBus.on('CHANGE_ROOM', handleChangeRoom);
    EventBus.on('SET_TIME_PHASE', handleSetTimePhase);
    EventBus.on('TRIGGER_CELEBRATION', handleTriggerCelebration);
    EventBus.on('TRIGGER_COFFEE_BOOST', handleTriggerCoffeeBoost);

    this.events.once('shutdown', () => {
      EventBus.off('SET_ROOM_DEVICES', handleSetRoomDevices);
      EventBus.off('NAVIGATE_TO', handleNavigateTo);
      EventBus.off('CHANGE_ROOM', handleChangeRoom);
      EventBus.off('SET_TIME_PHASE', handleSetTimePhase);
      EventBus.off('TRIGGER_CELEBRATION', handleTriggerCelebration);
      EventBus.off('TRIGGER_COFFEE_BOOST', handleTriggerCoffeeBoost);
    });
  }

  public buildRoom(
    roomId: string,
    spawnMode: 'init' | 'door' | 'elevator' | 'direct' = 'direct'
  ): void {
    const config: RoomConfig = ROOM_CONFIGS[roomId] || ROOM_CONFIGS.office;
    this.currentRoomId = config.id;

    // 1. Clear previous room objects
    this.roomObjects.forEach((obj) => obj.destroy());
    this.roomObjects = [];
    this.windowSprite = null;
    this.activeSpot = null;
    this.targetWaypoint = null;
    if (this.promptContainer) {
      this.promptContainer.setVisible(false);
    }

    if (config.id === 'office') {
      const objects = buildOfficeArchitecture(this);
      this.roomObjects.push(...objects);
      this.windowSprite = objects.find(obj => obj.name === 'office-panorama') as Phaser.GameObjects.Image;
    } else {
    // 2. Spawn 8x8 Floor Tiles (clean subtle tint + central rug/zone)
    for (let gx = 0; gx < 8; gx++) {
      for (let gy = 0; gy < 8; gy++) {
        let tileKey = config.floorTexture;
        if (config.id === 'datacenter_vault') {
          if (gx >= 2 && gx <= 4 && gy >= 2 && gy <= 4) {
            tileKey = 'tile_server_grill';
          }
        }
        const pos = gridToScreen(gx, gy);
        const tile = this.add.image(pos.x, pos.y, tileKey);
        if (hdTextureKeys.has(tileKey)) tile.setScale(1 / HD_DENSITY);
        tile.setOrigin(0.5, 0.0);
        tile.setAlpha(config.id === 'office' ? 0.85 : 0.92);
        tile.setDepth(0);
        this.roomObjects.push(tile);
      }
    }

    // Floor edge trim + central decorative rug/zone
    const floorGfx = this.add.graphics();
    floorGfx.setDepth(2);
    const cTop = gridToScreen(0, 0);
    const cRight = gridToScreen(8, 0);
    const cBottom = gridToScreen(8, 8);
    const cLeft = gridToScreen(0, 8);
    floorGfx.lineStyle(2, 0x1e293b, 0.9);
    floorGfx.strokePoints([cTop, cRight, cBottom, cLeft, cTop]);

    const rT = gridToScreen(2.2, 2.2);
    const rR = gridToScreen(5.8, 2.2);
    const rB = gridToScreen(5.8, 5.8);
    const rL = gridToScreen(2.2, 5.8);
    const rugFill = config.id === 'office' ? 0x1e3a5f : config.id === 'corridor' ? 0x0f2942 : 0x082f49;
    const rugBorder = config.id === 'office' ? 0x38bdf8 : config.id === 'corridor' ? 0x22d3ee : 0x06b6d4;
    floorGfx.fillStyle(rugFill, 0.55);
    floorGfx.fillPoints([rT, rR, rB, rL], true);
    floorGfx.lineStyle(2, rugBorder, 0.75);
    floorGfx.strokePoints([rT, rR, rB, rL, rT]);
    this.roomObjects.push(floorGfx);

    // 3. Continuous Gap-Free Isometric Walls
    const wallH = 74;
    const wallGfx = this.add.graphics();
    wallGfx.setDepth(3);

    const westColor = config.id === 'office' ? 0x334155 : config.id === 'corridor' ? 0x1e293b : 0x0f172a;
    const northColor = config.id === 'office' ? 0x475569 : config.id === 'corridor' ? 0x334155 : 0x1e293b;
    const trimColor = config.id === 'datacenter_vault' ? 0x0ea5e9 : 0x38bdf8;

    const drawWallSegment = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      fillColor: number
    ) => {
      const p1 = gridToScreen(x1, y1);
      const p2 = gridToScreen(x2, y2);
      wallGfx.fillStyle(fillColor, 1);
      wallGfx.fillPoints(
        [
          { x: p1.x, y: p1.y },
          { x: p2.x, y: p2.y },
          { x: p2.x, y: p2.y - wallH },
          { x: p1.x, y: p1.y - wallH }
        ],
        true
      );
      // Baseboard & top cyan/slate accent trim
      wallGfx.lineStyle(3, 0x0f172a, 0.9);
      wallGfx.lineBetween(p1.x, p1.y - 2, p2.x, p2.y - 2);
      wallGfx.lineStyle(2, trimColor, 0.85);
      wallGfx.lineBetween(p1.x, p1.y - wallH, p2.x, p2.y - wallH);
    };

    // West wall (gx = 0)
    if (config.id === 'corridor') {
      drawWallSegment(0, 0, 0, 3, westColor);
      drawWallSegment(0, 5, 0, 8, westColor);
    } else {
      drawWallSegment(0, 0, 0, 8, westColor);
    }
    // North wall (gy = 0)
    drawWallSegment(0, 0, 8, 0, northColor);
    this.roomObjects.push(wallGfx);

    // Panoramic Vesuvius Window (flush with West wall)
    if (config.hasWindow && config.windowGridY !== undefined) {
      const winPos = gridToScreen(0, 2.95);
      const winKey = `window_vesuvius_iso_${this.timePhase}`;
      this.windowSprite = this.add.image(winPos.x, winPos.y - 37, winKey);
      this.windowSprite.setScale(1 / HD_DENSITY);
      this.windowSprite.setOrigin(0.5, 0.5);
      this.windowSprite.setDepth(4);
      this.roomObjects.push(this.windowSprite);

      // Subtle sunlight beam cast onto parquet floor
      const beam = this.add.graphics();
      beam.setDepth(2);
      const b1 = gridToScreen(0.2, 1.3);
      const b2 = gridToScreen(0.2, 4.6);
      const b3 = gridToScreen(2.6, 4.6);
      const b4 = gridToScreen(2.6, 1.3);
      beam.fillStyle(0xfef08a, this.timePhase === 'night' ? 0.04 : 0.12);
      beam.fillPoints([b1, b2, b3, b4], true);
      this.roomObjects.push(beam);
    }

    // North wall decorative tech posters / status panel
    {
      const pGfx = this.add.graphics();
      pGfx.setDepth(4);
      const p1 = gridToScreen(2.0, 0);
      const p2 = gridToScreen(3.3, 0);
      pGfx.fillStyle(0x0f172a, 0.95);
      pGfx.fillPoints(
        [
          { x: p1.x, y: p1.y - 24 },
          { x: p2.x, y: p2.y - 24 },
          { x: p2.x, y: p2.y - 54 },
          { x: p1.x, y: p1.y - 54 }
        ],
        true
      );
      pGfx.lineStyle(1.5, 0x38bdf8, 0.9);
      pGfx.strokePoints([
        { x: p1.x, y: p1.y - 24 },
        { x: p2.x, y: p2.y - 24 },
        { x: p2.x, y: p2.y - 54 },
        { x: p1.x, y: p1.y - 54 },
        { x: p1.x, y: p1.y - 24 }
      ]);
      // Telemetry bars inside North wall monitor
      const barColors = [0x22d3ee, 0x34d399, 0xf59e0b, 0x38bdf8];
      for (let i = 0; i < 4; i++) {
        const t = 0.18 + i * 0.2;
        const bx = p1.x + (p2.x - p1.x) * t;
        const by = p1.y + (p2.y - p1.y) * t - 28;
        const bh = 8 + (i % 3) * 5;
        pGfx.lineStyle(3, barColors[i], 0.9);
        pGfx.lineBetween(bx, by, bx, by - bh);
      }
      this.roomObjects.push(pGfx);
    }

    }

    if (config.id !== 'office') {
      const details = this.add.graphics().setDepth(4);
      const vault = config.id === 'datacenter_vault';
      // Recessed wall panels and continuous architectural task lighting.
      for (let x = 0.5; x < 7.5; x += 1.35) {
        const a = gridToScreen(x, 0), b = gridToScreen(x + 1.1, 0);
        details.fillStyle(vault ? 0x1d3440 : 0x4b6268, 0.8);
        details.fillPoints([{x:a.x,y:a.y-14},{x:b.x,y:b.y-14},{x:b.x,y:b.y-62},{x:a.x,y:a.y-62}],true);
        details.lineStyle(1, 0x7b979f, 0.35);
        details.lineBetween(a.x,a.y-62,b.x,b.y-62);
        details.lineStyle(2,vault ? 0x9ad9e0 : 0xf0d7a9,0.8);
        details.lineBetween(a.x,a.y-67,b.x,b.y-67);
      }
      this.roomObjects.push(details);
      const lanes=this.add.graphics().setDepth(1);
      for(const x of [2.1,4.9]) {
        const a=gridToScreen(x,2),b=gridToScreen(x,6.5);
        lanes.lineStyle(2,vault ? 0x71c2ce : 0xb6a579,0.5);
        lanes.lineBetween(a.x,a.y,b.x,b.y);
      }
      this.roomObjects.push(lanes);
    }

    // 4. Spawn Furniture & Equipment with ground shadows
    config.furniture.forEach((f) => {
      const pos = this.projectPosition(f.gridX, f.gridY);
      const shadow = this.add.ellipse(pos.x, pos.y + 4, 44, 18, 0x020617, 0.35);
      shadow.setDepth(getIsometricDepth(f.gridX, f.gridY, 1));
      this.roomObjects.push(shadow);

      const sprite = this.add.sprite(pos.x, pos.y, f.textureKey, f.frame ?? 0);
      if (hdTextureKeys.has(f.textureKey)) sprite.setScale(1 / HD_DENSITY);
      sprite.setOrigin(f.originX ?? 0.5, f.originY ?? 0.85);
      sprite.setDepth(getIsometricDepth(f.gridX, f.gridY, 5));
      if (f.animKey && this.anims.exists(f.animKey)) {
        sprite.play(f.animKey);
      }
      this.roomObjects.push(sprite);
    });

    // 4b. Dispositivi di rete: esattamente i nodi del lab CML della stanza
    this.renderDevices();

    // 5. Spawn NPCs with ground shadows
    config.npcs.forEach((npc) => {
      const pos = this.projectPosition(npc.gridX, npc.gridY);
      const shadow = this.add.ellipse(pos.x, pos.y + 4, 28, 12, 0x020617, 0.4);
      shadow.setDepth(getIsometricDepth(npc.gridX, npc.gridY, 2));
      this.roomObjects.push(shadow);

      const sprite = this.add.sprite(pos.x, pos.y, npc.charKey, 0);
      sprite.setScale(1 / 3);
      sprite.setOrigin(0.5, 0.85);
      sprite.setDepth(getIsometricDepth(npc.gridX, npc.gridY, 6));
      const idleAnim = `${npc.charKey}-idle-${npc.direction}`;
      if (this.anims.exists(idleAnim)) {
        sprite.play(idleAnim);
      }
      this.roomObjects.push(sprite);
    });

    // 6. Spawn or Reposition Player
    let spawnGx = config.defaultSpawn.gx;
    let spawnGy = config.defaultSpawn.gy;
    let spawnDir = config.defaultSpawn.dir;

    if (spawnMode === 'elevator') {
      spawnGx = 5.8;
      spawnGy = 1.4;
      spawnDir = 'SW';
    }

    this.playerGridX = spawnGx;
    this.playerGridY = spawnGy;
    this.playerDir = spawnDir;

    const pPos = this.projectPosition(this.playerGridX, this.playerGridY);
    if (!this.player) {
      this.player = this.add.sprite(pPos.x, pPos.y, 'protagonist', 0);
      this.player.setScale(1 / 3);
      this.player.setOrigin(0.5, 0.85);
    } else {
      this.player.setPosition(pPos.x, pPos.y);
    }
    this.player.setDepth(getIsometricDepth(this.playerGridX, this.playerGridY, 7));
    this.player.play(`protagonist-idle-${this.playerDir}`);

    // 7. Apply Room Lighting & Camera Fade-in
    this.updateLightingAndWindow();
    this.cameras.main.fadeIn(200, 13, 18, 31);

    // 8. Emit room change event
    EventBus.emit('ROOM_CHANGED', config.id);
  }

  private updateLightingAndWindow(): void {
    if (this.windowSprite && this.textures.exists(`window_vesuvius_iso_${this.timePhase}`)) {
      this.windowSprite.setTexture(`window_vesuvius_iso_${this.timePhase}`);
    }

    let tintColor = 0xffffff;
    if (this.timePhase === 'sunset') {
      tintColor = 0xffdfb8;
    } else if (this.timePhase === 'night') {
      tintColor = 0x90a4d4;
    }

    this.roomObjects.forEach((obj) => {
      if ('setTint' in obj) {
        (obj as Phaser.GameObjects.Sprite).setTint(tintColor);
      }
    });

    if (this.player) {
      this.player.setTint(tintColor);
    }
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    const worldPt = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    let grid = screenToGrid(worldPt.x, worldPt.y);
    if (this.currentRoomId === 'office') {
      // Invert the elevated gallery projection by fixed-point refinement.
      for (let i = 0; i < 8; i++) {
        grid = screenToGrid(worldPt.x, worldPt.y + officeElevation(grid.gx, grid.gy));
      }
    }
    if (grid.gx >= 0.5 && grid.gx <= 7.2 && grid.gy >= 0.5 && grid.gy <= 7.2) {
      this.targetWaypoint = { gx: grid.gx, gy: grid.gy };
    }
  }

  private celebrateSuccess(): void {
    if (!this.player) return;
    this.tweens.add({
      targets: this.player,
      y: this.player.y - 24,
      duration: 180,
      yoyo: true,
      repeat: 2,
      ease: 'Quad.easeOut'
    });
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;

    // 1. Decay caffeine speed boost timer
    if (this.caffeineTimer > 0) {
      this.caffeineTimer -= dt;
      if (this.caffeineTimer <= 0) {
        this.speedMultiplier = 1.0;
      }
    }

    // 2. Evaluate movement inputs (WASD / Arrows vs Waypoint)
    let moveGx = 0;
    let moveGy = 0;
    let inputActive = false;

    if (this.wasdKeys && this.cursors) {
      const up = this.wasdKeys.W.isDown || this.cursors.up.isDown;
      const down = this.wasdKeys.S.isDown || this.cursors.down.isDown;
      const left = this.wasdKeys.A.isDown || this.cursors.left.isDown;
      const right = this.wasdKeys.D.isDown || this.cursors.right.isDown;

      // Screen Up: (-1, -1)
      if (up) {
        moveGx -= 1;
        moveGy -= 1;
        inputActive = true;
      }
      // Screen Down: (+1, +1)
      if (down) {
        moveGx += 1;
        moveGy += 1;
        inputActive = true;
      }
      // Screen Left: (-1, +1)
      if (left) {
        moveGx -= 1;
        moveGy += 1;
        inputActive = true;
      }
      // Screen Right: (+1, -1)
      if (right) {
        moveGx += 1;
        moveGy -= 1;
        inputActive = true;
      }

      if (inputActive) {
        this.targetWaypoint = null; // Keyboard overrides path waypoint
      }
    }

    // Follow click waypoint if active
    if (!inputActive && this.targetWaypoint) {
      const dx = this.targetWaypoint.gx - this.playerGridX;
      const dy = this.targetWaypoint.gy - this.playerGridY;
      const dist = Math.hypot(dx, dy);

      if (dist <= 0.2) {
        const finishedWaypoint = this.targetWaypoint;
        this.targetWaypoint = null;
        if (finishedWaypoint.spotId) {
          const room = ROOM_CONFIGS[this.currentRoomId];
          const spot = this.spotsOf(room).find((s) => s.id === finishedWaypoint.spotId);
          if (spot) {
            this.activeSpot = spot;
            this.showPromptForSpot(spot);
            EventBus.emit('SPOT_ENTER', spot);
          }
          EventBus.emit('SPOT_INTERACT', finishedWaypoint.spotId);
        }
      } else {
        moveGx = dx / dist;
        moveGy = dy / dist;
        inputActive = true;
      }
    }

    // 3. Movement integration with obstacle collision sliding
    const room = ROOM_CONFIGS[this.currentRoomId];
    if (inputActive) {
      const len = Math.hypot(moveGx, moveGy);
      if (len > 0) {
        moveGx /= len;
        moveGy /= len;
      }

      const rawStep = this.baseSpeed * this.speedMultiplier * dt;
      const step = this.targetWaypoint
        ? Math.min(rawStep, Math.hypot(this.targetWaypoint.gx - this.playerGridX, this.targetWaypoint.gy - this.playerGridY))
        : rawStep;
      const candidateX = this.playerGridX + moveGx * step;
      const candidateY = this.playerGridY + moveGy * step;

      // Slide resolution: test X and Y independently
      if (this.isCellWalkable(candidateX, this.playerGridY, room)) {
        this.playerGridX = candidateX;
      }
      if (this.isCellWalkable(this.playerGridX, candidateY, room)) {
        this.playerGridY = candidateY;
      }

      // Update orientation and walk animation
      this.playerDir = getDirectionFromVector(moveGx, moveGy, this.playerDir);
      const walkAnim = `protagonist-walk-${this.playerDir}`;
      if (!this.isWalking || this.player.anims.currentAnim?.key !== walkAnim) {
        this.player.play(walkAnim, true);
        this.isWalking = true;
      }
    } else {
      if (this.isWalking) {
        this.isWalking = false;
        this.player.play(`protagonist-idle-${this.playerDir}`);
      }
    }

    // 4. Update player screen position and sorting depth
    const screenPos = this.projectPosition(this.playerGridX, this.playerGridY);
    this.player.setPosition(screenPos.x, screenPos.y);
    this.player.setDepth(getIsometricDepth(this.playerGridX, this.playerGridY, 7));

    EventBus.emit('PLAYER_MOVED', {
      x: screenPos.x,
      y: screenPos.y,
      gridX: this.playerGridX,
      gridY: this.playerGridY
    });

    // 5. Check doorway threshold transitions
    for (const t of room.thresholds) {
      if (
        this.playerGridX >= t.minGx &&
        this.playerGridX <= t.maxGx &&
        this.playerGridY >= t.minGy &&
        this.playerGridY <= t.maxGy
      ) {
        this.buildRoom(t.targetRoom, 'door');
        return;
      }
    }

    // 6. Proximity detection to interactive spots
    let nearestSpot: InteractiveSpotData | null = null;
    let minDistance = 1.6;

    for (const spot of this.spotsOf(room)) {
      const d = Math.hypot(
        this.playerGridX - spot.interactX,
        this.playerGridY - spot.interactY
      );
      if (d < minDistance) {
        minDistance = d;
        nearestSpot = spot;
      }
    }

    if (nearestSpot && nearestSpot !== this.activeSpot) {
      this.activeSpot = nearestSpot;
      this.showPromptForSpot(nearestSpot);
      EventBus.emit('SPOT_ENTER', nearestSpot);
    } else if (!nearestSpot && this.activeSpot) {
      this.activeSpot = null;
      this.promptContainer.setVisible(false);
      EventBus.emit('SPOT_LEAVE');
    }

    // 7. Spacebar / Enter interaction trigger
    if (this.wasdKeys) {
      const spacePressed = Phaser.Input.Keyboard.JustDown(this.wasdKeys.SPACE);
      const enterPressed = Phaser.Input.Keyboard.JustDown(this.wasdKeys.ENTER);
      if ((spacePressed || enterPressed) && this.activeSpot) {
        EventBus.emit('SPOT_INTERACT', this.activeSpot.id);
      }
    }
  }

  private spotsOf(room: RoomConfig): InteractiveSpotData[] {
    return room.id === this.currentRoomId ? [...room.spots, ...this.deviceSpots] : room.spots;
  }

  /** Disegna i dispositivi della stanza dal lab CML: stesso numero, stessi nomi, stato reale. */
  private renderDevices(): void {
    this.deviceObjects.forEach((o) => o.destroy());
    this.deviceObjects = [];
    this.deviceSpots = [];
    this.deviceSolid.clear();
    const room = ROOM_CONFIGS[this.currentRoomId];
    const devices = this.devicesByRoom[this.currentRoomId] || [];
    const used = new Set<string>();
    devices.forEach((d, idx) => {
      let gx = d.game?.gx;
      let gy = d.game?.gy;
      if (gx === undefined || gy === undefined || used.has(`${Math.floor(gx)},${Math.floor(gy)}`)) {
        // nodo senza posizione nel file della stanza: primo posto libero lungo la parete nord
        const free = [1, 2, 3, 4, 5, 6].map((y) => ({ x: 1 + (idx % 2), y }))
          .find((c) => !used.has(`${c.x},${c.y}`) && room.solidGrid[c.x][c.y] === 0);
        if (!free) return;
        gx = free.x; gy = free.y;
      }
      used.add(`${Math.floor(gx)},${Math.floor(gy)}`);
      this.deviceSolid.add(`${Math.floor(gx)},${Math.floor(gy)}`);

      const pos = this.projectPosition(gx, gy);
      const on = d.state === 'BOOTED';
      const texture = d.kind === 'switch' ? 'furniture_rack_sw1_sheet'
        : d.kind === 'router' || d.kind === 'server' ? 'furniture_server_r1_sheet' : 'furniture_desk';
      const anim = d.kind === 'switch' ? 'rack-sw1-blink' : d.kind === 'router' || d.kind === 'server' ? 'server-r1-blink' : '';

      const shadow = this.add.ellipse(pos.x, pos.y + 4, 44, 18, 0x020617, 0.35)
        .setDepth(getIsometricDepth(gx, gy, 1));
      const sprite = this.add.sprite(pos.x, pos.y, texture, 0);
      if (hdTextureKeys.has(texture)) sprite.setScale(1 / HD_DENSITY);
      sprite.setOrigin(0.5, 0.85).setDepth(getIsometricDepth(gx, gy, 5));
      if (on && anim && this.anims.exists(anim)) sprite.play(anim);
      if (!on) sprite.setTint(0x64748b);

      // targhetta con nome del nodo CML e LED di stato
      const ledColor = on ? (d.linksUp === d.linksTotal ? 0x22c55e : 0xf59e0b)
        : d.state === 'STOPPED' || d.state === 'DEFINED_ON_CORE' ? 0x475569 : 0xf59e0b;
      const label = this.add.text(pos.x, pos.y - 74, d.label, {
        fontFamily: 'monospace', fontSize: '8px', color: '#e2e8f0',
        backgroundColor: '#0f172acc', padding: { x: 3, y: 1 }, resolution: 3,
      }).setOrigin(0.5, 1).setDepth(getIsometricDepth(gx, gy, 8));
      const led = this.add.circle(pos.x - label.width / 2 - 4, pos.y - 78, 2.5, ledColor)
        .setDepth(getIsometricDepth(gx, gy, 8));
      if (on && d.linksUp < d.linksTotal) {
        this.tweens.add({ targets: led, alpha: 0.2, duration: 450, yoyo: true, repeat: -1 });
      }
      this.deviceObjects.push(shadow, sprite, label, led);

      // punto d'interazione sulla casella libera piu' vicina
      const around = [[1, 0], [0, 1], [1, 1], [-1, 0], [0, -1], [1, -1], [-1, 1]];
      let ix = gx + 1, iy = gy;
      for (const [dx, dy] of around) {
        const cx = Math.floor(gx) + dx, cy = Math.floor(gy) + dy;
        if (cx > 0 && cx < 7 && cy > 0 && cy < 7 && room.solidGrid[cx][cy] === 0 && !used.has(`${cx},${cy}`)) {
          ix = cx + 0.5; iy = cy + 0.5;
          break;
        }
      }
      const icon = d.kind === 'switch' ? '🔀' : d.kind === 'router' ? '🛜' : d.kind === 'server' ? '🗄️' : d.kind === 'printer' ? '🖨️' : '🖥️';
      this.deviceSpots.push({
        id: `cml:${d.label}`,
        name: d.display,
        tag: `${d.kind.toUpperCase()} · ${d.label}`,
        desc: on ? `Acceso · cavi attivi ${d.linksUp}/${d.linksTotal}` : `Stato CML: ${d.state}`,
        icon,
        actionText: on ? 'CONSOLE E CAVI' : 'IN AVVIO…',
        tileX: gx, tileY: gy, interactX: ix, interactY: iy,
        cmlNode: d.label,
      });
    });
  }

  private projectPosition(gx: number, gy: number): { x: number; y: number } {
    const p = gridToScreen(gx, gy);
    if (this.currentRoomId === 'office') p.y -= officeElevation(gx, gy);
    return p;
  }

  private isCellWalkable(gx: number, gy: number, room: RoomConfig): boolean {
    if (gx < 0.3 || gx > 7.3 || gy < 0.3 || gy > 7.3) {
      return false;
    }
    const cellX = Math.floor(gx);
    const cellY = Math.floor(gy);
    if (cellX >= 0 && cellX < 8 && cellY >= 0 && cellY < 8) {
      if (room.id === this.currentRoomId && this.deviceSolid.has(`${cellX},${cellY}`)) return false;
      return room.solidGrid[cellX][cellY] === 0;
    }
    return true;
  }

  private showPromptForSpot(spot: InteractiveSpotData): void {
    const sPos = this.projectPosition(spot.tileX, spot.tileY);
    this.promptContainer.setPosition(sPos.x, sPos.y - 60);
    this.promptIcon.setText('◆');
    this.promptText.setText(spot.actionText || spot.name);
    this.promptContainer.setVisible(true);
  }
}
