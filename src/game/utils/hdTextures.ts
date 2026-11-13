import Phaser from 'phaser';

export const HD_DENSITY = 3;
export const hdTextureKeys = new Set<string>();

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w * HD_DENSITY;
  c.height = h * HD_DENSITY;
  const ctx = c.getContext('2d')!;
  ctx.scale(HD_DENSITY, HD_DENSITY);
  return [c, ctx];
}

function replaceTexture(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement): void {
  if (scene.textures.exists(key)) {
    scene.textures.remove(key);
  }
  scene.textures.addCanvas(key, canvas);
  hdTextureKeys.add(key);
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
    frameWidth: frameWidth * HD_DENSITY,
    frameHeight: frameHeight * HD_DENSITY
  });
  hdTextureKeys.add(key);
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

  // Wall planes use the same +/- 1:2 slope as the room projection.
  // Shearing the face preserves vertical jambs, unlike rotating a flat sprite.
  for (const [key, slope] of [['door_frame', 0.5], ['door_frame_west', -0.5]] as const) {
    const [c, ctx] = makeCanvas(64, 104);
    ctx.save();
    ctx.transform(1, slope, 0, 1, 0, 14 - slope * 32);
    ctx.fillStyle = '#64777d'; ctx.fillRect(12, 8, 40, 68);
    ctx.fillStyle = '#c0c7bd'; ctx.fillRect(14, 10, 36, 64);
    const steel = ctx.createLinearGradient(18, 0, 46, 0);
    steel.addColorStop(0, '#536c74'); steel.addColorStop(0.45, '#9aacac');
    steel.addColorStop(0.5, '#536c74'); steel.addColorStop(1, '#849a9e');
    ctx.fillStyle = steel; ctx.fillRect(18, 18, 28, 54);
    ctx.strokeStyle = '#304a53'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(32, 18); ctx.lineTo(32, 72); ctx.stroke();
    ctx.fillStyle = '#18363c'; ctx.fillRect(24, 11, 16, 4);
    ctx.fillStyle = '#a8d3c3'; ctx.fillRect(30, 12, 4, 2);
    ctx.fillStyle = '#d3d5c6'; ctx.fillRect(16, 72, 32, 2);
    ctx.fillStyle = '#283e45'; ctx.fillRect(48, 40, 3, 7);
    ctx.fillStyle = '#e8c995'; ctx.fillRect(49, 42, 1, 1);
    ctx.restore();
    replaceTexture(scene, key, c);
  }

  // Dimensional equipment cabinets with glass doors, patch leads and rack rails.
  for (const [key, height, units] of [
    ['furniture_rack_sw1_sheet', 80, 6],
    ['furniture_server_r1_sheet', 96, 8]
  ] as const) {
    const [c, ctx] = makeCanvas(128, height);
    for (let f = 0; f < 2; f++) {
      ctx.save(); ctx.translate(f * 64, 0);
      const poly = (points:number[][], color:string) => {
        ctx.fillStyle=color; ctx.beginPath(); points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();
      };
      const topLeft = 14 * 0.78 + 11 * 0.5 - 3;
      const topRight = topLeft + 15;
      const bottomRight = (height - 7) * 0.78 + 41 * 0.5 - 3;
      poly([[11,topLeft],[24,topLeft-6.5],[54,topRight-6.5],[41,topRight]],'#71818c');
      poly([[41,topRight],[54,topRight-6.5],[54,bottomRight-6.5],[41,bottomRight]],'#253944');
      ctx.transform(1, 0.5, 0, 0.78, 0, -3);
      const metal=ctx.createLinearGradient(11,0,41,0);
      metal.addColorStop(0,'#344751');metal.addColorStop(.5,'#172b36');metal.addColorStop(1,'#3f5360');
      ctx.fillStyle=metal;ctx.fillRect(11,14,30,height-21);
      ctx.strokeStyle='#7f919a';ctx.lineWidth=.7;ctx.strokeRect(13,17,26,height-27);
      for(let u=0;u<units;u++) {
        const y=20+u*8;
        ctx.fillStyle=u===1?'#839295':'#3a4e59';ctx.fillRect(16,y,20,6);
        ctx.fillStyle='#0a1c25';
        for(let port=0;port<6;port++) ctx.fillRect(18+port*2.7,y+1,1.7,2);
        ctx.fillStyle=(u+f)%2?'#7fcba6':'#b3da9c';ctx.fillRect(17,y+4,1,1);
        ctx.strokeStyle=u%2?'#b9a36d':'#5d9fa7';ctx.lineWidth=.6;
        ctx.beginPath();ctx.moveTo(23,y+2);ctx.bezierCurveTo(38,y+2,35,y+11,29,y+10);ctx.stroke();
      }
      ctx.fillStyle='rgba(167,210,224,.08)';ctx.fillRect(14,18,24,height-29);
      ctx.strokeStyle='rgba(208,233,239,.28)';ctx.beginPath();ctx.moveTo(15,19);ctx.lineTo(34,height-16);ctx.stroke();
      ctx.fillStyle='#a8b6b7';ctx.fillRect(37,42,1.5,9);
      ctx.fillStyle='#182933';ctx.fillRect(13,height-8,5,3);ctx.fillRect(36,height-8,5,3);
      ctx.restore();
    }
    replaceSpritesheet(scene,key,c,64,height);
  }

}

export function registerVesuviusWindows(scene: Phaser.Scene): void {

  // Isometric West wall window: width 120px along slope -0.5, height 46px
  const winW = 190;
  const winH = 66;
  const canvasW = 206;
  const canvasH = 174;

  const phases: Array<{ key: string; overlay: string; frameColor: string }> = [
    { key: 'window_vesuvius_iso_morning', overlay: 'rgba(125, 211, 252, 0.28)', frameColor: '#b8aa8c' },
    { key: 'window_vesuvius_iso_sunset', overlay: 'rgba(251, 146, 60, 0.14)', frameColor: '#f59e0b' },
    { key: 'window_vesuvius_iso_night', overlay: 'rgba(15, 23, 42, 0.52)', frameColor: '#6366f1' }
  ];

  phases.forEach(({ key, overlay, frameColor }) => {
    const [c, ctx] = makeCanvas(canvasW, canvasH);
    ctx.save();
    // Map rectangle (0..winW, 0..winH) onto isometric West wall (slope dy/dx = -0.5)
    ctx.transform(1, -0.5, 0, 1, 8, 102);

    // Outer metallic frame
    ctx.fillStyle = '#646d66';
    ctx.fillRect(-3, -3, winW + 6, winH + 6);
    ctx.strokeStyle = frameColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-3, -3, winW + 6, winH + 6);

    // Scenic Vesuvius panorama inside window
    const gulf = scene.textures.get('gulf-naples-hd').getSourceImage() as HTMLImageElement;
    ctx.drawImage(gulf, 0, 0, winW, winH);
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
