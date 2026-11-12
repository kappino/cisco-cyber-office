import { GRID_SIZE, TILE_W, TILE_H, ORIGIN_Y, TilePos, gridToScreen } from './isoMath';

// --- Procedural Rendering Constants (Zero Heap Allocation) ---
const COLOR_STEAM = '#fef3c7';
const COLOR_PARQUET_LIGHT = '#b45309';
const COLOR_PARQUET_DARK = '#92400e';
const COLOR_PARQUET_STROKE = '#78350f';
const COLOR_RUG_LIGHT = '#0284c7';
const COLOR_RUG_DARK = '#0369a1';
const COLOR_RUG_STROKE = '#075985';
const COLOR_SUNSET_SHEEN = '#fb923c';
const COLOR_SUNSET_GLINT = '#fef08a';
const COLOR_TARGET_FILL = 'rgba(254, 240, 138, 0.5)';
const COLOR_TARGET_STROKE = '#f59e0b';

const COLOR_VAULT_SLATE_1 = '#1e293b';
const COLOR_VAULT_SLATE_2 = '#151d2f';
const COLOR_VAULT_AISLE_1 = '#1e293b';
const COLOR_VAULT_AISLE_2 = '#0f172a';
const COLOR_VAULT_STROKE_DEF = '#090d16';
const COLOR_VAULT_STROKE_AISLE = '#0284c7';
const COLOR_VAULT_STROKE_PULSE = '#38bdf8';
const COLOR_CYAN_GLOW = '#38bdf8';
const COLOR_COOL_MIST = '#bae6fd';
const COLOR_TARGET_CYAN = 'rgba(56, 189, 248, 0.4)';
const PI2 = Math.PI * 2;

// Static Cisco IOS CLI command feed for Admin Desk Left Monitor
const CISCO_IOS_CLI_LINES = [
  'Switch#',
  'sh ip ro',
  '10.1.0.0',
  'conf t',
  'vlan 20',
  'name SEC',
  'int g0/1',
  'sw mode acc',
  'no shut',
  'wr mem',
  '[OK] Commit'
];

// Static Threat Feeds for SOC Threat Wall Right Section
const SOC_THREAT_FEEDS = [
  'DNS:bad-c2.sink',
  'DST:185.220.101',
  'BLOCKED:C2_BEACON',
  'FLOW: 2.4 Gbps',
  'MITRE:T1071.004',
  'SRC:192.168.1.10',
  'ACL:DENY TCP 443',
  'STATUS:MITIGATED'
];

// Precomputed blip coordinates & angles for SOC Threat Wall Radar
const SOC_BLIP_DX = [-5, 7, -3];
const SOC_BLIP_DY = [-6, 3, 7];
const SOC_BLIP_ANGLES = [
  Math.atan2(-6, -5), // -2.265 rad
  Math.atan2(3, 7),   //  0.405 rad
  Math.atan2(7, -3)   //  1.976 rad
];
const SOC_BLIP_COLORS_ALERT = [
  'rgba(239, 68, 68, 0.2)',
  'rgba(239, 68, 68, 0.5)',
  'rgba(239, 68, 68, 0.8)',
  'rgba(239, 68, 68, 1.0)'
];
const SOC_BLIP_COLORS_SAFE = [
  'rgba(52, 211, 153, 0.2)',
  'rgba(52, 211, 153, 0.5)',
  'rgba(52, 211, 153, 0.8)',
  'rgba(52, 211, 153, 1.0)'
];

// Static Hex Dump Lines for Wireshark DPI Console
const WIRESHARK_HEX_LINES = [
  '00: 45 00 00 3C',
  '08: 1C 9F 40 00',
  '10: 40 06 B1 E6',
  '18: C0 A8 01 69',
  '20: B9 DC 65 05',
  '28: 01 BB C0 31',
  '30: 53 45 43 55',
  '38: 7F FF 08 00',
  '40: 62 61 64 2D',
  '48: 63 32 2E 73'
];

/**
 * Procedural rising steam plume with zero heap allocations per frame.
 * @param ctx 2D Canvas context
 * @param sx Source X coordinate (origin of steam)
 * @param sy Source Y coordinate (top of cup/vent)
 * @param frame Monotonic animation frame counter
 * @param count Number of staggered steam particles (default: 6)
 */
export const drawSteamPlume = (
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  frame: number,
  count = 6
) => {
  ctx.save();
  ctx.fillStyle = COLOR_STEAM;
  for (let i = 0; i < count; i++) {
    // Phase-shifted particle lifecycle [0, 1)
    const t = ((frame * 0.4 + i * (60 / count)) % 60) / 60;
    const y = sy - t * 24;
    const x = sx + Math.sin(frame * 0.08 + i * 1.5) * (2 + t * 4);
    const r = 1.2 + t * 3.2;
    // Dissipates to 0 as it ascends
    const alpha = (1 - t) * 0.42;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, PI2);
    ctx.fill();
  }
  ctx.restore();
};

