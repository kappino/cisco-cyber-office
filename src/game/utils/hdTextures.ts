import Phaser from 'phaser';

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function replaceTexture(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement): void {
  if (scene.textures.exists(key)) {
    scene.textures.remove(key);
  }
  scene.textures.addCanvas(key, canvas);
}

function replaceSpritesheet(
  scene: Phaser.Scene,
  key: string,
  canvas: HTMLCanvasElement,
  frameWidth: number,
  frameHeight: number
): void {
  if (scene.textures.exists(key)) {
    scene.textures.remove(key);
  }
  scene.textures.addSpriteSheet(key, canvas as unknown as HTMLImageElement, {
    frameWidth,
    frameHeight
  });
}

function isoDiamondPath(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(w / 2, 0);
  ctx.lineTo(w, h / 2);
  ctx.lineTo(w / 2, h);
  ctx.lineTo(0, h / 2);
  ctx.closePath();
}

export function registerCrispEnvironmentTextures(scene: Phaser.Scene): void {
  // 1. Warm Parquet Tile (64x32, smooth plank shading - NO noisy dots)
  {
    const [c, ctx] = makeCanvas(64, 32);
    ctx.save();
    isoDiamondPath(ctx, 64, 32);
    ctx.clip();

    const grad = ctx.createLinearGradient(0, 0, 64, 32);
    grad.addColorStop(0, '#9c6638');
    grad.addColorStop(0.5, '#8a572d');
    grad.addColorStop(1, '#784924');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 32);

    // Subtle isometric plank seams
    ctx.strokeStyle = 'rgba(58, 30, 12, 0.45)';
    ctx.lineWidth = 1;
    for (let i = -32; i < 64; i += 12) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 48, 24);
      ctx.stroke();
    }
    // Soft highlight along top-left edges
    ctx.strokeStyle = 'rgba(255, 224, 180, 0.14)';
    ctx.beginPath();
    ctx.moveTo(32, 1);
    ctx.lineTo(63, 16);
    ctx.stroke();
    ctx.restore();

    // Subtle tile outline
    isoDiamondPath(ctx, 64, 32);
    ctx.strokeStyle = 'rgba(42, 22, 10, 0.32)';
    ctx.lineWidth = 1;
    ctx.stroke();
    replaceTexture(scene, 'tile_parquet', c);
  }

  // 2. Tech Corridor Tile (64x32, sleek dark slate with cyan micro-trim)
  {
    const [c, ctx] = makeCanvas(64, 32);
    ctx.save();
    isoDiamondPath(ctx, 64, 32);
    ctx.clip();
    const grad = ctx.createLinearGradient(0, 0, 64, 32);
    grad.addColorStop(0, '#1e293b');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 32);
    ctx.restore();

    isoDiamondPath(ctx, 64, 32);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();
    replaceTexture(scene, 'tile_corridor', c);
  }

  // 3. Datacenter Solid Floor & Cold Aisle Grill
  {
    const [c, ctx] = makeCanvas(64, 32);
    ctx.save();
    isoDiamondPath(ctx, 64, 32);
    ctx.clip();
    ctx.fillStyle = '#0c1628';
    ctx.fillRect(0, 0, 64, 32);
    ctx.restore();
    isoDiamondPath(ctx, 64, 32);
    ctx.strokeStyle = 'rgba(14, 165, 233, 0.25)';
    ctx.stroke();
    replaceTexture(scene, 'tile_server_solid', c);
  }

  {
    const [c, ctx] = makeCanvas(64, 32);
    ctx.save();
    isoDiamondPath(ctx, 64, 32);
    ctx.clip();
    ctx.fillStyle = '#062038';
    ctx.fillRect(0, 0, 64, 32);
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
    ctx.lineWidth = 1;
    for (let x = 8; x < 56; x += 6) {
      ctx.beginPath();
      ctx.moveTo(x, 4);
      ctx.lineTo(x + 12, 28);
      ctx.stroke();
    }
    ctx.restore();
    isoDiamondPath(ctx, 64, 32);
    ctx.strokeStyle = '#22d3ee';
    ctx.stroke();
    replaceTexture(scene, 'tile_server_grill', c);
  }

  // 4. Dual-Monitor Tech Desk (80x64)
  {
    const [c, ctx] = makeCanvas(80, 64);
    // Metal legs
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(16, 42); ctx.lineTo(16, 56);
    ctx.moveTo(64, 42); ctx.lineTo(64, 56);
    ctx.moveTo(40, 50); ctx.lineTo(40, 60);
    ctx.stroke();

    // Desk top isometric slab
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(40, 24);
    ctx.lineTo(72, 38);
    ctx.lineTo(40, 52);
    ctx.lineTo(8, 38);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Desk front edge thickness
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(8, 38);
    ctx.lineTo(40, 52);
    ctx.lineTo(40, 56);
    ctx.lineTo(8, 42);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(40, 52);
    ctx.lineTo(72, 38);
    ctx.lineTo(72, 42);
    ctx.lineTo(40, 56);
    ctx.closePath();
    ctx.fill();

    // Left & Right Glowing Widescreen Monitors
    const drawMonitor = (mx: number, my: number, screenColor: string) => {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(mx, my, 20, 14);
      ctx.strokeStyle = '#334155';
      ctx.strokeRect(mx, my, 20, 14);
      ctx.fillStyle = screenColor;
      ctx.fillRect(mx + 2, my + 2, 16, 10);
      // Code lines
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(mx + 3, my + 4, 10, 1.5);
      ctx.fillRect(mx + 3, my + 7, 13, 1.5);
      ctx.fillStyle = '#475569';
      ctx.fillRect(mx + 8, my + 14, 4, 4);
    };
    drawMonitor(18, 16, '#0284c7');
    drawMonitor(42, 16, '#0d9488');

    // Keyboard & mouse
    ctx.fillStyle = '#334155';
    ctx.fillRect(31, 36, 16, 5);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(50, 38, 4, 3);

    replaceTexture(scene, 'furniture_desk', c);
  }

  // 5. Lush Monstera Plant in Terracotta Pot (48x64)
  {
    const [c, ctx] = makeCanvas(48, 64);
    // Terracotta pot
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.moveTo(15, 42);
    ctx.lineTo(33, 42);
    ctx.lineTo(30, 58);
    ctx.lineTo(18, 58);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d97706';
    ctx.fillRect(14, 39, 20, 4);

    // Rich green leaves
    const leaves = [
      { x: 24, y: 24, r: 9, color: '#15803d' },
      { x: 15, y: 28, r: 8, color: '#16a34a' },
      { x: 33, y: 27, r: 8, color: '#16a34a' },
      { x: 24, y: 16, r: 8, color: '#22c55e' },
      { x: 18, y: 20, r: 6, color: '#4ade80' },
      { x: 30, y: 21, r: 6, color: '#22c55e' }
    ];
    leaves.forEach((lf) => {
      ctx.fillStyle = lf.color;
      ctx.beginPath();
      ctx.arc(lf.x, lf.y, lf.r, 0, Math.PI * 2);
      ctx.fill();
    });
    // Stems
    ctx.strokeStyle = '#14532d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(24, 40); ctx.lineTo(24, 20);
    ctx.moveTo(24, 38); ctx.lineTo(15, 29);
    ctx.moveTo(24, 38); ctx.lineTo(33, 28);
    ctx.stroke();

    replaceTexture(scene, 'furniture_monstera', c);
  }

  // 6. Pizza Box (48x36)
  {
    const [c, ctx] = makeCanvas(48, 36);
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(24, 12);
    ctx.lineTo(42, 21);
    ctx.lineTo(24, 30);
    ctx.lineTo(6, 21);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.stroke();

    // Pizza pie inside
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.ellipse(24, 21, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.ellipse(24, 21, 8, 3.8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Mozzarella spots
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(20, 19, 3, 2);
    ctx.fillRect(25, 20, 3, 2);
    ctx.fillRect(22, 22, 3, 1.5);
    replaceTexture(scene, 'furniture_pizza_box', c);
  }

  // 7. Neapolitan Espresso Bar Counter (2 frames: 80x64 each -> 160x64)
  {
    const [c, ctx] = makeCanvas(160, 64);
    for (let f = 0; f < 2; f++) {
      const ox = f * 80;
      // Wood counter body
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.moveTo(ox + 8, 34);
      ctx.lineTo(ox + 40, 48);
      ctx.lineTo(ox + 40, 60);
      ctx.lineTo(ox + 8, 46);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#451a03';
      ctx.beginPath();
      ctx.moveTo(ox + 40, 48);
      ctx.lineTo(ox + 72, 34);
      ctx.lineTo(ox + 72, 46);
      ctx.lineTo(ox + 40, 60);
      ctx.closePath();
      ctx.fill();

      // Marble counter top
      ctx.fillStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.moveTo(ox + 40, 20);
      ctx.lineTo(ox + 72, 34);
      ctx.lineTo(ox + 40, 48);
      ctx.lineTo(ox + 8, 34);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.stroke();

      // Chrome Espresso Machine
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(ox + 26, 12, 20, 16);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(ox + 28, 13, 16, 4);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(ox + 30, 19, 12, 7);
      // Warm amber power LED
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(ox + 42, 14, 2, 2);

      // Espresso cup + animated steam
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ox + 48, 28, 6, 5);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1.5;
      const sOff = f === 0 ? 0 : -2;
      ctx.beginPath();
      ctx.moveTo(ox + 50, 26 + sOff); ctx.lineTo(ox + 49, 21 + sOff);
      ctx.moveTo(ox + 53, 26 + sOff); ctx.lineTo(ox + 54, 20 + sOff);
      ctx.stroke();
    }
    replaceSpritesheet(scene, 'furniture_bar_coffee_sheet', c, 80, 64);
  }

  // 8. Door / Industrial Elevator Portal (64x80)
  {
    const [c, ctx] = makeCanvas(64, 80);
    // Steel frame
    ctx.fillStyle = '#334155';
    ctx.fillRect(14, 14, 36, 60);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(14, 14, 36, 60);

    // Glass/Elevator doors with cyan glow
    const dGrad = ctx.createLinearGradient(18, 18, 46, 70);
    dGrad.addColorStop(0, '#0c4a6e');
    dGrad.addColorStop(1, '#082f49');
    ctx.fillStyle = dGrad;
    ctx.fillRect(18, 18, 28, 54);
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(32, 18); ctx.lineTo(32, 72);
    ctx.stroke();

    // Top indicator LED bar
    ctx.fillStyle = '#22d3ee';
    ctx.fillRect(24, 10, 16, 4);
    replaceTexture(scene, 'door_frame', c);
  }

  // 9. Cisco Catalyst 9300 Switch Rack (2 frames: 64x80 -> 128x80)
  {
    const [c, ctx] = makeCanvas(128, 80);
    for (let f = 0; f < 2; f++) {
      const ox = f * 64;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(ox + 14, 10, 36, 64);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(ox + 14, 10, 36, 64);

      // Rack units & animated LEDs
      for (let u = 0; u < 6; u++) {
        const uy = 15 + u * 9;
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(ox + 17, uy, 30, 7);
        ctx.fillStyle = (u + f) % 2 === 0 ? '#22c55e' : '#38bdf8';
        ctx.fillRect(ox + 19, uy + 2, 3, 3);
        ctx.fillStyle = u === 2 ? '#f59e0b' : '#22c55e';
        ctx.fillRect(ox + 24, uy + 2, 3, 3);
        ctx.fillStyle = '#475569';
        ctx.fillRect(ox + 30, uy + 2, 14, 3);
      }
    }
    replaceSpritesheet(scene, 'furniture_rack_sw1_sheet', c, 64, 80);
  }

  // 10. Datacenter 42U Server Rack (2 frames: 64x96 -> 128x96)
  {
    const [c, ctx] = makeCanvas(128, 96);
    for (let f = 0; f < 2; f++) {
      const ox = f * 64;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(ox + 14, 8, 36, 82);
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(ox + 14, 8, 36, 82);

      for (let u = 0; u < 8; u++) {
        const uy = 13 + u * 9;
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(ox + 17, uy, 30, 7);
        ctx.fillStyle = (u + f) % 2 === 0 ? '#22d3ee' : '#10b981';
        ctx.fillRect(ox + 19, uy + 2, 4, 3);
        ctx.fillStyle = u === 4 && f === 1 ? '#ef4444' : '#38bdf8';
        ctx.fillRect(ox + 25, uy + 2, 4, 3);
      }
    }
    replaceSpritesheet(scene, 'furniture_server_r1_sheet', c, 64, 96);
  }
}