// 1. Warm Exposed Terracotta Brick Walls with Arched Panoramic Naples Window
export const drawWarmHabboWalls = (ctx: CanvasRenderingContext2D, canvasW: number, frame: number) => {
  const origin = gridToScreen(0, 0, canvasW);
  const wallH = 190;
  const wallThick = 12;

  const leftEnd = gridToScreen(0, GRID_SIZE, canvasW);
  const rightEnd = gridToScreen(GRID_SIZE, 0, canvasW);

  // --- LEFT WALL (Warm Terracotta Brick / Side Incline) ---
  ctx.beginPath();
  ctx.moveTo(origin.x, origin.y);
  ctx.lineTo(origin.x, origin.y - wallH);
  ctx.lineTo(leftEnd.x, leftEnd.y - wallH);
  ctx.lineTo(leftEnd.x, leftEnd.y);
  ctx.closePath();
  ctx.fillStyle = '#7c2d12';
  ctx.fill();
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Subtle Brick texture lines on left wall
  ctx.strokeStyle = '#9a3412';
  ctx.lineWidth = 1;
  for (let h = 20; h < wallH - 10; h += 22) {
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y - h);
    ctx.lineTo(leftEnd.x, leftEnd.y - h);
    ctx.stroke();
  }

  // Left Wall Top Thickness Cap (Polished Light Stone)
  ctx.beginPath();
  ctx.moveTo(origin.x, origin.y - wallH);
  ctx.lineTo(origin.x - wallThick * 0.7, origin.y - wallH - wallThick * 0.5);
  ctx.lineTo(leftEnd.x - wallThick * 0.7, leftEnd.y - wallH - wallThick * 0.5);
  ctx.lineTo(leftEnd.x, leftEnd.y - wallH);
  ctx.closePath();
  ctx.fillStyle = '#cbd5e1';
  ctx.fill();
  ctx.strokeStyle = '#475569';
  ctx.stroke();

  // Warm Baseboard (Battiscopa)
  ctx.beginPath();
  ctx.moveTo(origin.x, origin.y);
  ctx.lineTo(origin.x, origin.y - 12);
  ctx.lineTo(leftEnd.x, leftEnd.y - 12);
  ctx.lineTo(leftEnd.x, leftEnd.y);
  ctx.closePath();
  ctx.fillStyle = '#451a03';
  ctx.fill();

  // --- EMBEDDED PANORAMIC WINDOW OF GOLFO DI NAPOLI & VESUVIO ---
  const winT1 = 1.0;
  const winT2 = 6.2;
  const pWinTop1 = gridToScreen(0, winT1, canvasW);
  const pWinTop2 = gridToScreen(0, winT2, canvasW);

  const winH = 124;
  const winBaseY = pWinTop1.y - 28;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pWinTop1.x + 8, winBaseY - winH);
  ctx.lineTo(pWinTop2.x + 8, pWinTop2.y - 28 - winH);
  ctx.lineTo(pWinTop2.x + 8, pWinTop2.y - 28);
  ctx.lineTo(pWinTop1.x + 8, winBaseY);
  ctx.closePath();
  ctx.clip();

  // A) Sunset Sky Gradient
  const skyGrad = ctx.createLinearGradient(pWinTop1.x, winBaseY - winH, pWinTop1.x, winBaseY);
  skyGrad.addColorStop(0, '#311042');
  skyGrad.addColorStop(0.3, '#701a75');
  skyGrad.addColorStop(0.65, '#f97316');
  skyGrad.addColorStop(0.88, '#fde047');
  skyGrad.addColorStop(1, '#0284c7');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(pWinTop2.x - 20, winBaseY - winH - 20, Math.abs(pWinTop1.x - pWinTop2.x) + 40, winH + 40);

  // B) Glowing Setting Sun
  const sunX = (pWinTop1.x + pWinTop2.x) * 0.44;
  const sunY = winBaseY - 36;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 20, 0, Math.PI * 2);
  ctx.fillStyle = '#fef08a';
  ctx.shadowColor = '#fb923c';
  ctx.shadowBlur = 24;
  ctx.fill();
  ctx.shadowBlur = 0;

  // C) Mount Vesuvius (Il Vesuvio - Grand Double Caldera)
  const midWinX = (pWinTop1.x + pWinTop2.x) * 0.56;
  const midWinY = (winBaseY + pWinTop2.y - 28) * 0.5;

  ctx.beginPath();
  ctx.moveTo(pWinTop2.x - 10, midWinY + 14);
  ctx.lineTo(midWinX - 60, midWinY - 14);
  ctx.lineTo(midWinX - 42, midWinY - 8);
  ctx.lineTo(midWinX - 16, midWinY - 26);
  ctx.lineTo(midWinX + 12, midWinY - 25);
  ctx.lineTo(pWinTop1.x + 20, midWinY + 22);
  ctx.lineTo(pWinTop1.x + 20, midWinY + 45);
  ctx.lineTo(pWinTop2.x - 10, midWinY + 45);
  ctx.closePath();
  ctx.fillStyle = '#4a044e';
  ctx.fill();

  // Animated Smoke Plume
  const smokeY = (frame * 0.25) % 28;
  ctx.beginPath();
  ctx.ellipse(midWinX - 2, midWinY - 30 - smokeY * 0.4, 7 + smokeY * 0.2, 4, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(254, 240, 138, 0.45)';
  ctx.fill();

  // D) Gulf of Naples Blue Sea
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(pWinTop2.x - 20, midWinY + 12, Math.abs(pWinTop1.x - pWinTop2.x) + 40, 48);

  // Golden reflections on the water
  for (let r = 0; r < 6; r++) {
    const rw = 32 - r * 4 + Math.sin(frame * 0.08 + r) * 6;
    ctx.fillStyle = 'rgba(254, 240, 138, 0.6)';
    ctx.fillRect(sunX - rw / 2, midWinY + 16 + r * 5, rw, 2.5);
  }

  // E) Coastline of Posillipo & Castel dell'Ovo
  ctx.fillStyle = '#1e1b4b';
  ctx.beginPath();
  ctx.moveTo(pWinTop1.x, midWinY + 18);
  ctx.lineTo(pWinTop1.x + 40, midWinY + 15);
  ctx.lineTo(pWinTop1.x + 40, midWinY + 45);
  ctx.lineTo(pWinTop1.x, midWinY + 45);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(pWinTop1.x + 12, midWinY + 11, 14, 7);

  ctx.restore();

  // Window Cast-Iron Frame & Panes
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(pWinTop1.x + 8, winBaseY - winH);
  ctx.lineTo(pWinTop2.x + 8, pWinTop2.y - 28 - winH);
  ctx.lineTo(pWinTop2.x + 8, pWinTop2.y - 28);
  ctx.lineTo(pWinTop1.x + 8, winBaseY);
  ctx.closePath();
  ctx.stroke();

  // Dividers
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#475569';
  const splitX = (pWinTop1.x + pWinTop2.x) * 0.5 + 8;
  const splitY1 = (winBaseY - winH + pWinTop2.y - 28 - winH) * 0.5;
  const splitY2 = (winBaseY + pWinTop2.y - 28) * 0.5;
  ctx.beginPath();
  ctx.moveTo(splitX, splitY1);
  ctx.lineTo(splitX, splitY2);
  ctx.stroke();

  // --- RIGHT WALL (Bright Loft Wall with Posters) ---
  ctx.beginPath();
  ctx.moveTo(origin.x, origin.y);
  ctx.lineTo(origin.x, origin.y - wallH);
  ctx.lineTo(rightEnd.x, rightEnd.y - wallH);
  ctx.lineTo(rightEnd.x, rightEnd.y);
  ctx.closePath();
  ctx.fillStyle = '#9a3412';
  ctx.fill();
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Right Wall Top Cap
  ctx.beginPath();
  ctx.moveTo(origin.x, origin.y - wallH);
  ctx.lineTo(origin.x + wallThick * 0.7, origin.y - wallH - wallThick * 0.5);
  ctx.lineTo(rightEnd.x + wallThick * 0.7, rightEnd.y - wallH - wallThick * 0.5);
  ctx.lineTo(rightEnd.x, rightEnd.y - wallH);
  ctx.closePath();
  ctx.fillStyle = '#e2e8f0';
  ctx.fill();
  ctx.stroke();

  // Right Wall Baseboard
  ctx.beginPath();
  ctx.moveTo(origin.x, origin.y);
  ctx.lineTo(origin.x, origin.y - 12);
  ctx.lineTo(rightEnd.x, rightEnd.y - 12);
  ctx.lineTo(rightEnd.x, rightEnd.y);
  ctx.closePath();
  ctx.fillStyle = '#451a03';
  ctx.fill();

  // --- POSTER 1: SSC Napoli Scudetto & Cornetto ---
  const posNap = gridToScreen(2.8, 0, canvasW);
  ctx.save();
  ctx.translate(posNap.x - 22, posNap.y - 110);
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(0, 0, 44, 54);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(0, 0, 44, 54);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', 22, 38);
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.moveTo(36, 4);
  ctx.quadraticCurveTo(46, 18, 38, 28);
  ctx.lineTo(34, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // --- POSTER 2: "Futuro Remoto 2026 - Città della Scienza" ---
  const posFut = gridToScreen(5.8, 0, canvasW);
  ctx.save();
  ctx.translate(posFut.x - 26, posFut.y - 115);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 56, 40);
  ctx.strokeStyle = '#00bceb';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, 56, 40);
  ctx.fillStyle = '#00bceb';
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('FUTURO REMOTO', 28, 14);
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 7px monospace';
  ctx.fillText('BIG HACK 2026', 28, 24);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '6px monospace';
  ctx.fillText('Città della Scienza', 28, 33);
  ctx.restore();
};

// 2. Warm Parquet Floor with Cisco Blue Carpet in Center & Sunset Specular Sheen
export const drawWarmParquetFloor = (
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  tgt: TilePos | null,
  frame: number = 0
) => {
  const originX = canvasW * 0.5;
  const halfW = TILE_W * 0.5; // 48
  const halfH = TILE_H * 0.5; // 24

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      // Inlined projection: zero heap allocation
      const ptX = (c - r) * halfW + originX;
      const ptY = (c + r) * halfH + ORIGIN_Y;
      const isAlternate = (c + r) % 2 === 0;

      ctx.beginPath();
      ctx.moveTo(ptX, ptY);
      ctx.lineTo(ptX + halfW, ptY + halfH);
      ctx.lineTo(ptX, ptY + TILE_H);
      ctx.lineTo(ptX - halfW, ptY + halfH);
      ctx.closePath();

      const isRug = c >= 3 && c <= 5 && r >= 3 && r <= 5;

      if (isRug) {
        ctx.fillStyle = isAlternate ? COLOR_RUG_DARK : COLOR_RUG_LIGHT;
        ctx.fill();
        ctx.strokeStyle = COLOR_RUG_STROKE;
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.fillStyle = isAlternate ? COLOR_PARQUET_LIGHT : COLOR_PARQUET_DARK;
        ctx.fill();
        ctx.strokeStyle = COLOR_PARQUET_STROKE;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // --- SUNSET SPECULAR SHEEN & REFLECTIONS FROM PANORAMIC NAPLES WINDOW ---
      // Window is on left wall (gx = 0, gy: 1.0..6.2). Golden light casts across corridor c: 0..5, r: 1..6.
      if (c <= 5 && r >= 1 && r <= 6) {
        const beamDist = Math.abs((r - 3.2) - c * 0.3);
        if (beamDist < 3.2) {
          const falloff = (1 - c / 6.5) * (1 - beamDist / 3.2);
          const shimmer = Math.sin(frame * 0.04 + c * 0.7 + r * 0.5) * 0.04;
          const sheenAlpha = Math.max(0, Math.min(0.26, falloff * 0.22 + shimmer));

          if (sheenAlpha > 0.015) {
            // Warm golden specular sheen fill
            ctx.fillStyle = COLOR_SUNSET_SHEEN;
            ctx.globalAlpha = sheenAlpha;
            ctx.fill();

            // Specular varnish glint on tile top-left facet facing panoramic window
            ctx.strokeStyle = COLOR_SUNSET_GLINT;
            ctx.lineWidth = 1.2;
            ctx.globalAlpha = sheenAlpha * 1.6;
            ctx.beginPath();
            ctx.moveTo(ptX - halfW, ptY + halfH);
            ctx.lineTo(ptX, ptY);
            ctx.stroke();

            // Reset alpha
            ctx.globalAlpha = 1.0;
          }
        }
      }

      if (tgt && Math.round(tgt.x) === c && Math.round(tgt.y) === r) {
        ctx.fillStyle = COLOR_TARGET_FILL;
        ctx.fill();
        ctx.strokeStyle = COLOR_TARGET_STROKE;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    }
  }
};

// 3. Warm Sunbeams pouring from window
export const drawSunlightBeams = (ctx: CanvasRenderingContext2D, canvasW: number) => {
  const pWin = gridToScreen(0, 3, canvasW);
  const pFloor = gridToScreen(3.5, 4.5, canvasW);

  ctx.save();
  const beamGrad = ctx.createLinearGradient(pWin.x, pWin.y - 80, pFloor.x, pFloor.y);
  beamGrad.addColorStop(0, 'rgba(254, 215, 170, 0.28)');
  beamGrad.addColorStop(0.6, 'rgba(251, 146, 60, 0.15)');
  beamGrad.addColorStop(1, 'rgba(251, 146, 60, 0)');

  ctx.beginPath();
  ctx.moveTo(pWin.x - 50, pWin.y - 65);
  ctx.lineTo(pWin.x + 50, pWin.y - 35);
  ctx.lineTo(pFloor.x + 90, pFloor.y + 40);
  ctx.lineTo(pFloor.x - 90, pFloor.y + 20);
  ctx.closePath();
  ctx.fillStyle = beamGrad;
  ctx.fill();
  ctx.restore();
};

// 4. Chunky 3D Server Rack (Catalyst 9300)
export const drawChunkyServerRack = (
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  canvasW: number,
  done: boolean,
  frame: number
) => {
  const pt = gridToScreen(gx, gy, canvasW);
  const w = 56;
  const h = 105;
  const rx = pt.x - w / 2;
  const ry = pt.y - h + 18;

  ctx.beginPath();
  ctx.ellipse(pt.x, pt.y + 14, 34, 12, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(rx, ry, w, h);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.strokeRect(rx, ry, w, h);

  ctx.fillStyle = '#020617';
  ctx.fillRect(rx + 4, ry + 4, w - 8, h - 8);

  for (let i = 0; i < 5; i++) {
    const uy = ry + 8 + i * 18;
    ctx.fillStyle = i === 2 ? '#00bceb' : '#1e293b';
    ctx.fillRect(rx + 6, uy, w - 12, 13);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    ctx.strokeRect(rx + 6, uy, w - 12, 13);

    const isGreen = done || (i % 2 === 0 ? frame % 28 < 16 : frame % 36 < 20);
    ctx.fillStyle = isGreen ? '#10b981' : '#f59e0b';
    ctx.fillRect(rx + 9, uy + 4, 3, 3);
    ctx.fillRect(rx + 15, uy + 4, 3, 3);
    ctx.fillRect(rx + 21, uy + 4, 3, 3);
    ctx.fillRect(rx + 27, uy + 4, 3, 3);
  }

  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#00bceb';
  ctx.beginPath();
  ctx.moveTo(rx + 14, ry + 26);
  ctx.bezierCurveTo(rx + 4, ry + 44, rx + 18, ry + 58, rx + 14, ry + 66);
  ctx.stroke();

  ctx.strokeStyle = '#f59e0b';
  ctx.beginPath();
  ctx.moveTo(rx + 32, ry + 26);
  ctx.bezierCurveTo(rx + 42, ry + 42, rx + 26, ry + 58, rx + 30, ry + 66);
  ctx.stroke();

  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.moveTo(rx + w - 2, ry + 12);
  ctx.quadraticCurveTo(rx + w + 8, ry + 22, rx + w + 1, ry + 32);
  ctx.lineTo(rx + w - 3, ry + 16);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.beginPath();
  ctx.moveTo(rx + 4, ry + 4);
  ctx.lineTo(rx + 24, ry + 4);
  ctx.lineTo(rx + 4, ry + h - 8);
  ctx.closePath();
  ctx.fill();

  const badgeY = ry - 14;
  ctx.beginPath();
  ctx.arc(pt.x, badgeY, 13, 0, Math.PI * 2);
  ctx.fillStyle = done ? '#052e16' : '#451a03';
  ctx.fill();
  ctx.strokeStyle = done ? '#10b981' : '#f59e0b';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = done ? '#34d399' : '#fbbf24';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(done ? '✓' : '!', pt.x, badgeY + 4);
};

// 5. Chunky Admin Workstation Desk (Dual Animated Monitors + Blinking Cursor + Packet Tracer + Steaming Mug)
export const drawChunkyAdminDesk = (
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  canvasW: number,
  done: boolean,
  frame: number = 0
) => {
  const pt = gridToScreen(gx, gy, canvasW);
  const dw = 76;
  const dh = 40;
  const dx = pt.x - dw / 2;
  const dy = pt.y - 20;

  // Desk shadow on floor
  ctx.beginPath();
  ctx.ellipse(pt.x, pt.y + 16, 46, 16, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fill();

  // Wooden desk surface
  ctx.fillStyle = '#78350f';
  ctx.fillRect(dx, dy, dw, dh);
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 2;
  ctx.strokeRect(dx, dy, dw, dh);

  // Desk front edge & metallic legs
  ctx.fillStyle = '#451a03';
  ctx.fillRect(dx, dy + dh, dw, 7);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(dx + 2, dy + dh + 7, 4, 14);
  ctx.fillRect(dx + dw - 6, dy + dh + 7, 4, 14);

  // -------------------------------------------------------------
  // LEFT MONITOR: Cisco IOS CLI Terminal (Scrolling Text + Cursor)
  // -------------------------------------------------------------
  const lmX = dx + 6;
  const lmY = dy - 32;
  const lmW = 30;
  const lmH = 26;

  // Bezel & Stand
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(lmX, lmY, lmW, lmH);
  ctx.fillRect(lmX + 12, lmY + lmH, 6, 6); // stand neck
  ctx.fillRect(lmX + 8, lmY + lmH + 4, 14, 2); // stand base

  // CRT Phosphor Display
  const scrX = lmX + 2;
  const scrY = lmY + 2;
  const scrW = lmW - 4; // 26px
  const scrH = lmH - 4; // 22px
  ctx.fillStyle = '#021a0d';
  ctx.fillRect(scrX, scrY, scrW, scrH);

  // Clip to inner monitor screen
  ctx.save();
  ctx.beginPath();
  ctx.rect(scrX, scrY, scrW, scrH);
  ctx.clip();

  // Scrolling CLI lines
  const cliStep = Math.floor(frame / 36);
  const l1Idx = cliStep % CISCO_IOS_CLI_LINES.length;
  const l2Idx = (cliStep + 1) % CISCO_IOS_CLI_LINES.length;
  const l3Idx = (cliStep + 2) % CISCO_IOS_CLI_LINES.length;

  ctx.font = '5px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = done ? '#34d399' : '#10b981';
  ctx.fillText(CISCO_IOS_CLI_LINES[l1Idx], scrX + 2, scrY + 6);
  ctx.fillText(CISCO_IOS_CLI_LINES[l2Idx], scrX + 2, scrY + 12);
  ctx.fillText(CISCO_IOS_CLI_LINES[l3Idx], scrX + 2, scrY + 18);

  // Blinking Block Cursor
  const cursorBlink = (frame % 30) < 15;
  if (cursorBlink) {
    ctx.fillStyle = done ? '#34d399' : '#10b981';
    ctx.fillRect(scrX + 22, scrY + 14, 2.5, 4);
  }

  // CRT Scanlines
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  for (let sy = scrY; sy < scrY + scrH; sy += 2) {
    ctx.fillRect(scrX, sy, scrW, 1);
  }
  ctx.restore();

  // -------------------------------------------------------------
  // RIGHT MONITOR: Packet Tracer Live Topology & Moving Packets
  // -------------------------------------------------------------
  const rmX = dx + 40;
  const rmY = dy - 32;
  const rmW = 30;
  const rmH = 26;

  // Bezel & Stand
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(rmX, rmY, rmW, rmH);
  ctx.fillRect(rmX + 12, rmY + rmH, 6, 6);
  ctx.fillRect(rmX + 8, rmY + rmH + 4, 14, 2);

  // Screen
  const rScrX = rmX + 2;
  const rScrY = rmY + 2;
  const rScrW = rmW - 4;
  const rScrH = rmH - 4;
  ctx.fillStyle = '#041628';
  ctx.fillRect(rScrX, rScrY, rScrW, rScrH);

  ctx.save();
  ctx.beginPath();
  ctx.rect(rScrX, rScrY, rScrW, rScrH);
  ctx.clip();

  // Workspace Grid
  ctx.strokeStyle = 'rgba(14, 165, 233, 0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(rScrX + 8, rScrY); ctx.lineTo(rScrX + 8, rScrY + rScrH);
  ctx.moveTo(rScrX + 17, rScrY); ctx.lineTo(rScrX + 17, rScrY + rScrH);
  ctx.moveTo(rScrX, rScrY + 7); ctx.lineTo(rScrX + rScrW, rScrY + 7);
  ctx.moveTo(rScrX, rScrY + 14); ctx.lineTo(rScrX + rScrW, rScrY + 14);
  ctx.stroke();

  // Topology Nodes (Relative to rScrX, rScrY)
  // n0: Router (13, 5), n1: Sw1 (6, 16), n2: Sw2 (20, 16), n3: Server (21, 6)
  const n0x = rScrX + 13, n0y = rScrY + 5;
  const n1x = rScrX + 6,  n1y = rScrY + 16;
  const n2x = rScrX + 20, n2y = rScrY + 16;
  const n3x = rScrX + 21, n3y = rScrY + 6;

  // Network Links
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(n0x, n0y); ctx.lineTo(n1x, n1y); // Router -> Sw1
  ctx.moveTo(n0x, n0y); ctx.lineTo(n2x, n2y); // Router -> Sw2
  ctx.moveTo(n1x, n1y); ctx.lineTo(n2x, n2y); // Sw1 <-> Sw2 Trunk
  ctx.moveTo(n0x, n0y); ctx.lineTo(n3x, n3y); // Router -> Server
  ctx.stroke();

  // Live Pulsating Packets (Pure parametric linear interpolation)
  const t1 = (frame * 0.04) % 1.0;
  const t2 = (frame * 0.04 + 0.5) % 1.0;
  const t3 = (frame * 0.05 + 0.25) % 1.0;

  ctx.fillStyle = done ? '#34d399' : '#fef08a';
  // Packet 1: Router -> Sw1
  ctx.fillRect(n0x + (n1x - n0x) * t1 - 1, n0y + (n1y - n0y) * t1 - 1, 2, 2);
  // Packet 2: Router -> Sw2
  ctx.fillRect(n0x + (n2x - n0x) * t2 - 1, n0y + (n2y - n0y) * t2 - 1, 2, 2);
  // Packet 3: Sw1 -> Sw2 Trunk
  ctx.fillRect(n1x + (n2x - n1x) * t3 - 1, n1y - 1, 2, 2);

  // Router Core Node with Halo Pulse
  const haloR = 2.5 + Math.sin(frame * 0.15) * 1.2;
  ctx.strokeStyle = done ? 'rgba(52, 211, 153, 0.6)' : 'rgba(56, 189, 248, 0.6)';
  ctx.beginPath();
  ctx.arc(n0x, n0y, haloR, 0, Math.PI * 2);
  ctx.stroke();

  // Device Icons
  ctx.fillStyle = '#38bdf8'; // Router
  ctx.beginPath(); ctx.arc(n0x, n0y, 2.5, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#10b981'; // Switches
  ctx.fillRect(n1x - 2, n1y - 1.5, 4, 3);
  ctx.fillRect(n2x - 2, n2y - 1.5, 4, 3);

  ctx.fillStyle = '#a855f7'; // Server
  ctx.fillRect(n3x - 1.5, n3y - 2, 3, 4);

  // Scanlines on Right Screen
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  for (let sy = rScrY; sy < rScrY + rScrH; sy += 2) {
    ctx.fillRect(rScrX, sy, rScrW, 1);
  }
  ctx.restore();

  // Keyboard & Mouse
  ctx.fillStyle = '#334155';
  ctx.fillRect(dx + 22, dy + 14, 30, 10);
  ctx.fillStyle = '#64748b';
  ctx.fillRect(dx + 56, dy + 15, 6, 8);

  // Steaming Espresso Ceramic Cup with Handle & Crema
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(dx + 8, dy + 12, 8, 10);
  ctx.fillStyle = '#3e1c00'; // rich espresso crema
  ctx.fillRect(dx + 9, dy + 12, 6, 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(dx + 15, dy + 14, 2, 5);

  // Procedural rising steam plume from cup
  drawSteamPlume(ctx, dx + 12, dy + 10, frame, 5);

  // Ergonomic Chair
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(pt.x, pt.y + 24, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#475569';
  ctx.stroke();

  // Quest Status Badge
  const badgeY = dy - 44;
  ctx.beginPath();
  ctx.arc(pt.x, badgeY, 13, 0, Math.PI * 2);
  ctx.fillStyle = done ? '#052e16' : '#451a03';
  ctx.fill();
  ctx.strokeStyle = done ? '#10b981' : '#f59e0b';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = done ? '#34d399' : '#fbbf24';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(done ? '✓' : '!', pt.x, badgeY + 4);
};

// 6. Chunky SOC Threat Wall (Radar Sweep + Threat Blips + Live Neon Bar Graph + Threat Feed)
export const drawChunkySocWall = (
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  canvasW: number,
  done: boolean,
  frame: number
) => {
  const pt = gridToScreen(gx, gy, canvasW);
  const sw = 78;
  const sh = 52;
  const sx = pt.x - sw / 2;
  const sy = pt.y - sh - 6;

  // Base shadow & stand
  ctx.beginPath();
  ctx.ellipse(pt.x, pt.y + 14, 36, 12, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fill();

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(pt.x - 16, pt.y + 2, 32, 6);
  ctx.fillStyle = '#475569';
  ctx.fillRect(pt.x - 4, pt.y - 12, 8, 16);

  // Heavy Display Chassis
  ctx.fillStyle = '#020617';
  ctx.fillRect(sx, sy, sw, sh);

  // Bezel Border with Threat Alert Pulse
  const alertBorder = !done && ((frame % 20) < 10);
  ctx.strokeStyle = done ? '#38bdf8' : (alertBorder ? '#ef4444' : '#991b1b');
  ctx.lineWidth = 2.5;
  ctx.strokeRect(sx, sy, sw, sh);

  // Inner Screen
  const scrX = sx + 3;
  const scrY = sy + 3;
  const scrW = sw - 6; // 72px
  const scrH = sh - 6; // 46px
  ctx.fillStyle = '#051024';
  ctx.fillRect(scrX, scrY, scrW, scrH);

  ctx.save();
  ctx.beginPath();
  ctx.rect(scrX, scrY, scrW, scrH);
  ctx.clip();

  // Top Header: Title & Blinking Status Dot
  ctx.font = 'bold 5.5px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = done ? '#38bdf8' : '#f87171';
  ctx.fillText('CISCO SOC THREAT', scrX + 2, scrY + 7);

  const socLedBlink = (frame % 24) < 12;
  ctx.fillStyle = done ? '#10b981' : (socLedBlink ? '#ef4444' : '#7f1d1d');
  ctx.beginPath();
  ctx.arc(scrX + scrW - 4, scrY + 5, 2, 0, Math.PI * 2);
  ctx.fill();

  // -------------------------------------------------------------
  // LEFT: Rotating Radar Scope with Decaying Threat Blips
  // -------------------------------------------------------------
  const rcx = scrX + 16;
  const rcy = scrY + 23;
  const radR = 12;

  // Radar Range Rings & Crosshairs
  ctx.strokeStyle = done ? 'rgba(56, 189, 248, 0.35)' : 'rgba(239, 68, 68, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(rcx, rcy, radR, 0, Math.PI * 2);
  ctx.arc(rcx, rcy, 6, 0, Math.PI * 2);
  ctx.moveTo(rcx - radR, rcy); ctx.lineTo(rcx + radR, rcy);
  ctx.moveTo(rcx, rcy - radR); ctx.lineTo(rcx, rcy + radR);
  ctx.stroke();

  // Rotating Radar Sweep Beam
  const rAngle = (frame * 0.05) % (Math.PI * 2);
  ctx.strokeStyle = done ? '#38bdf8' : '#ef4444';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(rcx, rcy);
  ctx.lineTo(rcx + Math.cos(rAngle) * radR, rcy + Math.sin(rAngle) * radR);
  ctx.stroke();

  // Sweep Phosphor Decay Wedge
  ctx.fillStyle = done ? 'rgba(56, 189, 248, 0.12)' : 'rgba(239, 68, 68, 0.12)';
  ctx.beginPath();
  ctx.moveTo(rcx, rcy);
  ctx.arc(rcx, rcy, radR, rAngle - 0.45, rAngle);
  ctx.closePath();
  ctx.fill();

  // Threat Blips (Fade out as radar beam sweeps past)
  for (let b = 0; b < 3; b++) {
    const diff = ((rAngle - SOC_BLIP_ANGLES[b]) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    if (diff < 1.4) {
      const alphaStep = Math.min(3, Math.floor((1 - diff / 1.4) * 4));
      ctx.fillStyle = done ? SOC_BLIP_COLORS_SAFE[alphaStep] : SOC_BLIP_COLORS_ALERT[alphaStep];
      ctx.beginPath();
      ctx.arc(rcx + SOC_BLIP_DX[b], rcy + SOC_BLIP_DY[b], 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // -------------------------------------------------------------
  // RIGHT TOP: Live Neon Network Traffic Bar Graph (Equalizer)
  // -------------------------------------------------------------
  const barBaseX = scrX + 34;
  const barBaseY = scrY + 22;
  for (let b = 0; b < 6; b++) {
    const bx = barBaseX + b * 6;
    const barVal = 3 + Math.sin(frame * 0.14 + b * 1.3) * 3 + Math.sin(frame * 0.28 + b * 2.5) * 2;
    const bh = Math.max(2, Math.min(10, barVal));

    ctx.fillStyle = done ? '#06b6d4' : (b >= 4 ? '#ef4444' : '#f59e0b');
    ctx.fillRect(bx, barBaseY - bh, 4, bh);
    // Neon Peak Cap
    ctx.fillStyle = done ? '#a5f3fc' : '#fef08a';
    ctx.fillRect(bx, barBaseY - bh, 4, 1);
  }

  // -------------------------------------------------------------
  // RIGHT BOTTOM: Scrolling Threat Data Lines
  // -------------------------------------------------------------
  const feedIdx = Math.floor(frame / 32) % SOC_THREAT_FEEDS.length;
  ctx.font = '4.5px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = done ? '#34d399' : '#f87171';
  ctx.fillText(SOC_THREAT_FEEDS[feedIdx], barBaseX, scrY + 29);
  ctx.fillStyle = done ? '#6ee7b7' : '#fbbf24';
  ctx.fillText(SOC_THREAT_FEEDS[(feedIdx + 1) % SOC_THREAT_FEEDS.length], barBaseX, scrY + 35);

  // Bottom Status Banner
  ctx.font = 'bold 6px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = done ? '#34d399' : '#ef4444';
  ctx.fillText(done ? 'UMBRELLA: PROTECTED' : 'C2 BEACON ALERT', scrX + scrW / 2, scrY + scrH - 2);

  // Scanlines Overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  for (let ly = scrY; ly < scrY + scrH; ly += 2) {
    ctx.fillRect(scrX, ly, scrW, 1);
  }
  ctx.restore();

  // Quest Status Badge
  const badgeY = sy - 14;
  ctx.beginPath();
  ctx.arc(pt.x, badgeY, 13, 0, Math.PI * 2);
  ctx.fillStyle = done ? '#052e16' : '#450a0a';
  ctx.fill();
  ctx.strokeStyle = done ? '#10b981' : '#ef4444';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = done ? '#34d399' : '#f87171';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(done ? '✓' : '!', pt.x, badgeY + 4);
};

// 7. Chunky Neapolitan Bar & Pizza Box (Steaming Espresso Cup & Machine)
export const drawChunkyNeapolitanBar = (
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  canvasW: number,
  frame: number = 0
) => {
  const pt = gridToScreen(gx, gy, canvasW);
  const bw = 68;
  const bh = 36;
  const bx = pt.x - bw / 2;
  const by = pt.y - bh + 14;

  ctx.beginPath();
  ctx.ellipse(pt.x, pt.y + 12, 40, 12, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fill();

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, bw, bh);

  ctx.fillStyle = '#451a03';
  ctx.fillRect(bx, by + bh, bw, 8);

  // Faema E61 Espresso Machine
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(bx + 4, by - 20, 26, 22);
  ctx.fillStyle = '#475569';
  ctx.fillRect(bx + 8, by - 16, 18, 8);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(bx + 8, by + 2, 7, 3);
  ctx.fillRect(bx + 17, by + 2, 7, 3);

  // Portafilter handle
  ctx.fillStyle = '#94a3b8';
  ctx.beginPath();
  ctx.moveTo(bx + 34, by - 14);
  ctx.lineTo(bx + 43, by - 14);
  ctx.lineTo(bx + 44, by + 2);
  ctx.lineTo(bx + 33, by + 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#475569';
  ctx.fillRect(bx + 38, by - 17, 2, 3);

  // Ceramic espresso cup on the counter with dark roast crema
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(bx + 33, by + 2, 7, 8);
  ctx.fillStyle = '#3e1c00'; // rich Neapolitan espresso crema
  ctx.fillRect(bx + 34, by + 3, 5, 3);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(bx + 39, by + 4, 2, 4);

  // Steam plumes: freshly poured cup + espresso machine group heads
  drawSteamPlume(ctx, bx + 36, by + 1, frame, 6);
  drawSteamPlume(ctx, bx + 16, by - 4, frame + 30, 4);

  // Pizza box
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(bx + 46, by + 4, 20, 20);
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(bx + 46, by + 4, 20, 20);

  ctx.fillStyle = '#ea580c';
  ctx.beginPath();
  ctx.arc(bx + 56, by + 14, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(bx + 54, by + 12, 3, 3);
  ctx.fillRect(bx + 57, by + 14, 3, 3);
  ctx.fillStyle = '#16a34a';
  ctx.fillRect(bx + 55, by + 13, 2.5, 2.5);
};

// 8. Certificate Showcase
export const drawChunkyTrophyShowcase = (
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  canvasW: number
) => {
  const pt = gridToScreen(gx, gy, canvasW);
  const tw = 52;
  const th = 68;
  const tx = pt.x - tw / 2;
  const ty = pt.y - th + 12;

  ctx.beginPath();
  ctx.ellipse(pt.x, pt.y + 12, 30, 10, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fill();

  ctx.fillStyle = '#1e1b4b';
  ctx.fillRect(tx, ty, tw, th);
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 2;
  ctx.strokeRect(tx, ty, tw, th);

  ctx.strokeStyle = '#64748b';
  ctx.beginPath();
  ctx.moveTo(tx + 4, ty + 24);
  ctx.lineTo(tx + tw - 4, ty + 24);
  ctx.moveTo(tx + 4, ty + 46);
  ctx.lineTo(tx + tw - 4, ty + 46);
  ctx.stroke();

  ctx.fillStyle = '#eab308';
  ctx.beginPath();
  ctx.arc(tx + 17, ty + 15, 6, 0, Math.PI * 2);
  ctx.arc(tx + 35, ty + 15, 6, 0, Math.PI * 2);
  ctx.arc(tx + 26, ty + 37, 7, 0, Math.PI * 2);
  ctx.fill();
};

// 10. Large Monstera Plant
export const drawChunkyMonstera = (
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  canvasW: number
) => {
  const pt = gridToScreen(gx, gy, canvasW);

  ctx.fillStyle = '#b45309';
  ctx.fillRect(pt.x - 14, pt.y - 14, 28, 7);
  ctx.beginPath();
  ctx.moveTo(pt.x - 12, pt.y - 7);
  ctx.lineTo(pt.x + 12, pt.y - 7);
  ctx.lineTo(pt.x + 9, pt.y + 14);
  ctx.lineTo(pt.x - 9, pt.y + 14);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#15803d';
  ctx.beginPath();
  ctx.ellipse(pt.x - 14, pt.y - 28, 16, 10, -0.4, 0, Math.PI * 2);
  ctx.ellipse(pt.x + 14, pt.y - 30, 17, 10, 0.4, 0, Math.PI * 2);
  ctx.ellipse(pt.x, pt.y - 42, 18, 12, 0, 0, Math.PI * 2);
  ctx.fill();
};

// ==========================================
// ROOM 2: UNDERGROUND DATACENTER & VAULT
// ==========================================

// 11. Heavy Industrial Datacenter Vault Walls
export const drawUndergroundDatacenterWalls = (ctx: CanvasRenderingContext2D, canvasW: number, frame: number) => {
  const origin = gridToScreen(0, 0, canvasW);
  const wallH = 190;
  const wallThick = 12;

  const leftEnd = gridToScreen(0, GRID_SIZE, canvasW);
  const rightEnd = gridToScreen(GRID_SIZE, 0, canvasW);

  // --- LEFT WALL (Heavy Reinforced Concrete & Cable Raceways) ---
  ctx.beginPath();
  ctx.moveTo(origin.x, origin.y);
  ctx.lineTo(origin.x, origin.y - wallH);
  ctx.lineTo(leftEnd.x, leftEnd.y - wallH);
  ctx.lineTo(leftEnd.x, leftEnd.y);
  ctx.closePath();
  ctx.fillStyle = '#1e293b';
  ctx.fill();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Concrete vertical seam panels
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  for (let s = 1; s <= 7; s++) {
    const p1 = gridToScreen(0, s, canvasW);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p1.x, p1.y - wallH);
    ctx.stroke();

    // Rivets along seams
    ctx.fillStyle = '#64748b';
    for (let rh = 25; rh < wallH - 20; rh += 40) {
      ctx.fillRect(p1.x - 2, p1.y - rh - 2, 4, 4);
    }
  }

  // Overhead Industrial Cable Ladder (Yellow Tray with Network Cables)
  const trayY = 35;
  ctx.beginPath();
  ctx.moveTo(origin.x, origin.y - wallH + trayY);
  ctx.lineTo(leftEnd.x, leftEnd.y - wallH + trayY);
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 6;
  ctx.stroke();

  // Multi-color Fiber Optic cables inside tray
  ctx.beginPath();
  ctx.moveTo(origin.x, origin.y - wallH + trayY - 1);
  ctx.lineTo(leftEnd.x, leftEnd.y - wallH + trayY - 1);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(origin.x, origin.y - wallH + trayY + 2);
  ctx.lineTo(leftEnd.x, leftEnd.y - wallH + trayY + 2);
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Industrial Ventilation Duct & Rotating Exhaust Fans
  const fanPos = gridToScreen(0, 3.5, canvasW);
  const fanY = fanPos.y - wallH + 95;

  ctx.save();
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(fanPos.x, fanY, 32, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Rotating fan blades
  const fanAngle = (frame * 0.12) % (Math.PI * 2);
  ctx.save();
  ctx.translate(fanPos.x, fanY);
  ctx.rotate(fanAngle);
  for (let b = 0; b < 4; b++) {
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(14, -8);
    ctx.lineTo(26, 0);
    ctx.lineTo(14, 8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Fan protective grille
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(fanPos.x - 30, fanY);
  ctx.lineTo(fanPos.x + 30, fanY);
  ctx.moveTo(fanPos.x, fanY - 30);
  ctx.lineTo(fanPos.x, fanY + 30);
  ctx.stroke();
  ctx.restore();

  // Left Wall Cap (Titanium / Slate Cap)
  ctx.beginPath();
  ctx.moveTo(origin.x, origin.y - wallH);
  ctx.lineTo(origin.x - wallThick * 0.7, origin.y - wallH - wallThick * 0.5);
  ctx.lineTo(leftEnd.x - wallThick * 0.7, leftEnd.y - wallH - wallThick * 0.5);
  ctx.lineTo(leftEnd.x, leftEnd.y - wallH);
  ctx.closePath();
  ctx.fillStyle = '#475569';
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.stroke();

  // Baseboard with Yellow/Black Safety Hazard Stripes
  ctx.beginPath();
  ctx.moveTo(origin.x, origin.y);
  ctx.lineTo(origin.x, origin.y - 12);
  ctx.lineTo(leftEnd.x, leftEnd.y - 12);
  ctx.lineTo(leftEnd.x, leftEnd.y);
  ctx.closePath();
  ctx.fillStyle = '#0f172a';
  ctx.fill();

  for (let s = 0; s < 14; s++) {
    const tFrac = s / 14;
    const px = origin.x + (leftEnd.x - origin.x) * tFrac;
    const py = origin.y + (leftEnd.y - origin.y) * tFrac;
    ctx.fillStyle = s % 2 === 0 ? '#eab308' : '#0f172a';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + 10, py - 6);
    ctx.lineTo(px + 4, py - 12);
    ctx.lineTo(px - 6, py - 6);
    ctx.closePath();
    ctx.fill();
  }

  // --- RIGHT WALL (Subterranean Blast Wall & Diagnostic Arrays) ---
  ctx.beginPath();
  ctx.moveTo(origin.x, origin.y);
  ctx.lineTo(origin.x, origin.y - wallH);
  ctx.lineTo(rightEnd.x, rightEnd.y - wallH);
  ctx.lineTo(rightEnd.x, rightEnd.y);
  ctx.closePath();
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  ctx.strokeStyle = '#020617';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Right Wall Cap
  ctx.beginPath();
  ctx.moveTo(origin.x, origin.y - wallH);
  ctx.lineTo(origin.x + wallThick * 0.7, origin.y - wallH - wallThick * 0.5);
  ctx.lineTo(rightEnd.x + wallThick * 0.7, rightEnd.y - wallH - wallThick * 0.5);
  ctx.lineTo(rightEnd.x, rightEnd.y - wallH);
  ctx.closePath();
  ctx.fillStyle = '#334155';
  ctx.fill();
  ctx.strokeStyle = '#1e293b';
  ctx.stroke();

  // Right Baseboard Hazard Stripes
  for (let s = 0; s < 14; s++) {
    const tFrac = s / 14;
    const px = origin.x + (rightEnd.x - origin.x) * tFrac;
    const py = origin.y + (rightEnd.y - origin.y) * tFrac;
    ctx.fillStyle = s % 2 === 0 ? '#eab308' : '#0f172a';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - 10, py - 6);
    ctx.lineTo(px - 4, py - 12);
    ctx.lineTo(px + 6, py - 6);
    ctx.closePath();
    ctx.fill();
  }

  // Subterranean Telemetry Status Panel on Right Wall
  const pRightPanel = gridToScreen(4, 0, canvasW);
  const panelY = pRightPanel.y - wallH + 55;

  ctx.save();
  ctx.translate(pRightPanel.x - 20, panelY);
  ctx.transform(1, -0.4, 0, 1, 0, 0);

  ctx.fillStyle = '#030712';
  ctx.fillRect(0, 0, 110, 65);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, 110, 65);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 8.5px monospace';
  ctx.fillText('DATACENTER VAULT // -1F', 6, 14);

  ctx.fillStyle = '#10b981';
  ctx.font = '7.5px monospace';
  ctx.fillText('COOLING: 19.5°C [STABLE]', 6, 26);
  ctx.fillText('AIRFLOW: COLD AISLE OK', 6, 36);

  ctx.fillStyle = '#f59e0b';
  ctx.fillText('UPS LOAD: 42% (A+B GRID)', 6, 46);

  // Blinking emergency beacon dot
  const beaconBlink = Math.sin(frame * 0.1) > 0;
  ctx.fillStyle = beaconBlink ? '#ef4444' : '#7f1d1d';
  ctx.beginPath();
  ctx.arc(98, 12, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Pulsing Emergency Beacon on top of right corner
  const beaconPos = gridToScreen(2, 0, canvasW);
  const by = beaconPos.y - wallH + 18;
  const pulse = Math.abs(Math.sin(frame * 0.08));

  ctx.save();
  ctx.fillStyle = '#ef4444';
  ctx.shadowColor = '#ef4444';
  ctx.shadowBlur = 15 * pulse;
  ctx.beginPath();
  ctx.arc(beaconPos.x, by, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

// 12. Raised Datacenter Floor with Perforated Cooling Grilles & Cool Mist Particles
export const drawUndergroundFloor = (
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  tgt: TilePos | null,
  frame: number = 0
) => {
  const originX = canvasW * 0.5;
  const halfW = TILE_W * 0.5; // 48
  const halfH = TILE_H * 0.5; // 24

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      // Inlined projection: zero heap allocation
      const ptX = (c - r) * halfW + originX;
      const ptY = (c + r) * halfH + ORIGIN_Y;
      const isAlternate = (c + r) % 2 === 0;

      ctx.beginPath();
      ctx.moveTo(ptX, ptY);
      ctx.lineTo(ptX + halfW, ptY + halfH);
      ctx.lineTo(ptX, ptY + TILE_H);
      ctx.lineTo(ptX - halfW, ptY + halfH);
      ctx.closePath();

      // Cold aisle perforated tiles down the central corridor
      const isColdAisle = (c >= 2 && c <= 4 && r >= 2 && r <= 4);

      if (isColdAisle) {
        ctx.fillStyle = isAlternate ? COLOR_VAULT_AISLE_1 : COLOR_VAULT_AISLE_2;
        ctx.fill();

        // Sinusoidal pulsing glow calculation
        const pulse = 0.5 + 0.5 * Math.sin(frame * 0.06 + (c + r) * 0.8);
        ctx.strokeStyle = pulse > 0.55 ? COLOR_VAULT_STROKE_PULSE : COLOR_VAULT_STROKE_AISLE;
        ctx.lineWidth = pulse > 0.55 ? 1.8 : 1.5;
        ctx.stroke();

        // Sub-floor cyan cooling glow (expands and breathes)
        const glowRadius = 13 + pulse * 5;
        const glowAlpha = 0.18 + pulse * 0.22;
        ctx.fillStyle = COLOR_CYAN_GLOW;
        ctx.globalAlpha = glowAlpha;
        ctx.beginPath();
        ctx.arc(ptX, ptY + halfH, glowRadius, 0, PI2);
        ctx.fill();

        // Perforated grille holes with illuminated ventilation airflow
        ctx.globalAlpha = 0.6 + pulse * 0.4;
        for (let dx = -8; dx <= 8; dx += 8) {
          for (let dy = -4; dy <= 4; dy += 4) {
            ctx.fillRect(ptX + dx, ptY + halfH + dy, 2, 2);
          }
        }
        ctx.globalAlpha = 1.0;

        // Cool mist particles rising from sub-floor pressurized airflow
        for (let m = 0; m < 2; m++) {
          const mSeed = c * 7 + r * 13 + m * 31;
          const t = ((frame * 0.32 + mSeed) % 60) / 60;
          const mistY = (ptY + halfH) - t * 24;
          const mistX = ptX + Math.sin(frame * 0.07 + mSeed) * (3 + t * 4);
          const mistR = 1.0 + t * 2.8;
          const mistAlpha = Math.sin(t * Math.PI) * 0.28;

          if (mistAlpha > 0.02) {
            ctx.fillStyle = COLOR_COOL_MIST;
            ctx.globalAlpha = mistAlpha;
            ctx.beginPath();
            ctx.arc(mistX, mistY, mistR, 0, PI2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1.0;
      } else {
        ctx.fillStyle = isAlternate ? COLOR_VAULT_SLATE_1 : COLOR_VAULT_SLATE_2;
        ctx.fill();
        ctx.strokeStyle = COLOR_VAULT_STROKE_DEF;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      if (tgt && Math.round(tgt.x) === c && Math.round(tgt.y) === r) {
        ctx.fillStyle = COLOR_TARGET_CYAN;
        ctx.fill();
        ctx.strokeStyle = COLOR_CYAN_GLOW;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    }
  }
};

// 13. Chunky Industrial Elevator (Floor 1 <-> Floor -1 Transit)
export const drawChunkyIndustrialElevator = (
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  canvasW: number,
  room: 'office' | 'datacenter_vault',
  frame: number
) => {
  const pt = gridToScreen(gx, gy, canvasW);
  const w = 52;
  const h = 88;
  const ex = pt.x - w / 2;
  const ey = pt.y - h;

  // Heavy steel shadow on floor
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(pt.x, pt.y + 6, 32, 16, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fill();
  ctx.restore();

  // Elevator Frame (Reinforced Industrial Steel)
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(ex, ey, w, h);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.strokeRect(ex, ey, w, h);

  // Hazard border stripe on top header
  ctx.fillStyle = '#eab308';
  ctx.fillRect(ex + 4, ey + 4, w - 8, 8);
  ctx.fillStyle = '#0f172a';
  for (let s = ex + 4; s < ex + w - 8; s += 8) {
    ctx.fillRect(s, ey + 4, 4, 8);
  }

  // Digital Floor Indicator Screen
  const isVault = room === 'datacenter_vault';
  ctx.fillStyle = '#020617';
  ctx.fillRect(ex + 10, ey + 15, w - 20, 16);
  ctx.strokeStyle = isVault ? '#38bdf8' : '#f59e0b';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(ex + 10, ey + 15, w - 20, 16);

  ctx.fillStyle = isVault ? '#38bdf8' : '#f59e0b';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  const arrowBlink = Math.sin(frame * 0.1) > 0 ? (isVault ? '▲' : '▼') : ' ';
  ctx.fillText(isVault ? `-1F ${arrowBlink}` : `1F ${arrowBlink}`, ex + w / 2, ey + 27);
  ctx.textAlign = 'start';

  // Stainless Steel Sliding Doors
  const doorW = (w - 12) / 2;
  const doorH = h - 38;
  const doorY = ey + 34;

  // Left door
  ctx.fillStyle = '#475569';
  ctx.fillRect(ex + 6, doorY, doorW, doorH);
  ctx.strokeStyle = '#334155';
  ctx.strokeRect(ex + 6, doorY, doorW, doorH);

  // Right door
  ctx.fillStyle = '#334155';
  ctx.fillRect(ex + 6 + doorW, doorY, doorW, doorH);
  ctx.strokeStyle = '#1e293b';
  ctx.strokeRect(ex + 6 + doorW, doorY, doorW, doorH);

  // Center vertical door gap
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ex + 6 + doorW, doorY);
  ctx.lineTo(ex + 6 + doorW, doorY + doorH);
  ctx.stroke();

  // Call Button Panel on side jamb
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(ex + w - 5, ey + 45, 6, 18);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1;
  ctx.strokeRect(ex + w - 5, ey + 45, 6, 18);

  // Illuminated Call LED
  ctx.fillStyle = isVault ? '#10b981' : '#38bdf8';
  ctx.beginPath();
  ctx.arc(ex + w - 2, ey + 52, 2, 0, Math.PI * 2);
  ctx.fill();
};

// 14. Chunky Wireshark DPI Console Workstation (Hex Dump + Packet Flow Indicators)
export const drawChunkyWiresharkConsole = (
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  canvasW: number,
  level4Done: boolean,
  frame: number
) => {
  const pt = gridToScreen(gx, gy, canvasW);
  const w = 58;
  const h = 48;
  const dx = pt.x - w / 2;
  const dy = pt.y - h;

  // Base shadow
  ctx.beginPath();
  ctx.ellipse(pt.x, pt.y + 4, 30, 14, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fill();

  // Carbon Console Desk
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(dx, dy + 16, w, 22);
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(dx, dy + 16, w, 22);

  // Ultrawide Curving Monitor Bezel
  ctx.fillStyle = '#020617';
  ctx.fillRect(dx + 4, dy - 18, w - 8, 32);
  ctx.strokeStyle = level4Done ? '#10b981' : '#38bdf8';
  ctx.lineWidth = 2;
  ctx.strokeRect(dx + 4, dy - 18, w - 8, 32);

  // Monitor Display Surface
  const scrX = dx + 6;
  const scrY = dy - 16;
  const scrW = w - 12; // 46px
  const scrH = 28;
  ctx.fillStyle = '#040d1a';
  ctx.fillRect(scrX, scrY, scrW, scrH);

  ctx.save();
  ctx.beginPath();
  ctx.rect(scrX, scrY, scrW, scrH);
  ctx.clip();

  // -------------------------------------------------------------
  // TOP ROW: Header Title & Green/Amber Packet Flow Indicators
  // -------------------------------------------------------------
  ctx.font = 'bold 5.5px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('🦈 DPI', scrX + 2, scrY + 6);

  // 5 Moving Packet Flow Indicators
  const activeStep = Math.floor(frame * 0.22) % 5;
  for (let p = 0; p < 5; p++) {
    const isSuspicious = !level4Done && (p === 2 || p === 4);
    const isActive = (p === activeStep);
    ctx.fillStyle = isActive
      ? (isSuspicious ? '#fbbf24' : '#34d399')
      : (isSuspicious ? '#92400e' : '#064e3b');
    ctx.fillRect(scrX + 22 + p * 4.5, scrY + 2.5, 3.5, 3.5);
  }

  // -------------------------------------------------------------
  // MIDDLE: Scrolling Raw Hex Dump Lines
  // -------------------------------------------------------------
  const hexIdx = Math.floor(frame / 26) % WIRESHARK_HEX_LINES.length;
  const hex1 = WIRESHARK_HEX_LINES[hexIdx];
  const hex2 = WIRESHARK_HEX_LINES[(hexIdx + 1) % WIRESHARK_HEX_LINES.length];

  ctx.font = '4.5px monospace';
  ctx.fillStyle = level4Done ? '#6ee7b7' : '#94a3b8';
  ctx.fillText(hex1, scrX + 2, scrY + 13);

  // Highlight suspicious byte row in amber when not solved
  ctx.fillStyle = level4Done ? '#34d399' : (hexIdx % 2 === 0 ? '#fbbf24' : '#6ee7b7');
  ctx.fillText(hex2, scrX + 2, scrY + 19);

  // Scanning Byte Inspection Cursor Underline
  const colIdx = Math.floor(frame / 6) % 4;
  const underX = scrX + 11 + colIdx * 7.5;
  ctx.fillStyle = level4Done ? '#10b981' : '#f59e0b';
  ctx.fillRect(underX, scrY + 20, 6, 1);

  // -------------------------------------------------------------
  // BOTTOM: Live PCAP Stream Status
  // -------------------------------------------------------------
  ctx.font = 'bold 5px monospace';
  ctx.fillStyle = level4Done ? '#10b981' : '#ef4444';
  ctx.fillText(level4Done ? 'PCAP: FILTER APPLIED' : 'DNS EXFIL DETECTED', scrX + 2, scrY + 26);

  // Scanlines Overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  for (let ly = scrY; ly < scrY + scrH; ly += 2) {
    ctx.fillRect(scrX, ly, scrW, 1);
  }
  ctx.restore();
};

// 15. Cisco Firepower 4100 NGFW Wall (Tile 5, 2 in Vault)
export const drawChunkyFirepowerWall = (
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  canvasW: number,
  frame: number
) => {
  const pt = gridToScreen(gx, gy, canvasW);
  const w = 54;
  const h = 64;
  const fx = pt.x - w / 2;
  const fy = pt.y - h;

  // Base shadow
  ctx.beginPath();
  ctx.ellipse(pt.x, pt.y + 4, 28, 12, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fill();

  // Heavy Appliance Chassis
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(fx, fy, w, h);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.strokeRect(fx, fy, w, h);

  // Cisco Firepower Faceplate Badge
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(fx + 6, fy + 6, w - 12, 10);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 6.5px monospace';
  ctx.fillText('FIREPOWER 4100', fx + 8, fy + 14);

  // High-Density Fan Grilles
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(fx + 16, fy + 32, 9, 0, Math.PI * 2);
  ctx.arc(fx + 38, fy + 32, 9, 0, Math.PI * 2);
  ctx.fill();

  // Blinking IPS / Threat Inspection LEDs
  for (let i = 0; i < 6; i++) {
    const isGreen = ((frame + i * 5) % 15) < 8;
    ctx.fillStyle = isGreen ? '#10b981' : '#f59e0b';
    ctx.fillRect(fx + 8 + i * 6.5, fy + 50, 4, 3);
  }
};

// 16. Cisco UCS SAN Storage Vault (Tile 2, 5 in Vault)
export const drawChunkySanVault = (
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  canvasW: number,
  frame: number
) => {
  const pt = gridToScreen(gx, gy, canvasW);
  const w = 52;
  const h = 62;
  const sx = pt.x - w / 2;
  const sy = pt.y - h;

  // Shadow
  ctx.beginPath();
  ctx.ellipse(pt.x, pt.y + 4, 26, 12, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fill();

  // SAN Enclosure Body
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(sx, sy, w, h);
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(sx, sy, w, h);

  // 4 Rows of Hot-Swappable SAS/NVMe Drive Caddies
  for (let r = 0; r < 4; r++) {
    const rowY = sy + 6 + r * 13;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(sx + 5, rowY, w - 10, 10);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx + 5, rowY, w - 10, 10);

    // Blinking Fibre Channel Activity LEDs
    for (let d = 0; d < 4; d++) {
      const isRead = ((frame + r * 7 + d * 3) % 20) < 10;
      ctx.fillStyle = isRead ? '#38bdf8' : '#0369a1';
      ctx.fillRect(sx + 8 + d * 9.5, rowY + 3.5, 4, 3);
    }
  }
};

// 17. SecBot Sentinel AI Drone (Tile 1, 6 in Vault)
export const drawChunkySecBot = (
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  canvasW: number,
  frame: number
) => {
  const pt = gridToScreen(gx, gy, canvasW);
  const hoverY = Math.sin(frame * 0.08) * 5;
  const bx = pt.x;
  const by = pt.y - 32 + hoverY;

  // Ground anti-gravity shadow/glow
  ctx.save();
  const shadowScale = 1 - hoverY / 20;
  ctx.beginPath();
  ctx.ellipse(pt.x, pt.y + 2, 16 * shadowScale, 8 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
  ctx.fill();
  ctx.restore();

  // Drone Spherical Metallic Body
  ctx.beginPath();
  ctx.arc(bx, by, 15, 0, Math.PI * 2);
  ctx.fillStyle = '#1e293b';
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Glowing Visor Scanner Eye (Cylindrical sweep)
  const visorW = 18;
  const eyeOffset = Math.sin(frame * 0.1) * 4;
  ctx.fillStyle = '#020617';
  ctx.fillRect(bx - visorW / 2, by - 4, visorW, 8);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx - visorW / 2, by - 4, visorW, 8);

  ctx.fillStyle = '#38bdf8';
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(bx + eyeOffset, by, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Top Antenna with green telemetry beacon
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bx, by - 15);
  ctx.lineTo(bx, by - 24);
  ctx.stroke();

  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.arc(bx, by - 25, 2.5, 0, Math.PI * 2);
  ctx.fill();
};

// 17. Rotating 3D Cisco Hologram (Office) & Cyber Defense Shield (Datacenter Vault)
export const drawCiscoHologram = (
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  canvasW: number,
  frame: number,
  variant: 'office' | 'datacenter_vault' = 'office'
) => {
  const pt = gridToScreen(gx, gy, canvasW);
  const baseX = pt.x;
  const baseY = pt.y + 24; // Center of isometric floor tile diamond

  ctx.save();

  // --- 1. PROJECTOR EMITTER BASE ON FLOOR ---
  // A) Floor shadow & outer mounting plate (dimetric 2:1 ellipse)
  ctx.beginPath();
  ctx.ellipse(baseX, baseY, 32, 16, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#0b0f19';
  ctx.fill();
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // B) 3D Beveled Base Housing (4px extrusion)
  ctx.beginPath();
  ctx.moveTo(baseX - 30, baseY);
  ctx.lineTo(baseX - 30, baseY - 4);
  ctx.ellipse(baseX, baseY - 4, 30, 15, 0, Math.PI, 0, true);
  ctx.lineTo(baseX + 30, baseY);
  ctx.ellipse(baseX, baseY, 30, 15, 0, 0, Math.PI, false);
  ctx.closePath();
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.stroke();

  // C) Top Emitter Disc
  ctx.beginPath();
  ctx.ellipse(baseX, baseY - 4, 30, 15, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#1e293b';
  ctx.fill();
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1;
  ctx.stroke();

  // D) Concentric Emitter Aperture & Glowing Lens
  const pulse = 0.65 + Math.sin(frame * 0.1) * 0.25;
  const isOffice = variant === 'office';
  const accentGlow = isOffice ? 'rgba(0, 188, 235,' : 'rgba(6, 182, 212,';

  ctx.beginPath();
  ctx.ellipse(baseX, baseY - 4, 20, 10, 0, 0, Math.PI * 2);
  ctx.fillStyle = isOffice ? '#0284c7' : '#0f766e';
  ctx.fill();
  ctx.strokeStyle = `${accentGlow} ${pulse})`;
  ctx.lineWidth = 2;
  ctx.stroke();

  // E) 4 Orbital Focusing Node LEDs
  for (let k = 0; k < 4; k++) {
    const nodeA = frame * 0.02 + k * (Math.PI / 2);
    const nx = baseX + Math.cos(nodeA) * 20;
    const ny = (baseY - 4) + Math.sin(nodeA) * 10;
    ctx.fillStyle = isOffice ? '#38bdf8' : '#10b981';
    ctx.fillRect(nx - 1.5, ny - 1.5, 3, 3);
  }

  // F) Central Projection Laser Diode
  ctx.beginPath();
  ctx.arc(baseX, baseY - 4, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // --- 2. UPWARD TRANSLUCENT LIGHT CONE ---
  const holoBob = Math.sin(frame * 0.06) * 4;
  const holoCenterY = pt.y - 48 + holoBob;

  const coneGrad = ctx.createLinearGradient(baseX, baseY - 4, baseX, holoCenterY - 32);
  if (isOffice) {
    coneGrad.addColorStop(0, 'rgba(0, 188, 235, 0.35)');
    coneGrad.addColorStop(0.35, 'rgba(56, 189, 248, 0.18)');
    coneGrad.addColorStop(0.75, 'rgba(2, 132, 199, 0.08)');
    coneGrad.addColorStop(1, 'rgba(0, 188, 235, 0)');
  } else {
    coneGrad.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
    coneGrad.addColorStop(0.35, 'rgba(6, 182, 212, 0.18)');
    coneGrad.addColorStop(0.75, 'rgba(56, 189, 248, 0.08)');
    coneGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');
  }

  ctx.beginPath();
  ctx.moveTo(baseX - 20, baseY - 4);
  ctx.lineTo(baseX - 38, holoCenterY - 26);
  ctx.lineTo(baseX + 38, holoCenterY - 26);
  ctx.lineTo(baseX + 20, baseY - 4);
  ctx.closePath();
  ctx.fillStyle = coneGrad;
  ctx.fill();

  // Lateral Laser Beam Guidewires
  const laserAlpha = 0.18 + Math.sin(frame * 0.12) * 0.08;
  ctx.strokeStyle = isOffice ? `rgba(56, 189, 248, ${laserAlpha})` : `rgba(16, 185, 129, ${laserAlpha})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(baseX - 20, baseY - 4);
  ctx.lineTo(baseX - 38, holoCenterY - 26);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(baseX + 20, baseY - 4);
  ctx.lineTo(baseX + 38, holoCenterY - 26);
  ctx.stroke();

  // Central Vertical Core Beam Axis
  ctx.strokeStyle = `rgba(255, 255, 255, ${laserAlpha * 0.8})`;
  ctx.beginPath();
  ctx.moveTo(baseX, baseY - 4);
  ctx.lineTo(baseX, holoCenterY + 16);
  ctx.stroke();

  // --- 3. ORBITING PHOTON SPARKS (BEHIND PASS) ---
  const sparkCount = 5;
  for (let s = 0; s < sparkCount; s++) {
    const sSpeed = 0.04 + (s % 2) * 0.015;
    const sDir = (s % 2 === 0) ? 1 : -1;
    const sAngle = frame * sSpeed * sDir + s * ((Math.PI * 2) / sparkCount);
    const sSin = Math.sin(sAngle);
    if (sSin < 0) { // Behind hologram
      const sRadX = 26 + (s % 3) * 5;
      const sRadY = sRadX * 0.45;
      const sx = baseX + Math.cos(sAngle) * sRadX;
      const sy = holoCenterY + (s - 2) * 7 + sSin * sRadY;
      const sAlpha = 0.25 + 0.35 * Math.abs(Math.sin(frame * 0.1 + s));
      ctx.fillStyle = isOffice ? `rgba(224, 242, 254, ${sAlpha})` : `rgba(167, 243, 208, ${sAlpha})`;
      ctx.fillRect(sx - 1, sy - 1, 2, 2);
    }
  }

  // --- 4. 3D ROTATING HOLOGRAM GEOMETRY ---
  if (isOffice) {
    // 3D Rotating Cisco 9-Bar Bridge Logo
    const barHeights = [10, 16, 22, 28, 36, 28, 22, 16, 10];
    const rot = frame * 0.035;
    const radius = 26;

    // Draw bars depth-sorted: back bars first, front bars second
    const order = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    order.sort((a, b) => Math.cos(rot + (a - 4) * 0.26) - Math.cos(rot + (b - 4) * 0.26));

    for (let k = 0; k < 9; k++) {
      const i = order[k];
      const angle = rot + (i - 4) * 0.26;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const bx = baseX + sinA * radius;
      const depthScale = (cosA + 1.6) / 2.6; // 0.23 .. 1.0
      const bh = barHeights[i] * depthScale;
      const bw = Math.max(2, 3.2 * depthScale);
      const bAlpha = Math.max(0.2, 0.4 + cosA * 0.4);

      // Bar Body (Glowing Cyan)
      ctx.fillStyle = `rgba(56, 189, 248, ${bAlpha})`;
      ctx.fillRect(bx - bw / 2, holoCenterY - bh / 2, bw, bh);

      // Bright Cyan Highlight Caps on top and bottom of each bar
      ctx.fillStyle = `rgba(224, 242, 254, ${Math.min(1, bAlpha * 1.3)})`;
      ctx.fillRect(bx - bw / 2, holoCenterY - bh / 2, bw, 2);
      ctx.fillRect(bx - bw / 2, holoCenterY + bh / 2 - 2, bw, 2);
    }

    // Floating Cisco Text / Baseline
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(56, 189, 248, ${0.65 + Math.sin(frame * 0.1) * 0.25})`;
    ctx.fillText('CISCO', baseX, holoCenterY + 26);
  } else {
    // Datacenter Vault: 3D Rotating Cyber Defense Shield & Security Badge
    const shieldRot = frame * 0.038;
    const cosR = Math.cos(shieldRot);
    const absCosR = Math.abs(cosR);
    const isFront = cosR >= 0;

    // 5-Vertex Shield Polygon:
    const v0x = baseX - 18 * cosR;
    const v0y = holoCenterY - 16;
    const v1x = baseX + 18 * cosR;
    const v1y = holoCenterY - 16;
    const v2x = baseX + 18 * cosR;
    const v2y = holoCenterY + 2;
    const v3x = baseX;
    const v3y = holoCenterY + 20;
    const v4x = baseX - 18 * cosR;
    const v4y = holoCenterY + 2;

    ctx.beginPath();
    ctx.moveTo(v0x, v0y);
    ctx.lineTo(v1x, v1y);
    ctx.lineTo(v2x, v2y);
    ctx.lineTo(v3x, v3y);
    ctx.lineTo(v4x, v4y);
    ctx.closePath();

    // Shield Body Fill
    if (isFront) {
      const shieldGrad = ctx.createLinearGradient(baseX, holoCenterY - 16, baseX, holoCenterY + 20);
      shieldGrad.addColorStop(0, 'rgba(6, 182, 212, 0.45)');
      shieldGrad.addColorStop(1, 'rgba(16, 185, 129, 0.25)');
      ctx.fillStyle = shieldGrad;
    } else {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
    }
    ctx.fill();

    // Glowing Cyber Shield Border
    ctx.strokeStyle = isFront ? 'rgba(56, 189, 248, 0.85)' : 'rgba(6, 182, 212, 0.5)';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Front Face Insignia: Cyber Checkmark / Shackle
    if (isFront && absCosR > 0.25) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(baseX - 7 * cosR, holoCenterY - 1);
      ctx.lineTo(baseX - 1 * cosR, holoCenterY + 6);
      ctx.lineTo(baseX + 7 * cosR, holoCenterY - 5);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(224, 242, 254, 0.8)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(baseX, holoCenterY - 6, 4 * absCosR, Math.PI, 0);
      ctx.stroke();
    } else if (!isFront && absCosR > 0.25) {
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(baseX - 10 * cosR, holoCenterY);
      ctx.lineTo(baseX + 10 * cosR, holoCenterY);
      ctx.moveTo(baseX, holoCenterY - 10);
      ctx.lineTo(baseX, holoCenterY + 10);
      ctx.stroke();
    }

    // Orbiting Elliptical Security Perimeter Rings
    const ringAngle = frame * 0.02;
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(baseX, holoCenterY, 26, 12, ringAngle, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Floating Datacenter Vault Label
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(56, 189, 248, ${0.65 + Math.sin(frame * 0.1) * 0.25})`;
    ctx.fillText('SEC-VAULT', baseX, holoCenterY + 26);
  }

  // --- 5. ORBITING PHOTON SPARKS (FRONT PASS) ---
  for (let s = 0; s < sparkCount; s++) {
    const sSpeed = 0.04 + (s % 2) * 0.015;
    const sDir = (s % 2 === 0) ? 1 : -1;
    const sAngle = frame * sSpeed * sDir + s * ((Math.PI * 2) / sparkCount);
    const sSin = Math.sin(sAngle);
    if (sSin >= 0) { // Front of hologram
      const sRadX = 26 + (s % 3) * 5;
      const sRadY = sRadX * 0.45;
      const sx = baseX + Math.cos(sAngle) * sRadX;
      const sy = holoCenterY + (s - 2) * 7 + sSin * sRadY;
      const sAlpha = 0.4 + 0.5 * Math.abs(Math.sin(frame * 0.1 + s));

      ctx.fillStyle = isOffice ? `rgba(224, 242, 254, ${sAlpha})` : `rgba(167, 243, 208, ${sAlpha})`;
      ctx.fillRect(sx - 1, sy - 1, 2, 2);

      const pAngle = sAngle - 0.1 * sDir;
      const px = baseX + Math.cos(pAngle) * sRadX;
      const py = holoCenterY + (s - 2) * 7 + Math.sin(pAngle) * sRadY;
      ctx.strokeStyle = isOffice ? `rgba(56, 189, 248, ${sAlpha * 0.45})` : `rgba(16, 185, 129, ${sAlpha * 0.45})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(sx, sy);
      ctx.stroke();
    }
  }

  // --- 6. SCANLINE FLICKER LINE & CRT RASTER OVERLAY ---
  const scanProgress = ((frame * 1.6) % 60) - 30;
  const scanY = holoCenterY + scanProgress;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.48)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(baseX - 28, scanY);
  ctx.lineTo(baseX + 28, scanY);
  ctx.stroke();

  // Subtle CRT Raster Lines (Zero GC)
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
  ctx.lineWidth = 0.8;
  for (let ry = holoCenterY - 24; ry <= holoCenterY + 20; ry += 6) {
    ctx.beginPath();
    ctx.moveTo(baseX - 24, ry);
    ctx.lineTo(baseX + 24, ry);
    ctx.stroke();
  }

  ctx.restore();
};