export function registerVesuviusWindows(scene: Phaser.Scene): void {
  const sourceTex = scene.textures.get('vesuvius_panorama');
  const sourceImg = sourceTex?.getSourceImage() as HTMLImageElement | HTMLCanvasElement | undefined;
  if (!sourceImg) return;

  // Isometric West wall window: width 120px along slope -0.5, height 46px
  const winW = 120;
  const winH = 46;
  const canvasW = 132;
  const canvasH = 114;

  const phases: Array<{ key: string; overlay: string; frameColor: string }> = [
    { key: 'window_vesuvius_iso_morning', overlay: 'rgba(125, 211, 252, 0.28)', frameColor: '#38bdf8' },
    { key: 'window_vesuvius_iso_sunset', overlay: 'rgba(251, 146, 60, 0.14)', frameColor: '#f59e0b' },
    { key: 'window_vesuvius_iso_night', overlay: 'rgba(15, 23, 42, 0.52)', frameColor: '#6366f1' }
  ];

  phases.forEach(({ key, overlay, frameColor }) => {
    const [c, ctx] = makeCanvas(canvasW, canvasH);
    ctx.save();
    // Map rectangle (0..winW, 0..winH) onto isometric West wall (slope dy/dx = -0.5)
    ctx.transform(1, -0.5, 0, 1, 6, 64);

    // Outer metallic frame
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-3, -3, winW + 6, winH + 6);
    ctx.strokeStyle = frameColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-3, -3, winW + 6, winH + 6);

    // Scenic Vesuvius panorama inside window
    ctx.drawImage(sourceImg, 0, 0, winW, winH);
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, winW, winH);

    // Subtle glass reflection & 2 sleek vertical mullions
    const glass = ctx.createLinearGradient(0, 0, winW, winH);
    glass.addColorStop(0, 'rgba(255,255,255,0.18)');
    glass.addColorStop(0.4, 'rgba(255,255,255,0.03)');
    glass.addColorStop(1, 'rgba(56,189,248,0.08)');
    ctx.fillStyle = glass;
    ctx.fillRect(0, 0, winW, winH);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(winW / 3 - 1, 0, 2, winH);
    ctx.fillRect((2 * winW) / 3 - 1, 0, 2, winH);
    ctx.restore();

    replaceTexture(scene, key, c);
  });
}
