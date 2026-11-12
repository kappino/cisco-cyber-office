import {
  GRID_SIZE,
  TILE_W,
  TILE_H,
  ORIGIN_Y,
  ELEVATION_H,
  MEZZ_MAX_X,
  MEZZ_MAX_Y,
  STAIR_MIN_X,
  STAIR_MAX_X,
  STAIR_START_Y,
  TilePos,
  gridToScreen,
  getElevationAt
} from './isoMath';

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

/**
 * Draws a true 2:1 isometric 3D prism centered on the floor at (bcx, bcy).
 * rx extends along +gx (down-right, slope +0.5), ly extends along +gy (down-left, slope -0.5).
 */
const drawIsoPrism = (
  ctx: CanvasRenderingContext2D,
  bcx: number,
  bcy: number,
  rx: number,
  ly: number,
  h: number,
  topCol: string,
  leftCol: string,
  rightCol: string,
  strokeCol?: string
) => {
  const bx = bcx + ly - rx;
  const by = bcy - 0.5 * (rx + ly);
  const rrx = bcx + rx + ly;
  const rry = bcy + 0.5 * (rx - ly);
  const fx = bcx - ly + rx;
  const fy = bcy + 0.5 * (rx + ly);
  const lx = bcx - rx - ly;
  const ly_ = bcy - 0.5 * (rx - ly);

  // Left-front face (along +gx, faces SW)
  ctx.beginPath();
  ctx.moveTo(lx, ly_ - h);
  ctx.lineTo(fx, fy - h);
  ctx.lineTo(fx, fy);
  ctx.lineTo(lx, ly_);
  ctx.closePath();
  ctx.fillStyle = leftCol;
  ctx.fill();
  if (strokeCol) {
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Right-front face (along +gy, faces SE)
  ctx.beginPath();
  ctx.moveTo(fx, fy - h);
  ctx.lineTo(rrx, rry - h);
  ctx.lineTo(rrx, rry);
  ctx.lineTo(fx, fy);
  ctx.closePath();
  ctx.fillStyle = rightCol;
  ctx.fill();
  if (strokeCol) {
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Top face
  ctx.beginPath();
  ctx.moveTo(bx, by - h);
  ctx.lineTo(rrx, rry - h);
  ctx.lineTo(fx, fy - h);
  ctx.lineTo(lx, ly_ - h);
  ctx.closePath();
  ctx.fillStyle = topCol;
  ctx.fill();
  if (strokeCol) {
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
};

/**
 * Draws the standardized floating circular quest status badge (! / check).
 */
const drawQuestBadge = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  done: boolean,
  pendingBg: string,
  pendingBorder: string,
  pendingText: string
) => {
  ctx.beginPath();
  ctx.arc(x, y, 12, 0, PI2);
  ctx.fillStyle = done ? '#052e16' : pendingBg;
  ctx.fill();
  ctx.strokeStyle = done ? '#10b981' : pendingBorder;
  ctx.lineWidth = 2.2;
  ctx.stroke();

  ctx.fillStyle = done ? '#34d399' : pendingText;
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(done ? '✓' : '!', x, y + 4);
  ctx.textAlign = 'start';
};

// 1. Warm Exposed Terracotta Brick Walls with Split-Level Baseboard, Panoramic Naples Window & Aligned Posters
export const drawWarmHabboWalls = (ctx: CanvasRenderingContext2D, canvasW: number, frame: number) => {
  const origin = gridToScreen(0, 0, canvasW);
  const wallH = 175;
  const wallThick = 12;

  const leftEnd = gridToScreen(0, GRID_SIZE, canvasW);
  const rightEnd = gridToScreen(GRID_SIZE, 0, canvasW);
  const mezzLeftEnd = gridToScreen(0, MEZZ_MAX_Y, canvasW);
  const mezzRightEnd = gridToScreen(MEZZ_MAX_X, 0, canvasW);

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

  // Subtle Brick course lines on left wall
  ctx.strokeStyle = 'rgba(154, 52, 18, 0.7)';
  ctx.lineWidth = 1;
  for (let h = 22; h < wallH - 10; h += 22) {
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y - h);
    ctx.lineTo(leftEnd.x, leftEnd.y - h);
    ctx.stroke();
  }

  // Left Wall Top Thickness Cap
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

  // Stepped Left Baseboard (Upper Mezzanine gy: 0..3 raised by ELEVATION_H, Lower Lounge gy: 3..8 at 0)
  ctx.fillStyle = '#451a03';
  ctx.beginPath();
  ctx.moveTo(origin.x, origin.y - ELEVATION_H);
  ctx.lineTo(origin.x, origin.y - ELEVATION_H - 11);
  ctx.lineTo(mezzLeftEnd.x, mezzLeftEnd.y - ELEVATION_H - 11);
  ctx.lineTo(mezzLeftEnd.x, mezzLeftEnd.y - ELEVATION_H);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(mezzLeftEnd.x, mezzLeftEnd.y);
  ctx.lineTo(mezzLeftEnd.x, mezzLeftEnd.y - 11);
  ctx.lineTo(leftEnd.x, leftEnd.y - 11);
  ctx.lineTo(leftEnd.x, leftEnd.y);
  ctx.closePath();
  ctx.fill();

  // --- EMBEDDED PANORAMIC WINDOW OF GOLFO DI NAPOLI & VESUVIO (OVERLOOKING LOUNGE gy: 3.3..7.4) ---
  // Cleanly positioned in the lower lounge zone so the server rack never obstructs the view!
  const pLeftWall = gridToScreen(0, 7.4, canvasW);
  const pRightWall = gridToScreen(0, 3.3, canvasW);
  const sillOffset = 30;
  const winH = 112;

  const sillLx = pLeftWall.x + 4;
  const sillLy = pLeftWall.y - sillOffset;
  const sillRx = pRightWall.x - 4;
  const sillRy = pRightWall.y - sillOffset;

  const wx = (u: number) => sillLx + (sillRx - sillLx) * u;
  const wy = (u: number, v: number) => sillLy + (sillRy - sillLy) * u - v * winH;

  // Recessed outer reveal bevel (depth shadow inside wall thickness)
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.moveTo(wx(0), wy(0, 1));
  ctx.lineTo(wx(1), wy(1, 1));
  ctx.lineTo(wx(1), wy(1, 0));
  ctx.lineTo(wx(0), wy(0, 0));
  ctx.closePath();
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(wx(0), wy(0, 1));
  ctx.lineTo(wx(1), wy(1, 1));
  ctx.lineTo(wx(1), wy(1, 0));
  ctx.lineTo(wx(0), wy(0, 0));
  ctx.closePath();
  ctx.clip();

  // A) Sunset Sky Gradient aligned along vertical axis from sea horizon (v=0.35) to zenith (v=1.0)
  const skyGrad = ctx.createLinearGradient(wx(0.5), wy(0.5, 1), wx(0.5), wy(0.5, 0.32));
  skyGrad.addColorStop(0, '#2e1065');
  skyGrad.addColorStop(0.32, '#701a75');
  skyGrad.addColorStop(0.68, '#ea580c');
  skyGrad.addColorStop(0.92, '#fde047');
  skyGrad.addColorStop(1, '#fed7aa');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(sillLx - 10, wy(1, 1) - 10, sillRx - sillLx + 20, sillLy - wy(1, 1) + 20);

  // Soft sunset clouds aligned to perspective slope
  ctx.fillStyle = 'rgba(253, 186, 116, 0.25)';
  ctx.beginPath();
  ctx.ellipse(wx(0.22), wy(0.22, 0.78), 28, 5, -0.44, 0, PI2);
  ctx.ellipse(wx(0.62), wy(0.62, 0.85), 34, 6, -0.44, 0, PI2);
  ctx.fill();

  // B) Glowing Setting Sun above sea horizon
  const sunX = wx(0.29);
  const sunY = wy(0.29, 0.49);
  ctx.save();
  ctx.beginPath();
  ctx.arc(sunX, sunY, 17, 0, PI2);
  ctx.fillStyle = '#fef08a';
  ctx.shadowColor = '#fb923c';
  ctx.shadowBlur = 22;
  ctx.fill();
  ctx.restore();

  // C) Sea of Gulf of Naples — Strictly bounded from horizon v = 0.35 down to v = -0.05 (ZERO sky underneath!)
  const horizonV = 0.35;
  const seaGrad = ctx.createLinearGradient(wx(0.5), wy(0.5, horizonV), wx(0.5), wy(0.5, 0));
  seaGrad.addColorStop(0, '#0ea5e9');
  seaGrad.addColorStop(0.45, '#0284c7');
  seaGrad.addColorStop(1, '#075985');
  ctx.fillStyle = seaGrad;
  ctx.beginPath();
  ctx.moveTo(wx(-0.02), wy(-0.02, horizonV));
  ctx.lineTo(wx(1.02), wy(1.02, horizonV));
  ctx.lineTo(wx(1.02), wy(1.02, -0.05));
  ctx.lineTo(wx(-0.02), wy(-0.02, -0.05));
  ctx.closePath();
  ctx.fill();

  // Horizon atmospheric glow line
  ctx.strokeStyle = 'rgba(254, 240, 138, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(wx(0), wy(0, horizonV));
  ctx.lineTo(wx(1), wy(1, horizonV));
  ctx.stroke();

  // Golden sun reflections shimmering down along the sun's water column (parallel to window sill)
  for (let r = 0; r < 6; r++) {
    const rv = horizonV - 0.04 - r * 0.048;
    const waveOffset = Math.sin(frame * 0.07 + r * 1.4) * 0.015;
    const halfSpan = 0.055 - r * 0.006;
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.65)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(wx(0.29 - halfSpan + waveOffset), wy(0.29 - halfSpan + waveOffset, rv));
    ctx.lineTo(wx(0.29 + halfSpan + waveOffset), wy(0.29 + halfSpan + waveOffset, rv));
    ctx.stroke();
  }

  // D) Mount Vesuvius (Il Vesuvio - Monte Somma + Gran Cono) anchored directly onto horizonV!
  ctx.beginPath();
  ctx.moveTo(wx(0.42), wy(0.42, horizonV));
  ctx.lineTo(wx(0.55), wy(0.55, 0.56));
  ctx.lineTo(wx(0.59), wy(0.59, 0.52));
  ctx.lineTo(wx(0.68), wy(0.68, 0.72)); // Left crater rim
  ctx.lineTo(wx(0.74), wy(0.74, 0.70)); // Right crater rim
  ctx.lineTo(wx(0.92), wy(0.92, horizonV));
  ctx.closePath();
  ctx.fillStyle = '#3b0764';
  ctx.fill();

  // Sunset rim highlight on sun-facing left slopes of Vesuvius
  ctx.beginPath();
  ctx.moveTo(wx(0.42), wy(0.42, horizonV));
  ctx.lineTo(wx(0.55), wy(0.55, 0.56));
  ctx.lineTo(wx(0.59), wy(0.59, 0.52));
  ctx.lineTo(wx(0.68), wy(0.68, 0.72));
  ctx.lineTo(wx(0.64), wy(0.64, horizonV));
  ctx.closePath();
  ctx.fillStyle = 'rgba(234, 88, 12, 0.35)';
  ctx.fill();

  // Animated Volcanic Crater Smoke Plume drifting eastward
  const smokePhase = (frame * 0.006) % 1;
  ctx.beginPath();
  ctx.ellipse(
    wx(0.71 + smokePhase * 0.05),
    wy(0.71, 0.75 + smokePhase * 0.14),
    6 + smokePhase * 7,
    3.5 + smokePhase * 2,
    -0.35,
    0,
    PI2
  );
  ctx.fillStyle = `rgba(254, 240, 138, ${0.42 * (1 - smokePhase * 0.7)})`;
  ctx.fill();

  // E) Posillipo Promontory & Castel dell'Ovo Silhouette aligned cleanly on sea horizon
  ctx.fillStyle = '#1e1b4b';
  ctx.beginPath();
  ctx.moveTo(wx(0.0), wy(0.0, horizonV + 0.06));
  ctx.lineTo(wx(0.14), wy(0.14, horizonV + 0.01));
  ctx.lineTo(wx(0.22), wy(0.22, horizonV - 0.02));
  ctx.lineTo(wx(0.0), wy(0.0, horizonV - 0.06));
  ctx.closePath();
  ctx.fill();

  // Castel dell'Ovo battlements
  ctx.fillRect(wx(0.09) - 5, wy(0.09, horizonV + 0.02) - 4, 10, 6);
  ctx.fillRect(wx(0.11) - 3, wy(0.11, horizonV + 0.04) - 6, 5, 6);

  // Subtle diagonal glass glare
  ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.beginPath();
  ctx.moveTo(wx(0.08), wy(0.08, 1));
  ctx.lineTo(wx(0.19), wy(0.19, 1));
  ctx.lineTo(wx(0.09), wy(0.09, 0));
  ctx.lineTo(wx(0.02), wy(0.02, 0));
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  // Window Cast-Iron Frame, Transom & Vertical Mullions
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(wx(0), wy(0, 1));
  ctx.lineTo(wx(1), wy(1, 1));
  ctx.lineTo(wx(1), wy(1, 0));
  ctx.lineTo(wx(0), wy(0, 0));
  ctx.closePath();
  ctx.stroke();

  // Isometric interior windowsill ledge
  ctx.beginPath();
  ctx.moveTo(wx(0), wy(0, 0));
  ctx.lineTo(wx(1), wy(1, 0));
  ctx.lineTo(wx(1) + 6, wy(1, 0) + 3);
  ctx.lineTo(wx(0) + 6, wy(0, 0) + 3);
  ctx.closePath();
  ctx.fillStyle = '#94a3b8';
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Window Pane Mullions (3 vertical bays + upper transom bar)
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(wx(0.34), wy(0.34, 1));
  ctx.lineTo(wx(0.34), wy(0.34, 0));
  ctx.moveTo(wx(0.67), wy(0.67, 1));
  ctx.lineTo(wx(0.67), wy(0.67, 0));
  ctx.moveTo(wx(0), wy(0, 0.77));
  ctx.lineTo(wx(1), wy(1, 0.77));
  ctx.stroke();

  // --- RIGHT WALL (Bright Terracotta Loft Wall) ---
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

  // Subtle horizontal masonry lines aligned along right wall slope
  ctx.strokeStyle = 'rgba(124, 45, 18, 0.55)';
  ctx.lineWidth = 1;
  for (let h = 22; h < wallH - 10; h += 22) {
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y - h);
    ctx.lineTo(rightEnd.x, rightEnd.y - h);
    ctx.stroke();
  }

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

  // Stepped Right Wall Baseboard (Upper Mezzanine gx: 0..5 raised, Lower Vestibule gx: 5..8 at 0)
  ctx.fillStyle = '#451a03';
  ctx.beginPath();
  ctx.moveTo(origin.x, origin.y - ELEVATION_H);
  ctx.lineTo(origin.x, origin.y - ELEVATION_H - 11);
  ctx.lineTo(mezzRightEnd.x, mezzRightEnd.y - ELEVATION_H - 11);
  ctx.lineTo(mezzRightEnd.x, mezzRightEnd.y - ELEVATION_H);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(mezzRightEnd.x, mezzRightEnd.y);
  ctx.lineTo(mezzRightEnd.x, mezzRightEnd.y - 11);
  ctx.lineTo(rightEnd.x, rightEnd.y - 11);
  ctx.lineTo(rightEnd.x, rightEnd.y);
  ctx.closePath();
  ctx.fill();

  // --- POSTER 1: SSC Napoli Scudetto & Cornetto (Above Upper Mezzanine) ---
  const posNap = gridToScreen(1.75, 0, canvasW, ELEVATION_H);
  ctx.save();
  ctx.transform(1, 0.5, 0, 1, posNap.x - 20, posNap.y - 112);
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.fillRect(3, 3, 40, 48);
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(0, 0, 40, 48);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.2;
  ctx.strokeRect(0, 0, 40, 48);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', 20, 34);
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.moveTo(32, 4);
  ctx.quadraticCurveTo(39, 16, 34, 25);
  ctx.lineTo(30, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // --- POSTER 2: "Futuro Remoto 2026" (Above Admin Desk on Mezzanine Wall) ---
  const posFut = gridToScreen(4.15, 0, canvasW, ELEVATION_H);
  ctx.save();
  ctx.transform(1, 0.5, 0, 1, posFut.x - 28, posFut.y - 108);
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.fillRect(3, 3, 60, 40);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 60, 40);
  ctx.strokeStyle = '#00bceb';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, 60, 40);
  ctx.fillStyle = '#00bceb';
  ctx.font = 'bold 7px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('FUTURO REMOTO', 30, 13);
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 6.2px monospace';
  ctx.fillText('BIG HACK 2026', 30, 24);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '5.2px monospace';
  ctx.fillText('Città della Scienza', 30, 34);
  ctx.restore();
};

// Helper: draw one isometric floor diamond at (c, r) with given elevation
const drawIsoFloorTile = (
  ctx: CanvasRenderingContext2D,
  c: number,
  r: number,
  originX: number,
  halfW: number,
  halfH: number,
  elevPx: number
) => {
  const ptX = (c - r) * halfW + originX;
  const ptY = (c + r) * halfH + ORIGIN_Y - elevPx;
  ctx.beginPath();
  ctx.moveTo(ptX, ptY);
  ctx.lineTo(ptX + halfW, ptY + halfH);
  ctx.lineTo(ptX, ptY + TILE_H);
  ctx.lineTo(ptX - halfW, ptY + halfH);
  ctx.closePath();
  return { ptX, ptY };
};

// 2. Two-Level Split Parquet Floor (Raised Tech Mezzanine + Steps + Main Lounge Floor)
export const drawWarmParquetFloor = (
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  tgt: TilePos | null,
  frame: number = 0
) => {
  const originX = canvasW * 0.5;
  const halfW = TILE_W * 0.5; // 48
  const halfH = TILE_H * 0.5; // 24
  const tgtC = tgt ? Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(tgt.x))) : -1;
  const tgtR = tgt ? Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(tgt.y))) : -1;

  // --- PASS 1: LOWER MAIN FLOOR & ELEVATOR VESTIBULE (elev = 0) ---
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (c < MEZZ_MAX_X && r < MEZZ_MAX_Y) continue; // Upper platform drawn in Pass 3

      const { ptX, ptY } = drawIsoFloorTile(ctx, c, r, originX, halfW, halfH, 0);
      const isAlternate = (c + r) % 2 === 0;
      const isRug = c >= 3 && c <= 5 && r >= 4 && r <= 6;

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

      // Sunset specular sheen from panoramic window (gy: 3.3..7.4)
      if (c <= 5 && r >= 3 && r <= 7) {
        const beamDist = Math.abs((r - 5.0) - c * 0.25);
        if (beamDist < 2.8) {
          const falloff = (1 - c / 6.2) * (1 - beamDist / 2.8);
          const shimmer = Math.sin(frame * 0.04 + c * 0.7 + r * 0.5) * 0.035;
          const sheenAlpha = Math.max(0, Math.min(0.24, falloff * 0.2 + shimmer));
          if (sheenAlpha > 0.015) {
            ctx.fillStyle = COLOR_SUNSET_SHEEN;
            ctx.globalAlpha = sheenAlpha;
            ctx.fill();
            ctx.strokeStyle = COLOR_SUNSET_GLINT;
            ctx.lineWidth = 1.1;
            ctx.globalAlpha = sheenAlpha * 1.4;
            ctx.beginPath();
            ctx.moveTo(ptX - halfW, ptY + halfH);
            ctx.lineTo(ptX, ptY);
            ctx.stroke();
            ctx.globalAlpha = 1.0;
          }
        }
      }

      if (tgt && tgtC === c && tgtR === r) {
        ctx.fillStyle = COLOR_TARGET_FILL;
        ctx.fill();
        ctx.strokeStyle = COLOR_TARGET_STROKE;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    }
  }

  // --- PASS 2: MEZZANINE PLATFORM VERTICAL RISER WALLS ---
  // Front edge along gy = 3.0 (gx: 0..5)
  const pFrontL = gridToScreen(0, MEZZ_MAX_Y, canvasW, 0);
  const pFrontR = gridToScreen(MEZZ_MAX_X, MEZZ_MAX_Y, canvasW, 0);
  ctx.beginPath();
  ctx.moveTo(pFrontL.x, pFrontL.y);
  ctx.lineTo(pFrontL.x, pFrontL.y - ELEVATION_H);
  ctx.lineTo(pFrontR.x, pFrontR.y - ELEVATION_H);
  ctx.lineTo(pFrontR.x, pFrontR.y);
  ctx.closePath();
  ctx.fillStyle = '#1e293b';
  ctx.fill();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Warm recessed LED strip under front lip
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pFrontL.x, pFrontL.y - ELEVATION_H + 3);
  ctx.lineTo(pFrontR.x, pFrontR.y - ELEVATION_H + 3);
  ctx.stroke();

  // Side edge along gx = 5.0 (gy: 0..3)
  const pSideTop = gridToScreen(MEZZ_MAX_X, 0, canvasW, 0);
  ctx.beginPath();
  ctx.moveTo(pSideTop.x, pSideTop.y);
  ctx.lineTo(pSideTop.x, pSideTop.y - ELEVATION_H);
  ctx.lineTo(pFrontR.x, pFrontR.y - ELEVATION_H);
  ctx.lineTo(pFrontR.x, pFrontR.y);
  ctx.closePath();
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  ctx.strokeStyle = '#020617';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // --- PASS 3: UPPER RAISED TECH MEZZANINE TILES (c: 0..4, r: 0..2, elev = ELEVATION_H) ---
  for (let r = 0; r < MEZZ_MAX_Y; r++) {
    for (let c = 0; c < MEZZ_MAX_X; c++) {
      drawIsoFloorTile(ctx, c, r, originX, halfW, halfH, ELEVATION_H);
      const isAlternate = (c + r) % 2 === 0;
      ctx.fillStyle = isAlternate ? '#334155' : '#263244';
      ctx.fill();
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.stroke();

      if (tgt && tgtC === c && tgtR === r) {
        ctx.fillStyle = COLOR_TARGET_FILL;
        ctx.fill();
        ctx.strokeStyle = COLOR_TARGET_STROKE;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    }
  }

  // --- PASS 4: TWO WIDE ISOMETRIC STEPS CONNECTING MEZZANINE TO LOWER FLOOR (gx: 2.0..3.8, gy: 2.4..3.0) ---
  const steps = [
    { y0: STAIR_START_Y, y1: 2.7, topElev: 12, riserH: 6 },
    { y0: 2.7, y1: MEZZ_MAX_Y, topElev: 6, riserH: 6 }
  ];
  for (const st of steps) {
    const tTL = gridToScreen(STAIR_MIN_X, st.y0, canvasW, st.topElev);
    const tTR = gridToScreen(STAIR_MAX_X, st.y0, canvasW, st.topElev);
    const tBR = gridToScreen(STAIR_MAX_X, st.y1, canvasW, st.topElev);
    const tBL = gridToScreen(STAIR_MIN_X, st.y1, canvasW, st.topElev);

    // Step tread
    ctx.beginPath();
    ctx.moveTo(tTL.x, tTL.y);
    ctx.lineTo(tTR.x, tTR.y);
    ctx.lineTo(tBR.x, tBR.y);
    ctx.lineTo(tBL.x, tBL.y);
    ctx.closePath();
    ctx.fillStyle = '#475569';
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Step riser
    ctx.beginPath();
    ctx.moveTo(tBL.x, tBL.y);
    ctx.lineTo(tBR.x, tBR.y);
    ctx.lineTo(tBR.x, tBR.y + st.riserH);
    ctx.lineTo(tBL.x, tBL.y + st.riserH);
    ctx.closePath();
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.stroke();

    // Subtle glowing amber/cyan stair nosing line
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(tBL.x + 2, tBL.y);
    ctx.lineTo(tBR.x - 2, tBR.y);
    ctx.stroke();
  }
};

// Depth-sortable Glass Balustrade Segments for the Split-Level Mezzanine
export const drawMezzanineFrontRail = (
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  segment: 'left' | 'right',
  tintColor: string = 'rgba(56, 189, 248, 0.16)'
) => {
  const x0 = segment === 'left' ? 0.08 : STAIR_MAX_X + 0.04;
  const x1 = segment === 'left' ? STAIR_MIN_X - 0.04 : MEZZ_MAX_X - 0.02;
  const railH = 22;

  const p0 = gridToScreen(x0, MEZZ_MAX_Y, canvasW, ELEVATION_H);
  const p1 = gridToScreen(x1, MEZZ_MAX_Y, canvasW, ELEVATION_H);

  // Tempered glass pane
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.lineTo(p0.x, p0.y - railH);
  ctx.lineTo(p1.x, p1.y - railH);
  ctx.lineTo(p1.x, p1.y);
  ctx.closePath();
  ctx.fillStyle = tintColor;
  ctx.fill();

  // Brushed aluminum top handrail & bottom shoe
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y - railH);
  ctx.lineTo(p1.x, p1.y - railH);
  ctx.stroke();

  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.stroke();

  // End stanchion posts
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y); ctx.lineTo(p0.x, p0.y - railH);
  ctx.moveTo(p1.x, p1.y); ctx.lineTo(p1.x, p1.y - railH);
  ctx.stroke();
};

export const drawMezzanineSideRail = (
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  tintColor: string = 'rgba(56, 189, 248, 0.16)'
) => {
  const railH = 22;
  const p0 = gridToScreen(MEZZ_MAX_X, 0.08, canvasW, ELEVATION_H);
  const p1 = gridToScreen(MEZZ_MAX_X, MEZZ_MAX_Y - 0.02, canvasW, ELEVATION_H);

  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.lineTo(p0.x, p0.y - railH);
  ctx.lineTo(p1.x, p1.y - railH);
  ctx.lineTo(p1.x, p1.y);
  ctx.closePath();
  ctx.fillStyle = tintColor;
  ctx.fill();

  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y - railH);
  ctx.lineTo(p1.x, p1.y - railH);
  ctx.stroke();

  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.stroke();

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y); ctx.lineTo(p0.x, p0.y - railH);
  ctx.moveTo(p1.x, p1.y); ctx.lineTo(p1.x, p1.y - railH);
  ctx.stroke();
};

// 3. Soft Isometric Sunbeams pouring from Panoramic Window (gy: 3.3..7.4)
export const drawSunlightBeams = (ctx: CanvasRenderingContext2D, canvasW: number) => {
  ctx.save();
  const shafts = [4.0, 5.4, 6.8];
  for (let i = 0; i < shafts.length; i++) {
    const gy = shafts[i];
    const pWin = gridToScreen(0, gy, canvasW);
    const pFloor = gridToScreen(3.4, gy + 0.5, canvasW);
    const grad = ctx.createLinearGradient(pWin.x, pWin.y - 70, pFloor.x, pFloor.y);
    grad.addColorStop(0, 'rgba(254, 215, 170, 0.14)');
    grad.addColorStop(0.55, 'rgba(251, 146, 60, 0.06)');
    grad.addColorStop(1, 'rgba(251, 146, 60, 0)');

    ctx.beginPath();
    ctx.moveTo(pWin.x - 16, pWin.y - 78);
    ctx.lineTo(pWin.x + 22, pWin.y - 58);
    ctx.lineTo(pFloor.x + 40, pFloor.y + 18);
    ctx.lineTo(pFloor.x - 22, pFloor.y - 6);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
  }
  ctx.restore();
};

// 4. Chunky 3D Isometric Server Rack (Catalyst 9300)
export const drawChunkyServerRack = (
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  canvasW: number,
  done: boolean,
  frame: number
) => {
  const pt = gridToScreen(gx, gy, canvasW, getElevationAt(gx, gy));
  const bcx = pt.x;
  const bcy = pt.y + 18;
  const rx = 20;
  const ly = 20;
  const h = 92;

  // Isometric floor contact shadow
  ctx.beginPath();
  ctx.ellipse(bcx + 4, bcy + 4, 34, 15, 0, 0, PI2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
  ctx.fill();

  // Main 3D Steel Enclosure
  drawIsoPrism(ctx, bcx, bcy, rx, ly, h, '#334155', '#0f172a', '#1e293b', '#020617');

  // Top Cooling Fan Vent Grille (isometric diamond inset)
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.moveTo(bcx, bcy - h - 14);
  ctx.lineTo(bcx + 22, bcy - h - 3);
  ctx.lineTo(bcx, bcy - h + 8);
  ctx.lineTo(bcx - 22, bcy - h - 3);
  ctx.closePath();
  ctx.fill();

  // Left-Front Glass Rack Panel (+gx face, slope +0.5) showing switches & blinkenlights
  const leftCornerX = bcx - rx - ly;
  const leftCornerY = bcy - 0.5 * (rx - ly);
  ctx.save();
  ctx.transform(1, 0.5, 0, 1, leftCornerX + 4, leftCornerY - h + 6);
  const panelW = 32;
  const panelH = h - 12;
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, panelW, panelH);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, panelW, panelH);

  for (let i = 0; i < 5; i++) {
    const uy = 5 + i * 15;
    ctx.fillStyle = i === 2 ? '#0369a1' : '#1e293b';
    ctx.fillRect(3, uy, panelW - 6, 11);
    const isGreen = done || (i % 2 === 0 ? frame % 28 < 16 : frame % 36 < 20);
    ctx.fillStyle = isGreen ? '#10b981' : '#f59e0b';
    for (let l = 0; l < 4; l++) {
      ctx.fillRect(5 + l * 5.5, uy + 4, 2.5, 2.5);
    }
  }

  // Fiber Optic Patch Cables
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = '#00bceb';
  ctx.beginPath();
  ctx.moveTo(9, 26);
  ctx.bezierCurveTo(2, 42, 13, 52, 10, 62);
  ctx.stroke();

  ctx.strokeStyle = '#f59e0b';
  ctx.beginPath();
  ctx.moveTo(22, 26);
  ctx.bezierCurveTo(28, 40, 18, 52, 20, 62);
  ctx.stroke();

  // Glass Reflection Highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(16, 0);
  ctx.lineTo(0, panelH * 0.75);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Lucky Neapolitan Cornetto hanging on right side bevel
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.moveTo(bcx + 4, bcy - h + 22);
  ctx.quadraticCurveTo(bcx + 12, bcy - h + 32, bcx + 5, bcy - h + 40);
  ctx.lineTo(bcx + 2, bcy - h + 26);
  ctx.closePath();
  ctx.fill();

  drawQuestBadge(ctx, bcx, bcy - h - 28, done, '#451a03', '#f59e0b', '#fbbf24');
};

// 5. Chunky 3D Isometric Admin Workstation Desk (Dual Monitors along +gx wall + Ergonomic Chair)
export const drawChunkyAdminDesk = (
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  canvasW: number,
  done: boolean,
  frame: number = 0,
  hideChair: boolean = false
) => {
  const elev = getElevationAt(gx, gy);
  const pt = gridToScreen(gx, gy, canvasW, elev);
  const bcx = pt.x;
  const bcy = pt.y + 18;
  const rx = 28;
  const ly = 15;
  const legH = 26;
  const topThick = 6;

  // Isometric desk floor shadow
  ctx.beginPath();
  ctx.ellipse(bcx, bcy + 4, 48, 18, 0, 0, PI2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fill();

  // Isometric Steel Legs
  const cLeftX = bcx - rx - ly + 6;
  const cLeftY = bcy - 0.5 * (rx - ly) + 1;
  const cFrontX = bcx - ly + rx - 2;
  const cFrontY = bcy + 0.5 * (rx + ly) - 2;
  const cRightX = bcx + rx + ly - 6;
  const cRightY = bcy + 0.5 * (rx - ly) - 1;

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cLeftX, cLeftY); ctx.lineTo(cLeftX, cLeftY - legH);
  ctx.moveTo(cFrontX, cFrontY); ctx.lineTo(cFrontX, cFrontY - legH);
  ctx.moveTo(cRightX, cRightY); ctx.lineTo(cRightX, cRightY - legH);
  ctx.stroke();

  // Warm Walnut Isometric Tabletop Slab at height legH
  drawIsoPrism(ctx, bcx, bcy - legH, rx, ly, topThick, '#92400e', '#78350f', '#451a03', '#451a03');

  const topY = bcy - legH - topThick;

  // -------------------------------------------------------------
  // MONITOR 1 (Left-back on isometric tabletop, CLI Terminal)
  // -------------------------------------------------------------
  ctx.save();
  ctx.transform(1, 0.5, 0, 1, bcx - 24, topY - 40);
  // Stand
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(11, 25, 6, 6);
  ctx.fillRect(7, 30, 14, 3);
  // Bezel
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 28, 25);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, 28, 25);

  const scrX = 2, scrY = 2, scrW = 24, scrH = 21;
  ctx.fillStyle = '#021a0d';
  ctx.fillRect(scrX, scrY, scrW, scrH);

  ctx.save();
  ctx.beginPath();
  ctx.rect(scrX, scrY, scrW, scrH);
  ctx.clip();

  const cliStep = Math.floor(frame / 36);
  ctx.font = '5px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = done ? '#34d399' : '#10b981';
  ctx.fillText(CISCO_IOS_CLI_LINES[cliStep % CISCO_IOS_CLI_LINES.length], scrX + 2, scrY + 6);
  ctx.fillText(CISCO_IOS_CLI_LINES[(cliStep + 1) % CISCO_IOS_CLI_LINES.length], scrX + 2, scrY + 12);
  ctx.fillText(CISCO_IOS_CLI_LINES[(cliStep + 2) % CISCO_IOS_CLI_LINES.length], scrX + 2, scrY + 18);
  if (frame % 30 < 15) {
    ctx.fillRect(scrX + 20, scrY + 14, 2.5, 4);
  }
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  for (let sy = scrY; sy < scrY + scrH; sy += 2) {
    ctx.fillRect(scrX, sy, scrW, 1);
  }
  ctx.restore();
  ctx.restore();

  // -------------------------------------------------------------
  // MONITOR 2 (Right-back on isometric tabletop, Packet Tracer Topology)
  // -------------------------------------------------------------
  ctx.save();
  ctx.transform(1, 0.5, 0, 1, bcx + 10, topY - 23);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(11, 25, 6, 6);
  ctx.fillRect(7, 30, 14, 3);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 28, 25);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, 28, 25);

  const rScrX = 2, rScrY = 2, rScrW = 24, rScrH = 21;
  ctx.fillStyle = '#041628';
  ctx.fillRect(rScrX, rScrY, rScrW, rScrH);

  ctx.save();
  ctx.beginPath();
  ctx.rect(rScrX, rScrY, rScrW, rScrH);
  ctx.clip();

  const n0x = rScrX + 12, n0y = rScrY + 5;
  const n1x = rScrX + 5, n1y = rScrY + 15;
  const n2x = rScrX + 19, n2y = rScrY + 15;
  const n3x = rScrX + 19, n3y = rScrY + 6;

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(n0x, n0y); ctx.lineTo(n1x, n1y);
  ctx.moveTo(n0x, n0y); ctx.lineTo(n2x, n2y);
  ctx.moveTo(n1x, n1y); ctx.lineTo(n2x, n2y);
  ctx.moveTo(n0x, n0y); ctx.lineTo(n3x, n3y);
  ctx.stroke();

  const t1 = (frame * 0.04) % 1.0;
  const t2 = (frame * 0.04 + 0.5) % 1.0;
  ctx.fillStyle = done ? '#34d399' : '#fef08a';
  ctx.fillRect(n0x + (n1x - n0x) * t1 - 1, n0y + (n1y - n0y) * t1 - 1, 2, 2);
  ctx.fillRect(n0x + (n2x - n0x) * t2 - 1, n0y + (n2y - n0y) * t2 - 1, 2, 2);

  ctx.fillStyle = '#38bdf8';
  ctx.beginPath(); ctx.arc(n0x, n0y, 2.2, 0, PI2); ctx.fill();
  ctx.fillStyle = '#10b981';
  ctx.fillRect(n1x - 2, n1y - 1.5, 4, 3);
  ctx.fillRect(n2x - 2, n2y - 1.5, 4, 3);
  ctx.fillStyle = '#a855f7';
  ctx.fillRect(n3x - 1.5, n3y - 2, 3, 4);
  ctx.restore();
  ctx.restore();

  // Isometric Keyboard & Mouse on front desk surface
  ctx.save();
  ctx.transform(1, 0.5, 0, 1, bcx - 12, topY - 4);
  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 0, 20, 7);
  ctx.fillStyle = '#64748b';
  ctx.fillRect(23, 1, 4, 6);
  ctx.restore();

  // Steaming Espresso Ceramic Cup on left corner of desk
  const cupX = bcx - 26;
  const cupY = topY - 2;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(cupX, cupY - 7, 7, 8);
  ctx.fillStyle = '#3e1c00';
  ctx.fillRect(cupX + 1, cupY - 7, 5, 2);
  drawSteamPlume(ctx, cupX + 3, cupY - 9, frame, 5);

  // Chair mat & empty swivel chair in front of desk (facing NE toward monitors when player isn't sitting)
  const chairGx = gx;
  const chairGy = gy + 1.0;
  const chairPt = gridToScreen(chairGx, chairGy, canvasW, getElevationAt(chairGx, chairGy));
  ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
  ctx.beginPath();
  ctx.ellipse(chairPt.x, chairPt.y + 16, 17, 8, 0, 0, PI2);
  ctx.fill();

  if (!hideChair) {
    // 5-star caster base
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(chairPt.x, chairPt.y + 9); ctx.lineTo(chairPt.x, chairPt.y + 16);
    ctx.moveTo(chairPt.x - 10, chairPt.y + 16); ctx.lineTo(chairPt.x + 10, chairPt.y + 14);
    ctx.stroke();

    // Seat cushion
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.ellipse(chairPt.x, chairPt.y + 8, 14, 6.5, 0, 0, PI2);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Chair backrest angled along SW side (facing NE toward monitors)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(chairPt.x - 16, chairPt.y - 16, 18, 20);
    ctx.strokeStyle = '#00bceb';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(chairPt.x - 16, chairPt.y - 16, 18, 20);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(chairPt.x - 13, chairPt.y - 13, 12, 14);
  }

  // Quest Status Badge shifted upper-right clear of sitting player nametag
  drawQuestBadge(ctx, bcx + 26, topY - 40, done, '#451a03', '#f59e0b', '#fbbf24');
};

// 6. Chunky 3D Isometric SOC Threat Wall (angled along +gx / +0.5 facing SW into room)
export const drawChunkySocWall = (
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  canvasW: number,
  done: boolean,
  frame: number
) => {
  const pt = gridToScreen(gx, gy, canvasW, getElevationAt(gx, gy));
  const bcx = pt.x;
  const bcy = pt.y + 18;
  const rx = 25;
  const ly = 9;
  const baseH = 18;
  const scrH = 48;

  // Floor contact shadow
  ctx.beginPath();
  ctx.ellipse(bcx, bcy + 4, 34, 15, 0, 0, PI2);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fill();

  // 3D Isometric Pedestal Base + Display Chassis
  drawIsoPrism(ctx, bcx, bcy, rx - 3, ly, baseH, '#334155', '#1e293b', '#0f172a', '#020617');
  const dispBaseY = bcy - baseH;
  drawIsoPrism(ctx, bcx, dispBaseY, rx, ly - 1, scrH, '#1e293b', '#020617', '#0f172a', '#020617');

  // Isometric Screen on the wide Left-Front Face (slope +0.5, facing SW toward room)
  const leftCornerX = bcx - rx - (ly - 1);
  const leftCornerY = dispBaseY - 0.5 * (rx - (ly - 1));
  const sw = rx * 2 - 6; // 44px skewed across +gx face
  const sh = scrH - 8;   // 40px

  ctx.save();
  ctx.transform(1, 0.5, 0, 1, leftCornerX + 3, leftCornerY - scrH + 4);

  const alertBorder = !done && ((frame % 20) < 10);
  ctx.fillStyle = '#051024';
  ctx.fillRect(0, 0, sw, sh);
  ctx.strokeStyle = done ? '#38bdf8' : (alertBorder ? '#ef4444' : '#991b1b');
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, sw, sh);

  ctx.save();
  ctx.beginPath();
  ctx.rect(1, 1, sw - 2, sh - 2);
  ctx.clip();

  // Header + Blinking LED
  ctx.font = 'bold 4.8px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = done ? '#38bdf8' : '#f87171';
  ctx.fillText('SOC THREAT', 2, 6);
  ctx.fillStyle = done ? '#10b981' : ((frame % 24) < 12 ? '#ef4444' : '#7f1d1d');
  ctx.beginPath();
  ctx.arc(sw - 4, 4.5, 1.8, 0, PI2);
  ctx.fill();

  // Left: Rotating Radar Scope
  const rcx = 11;
  const rcy = 20;
  const radR = 8.5;
  ctx.strokeStyle = done ? 'rgba(56, 189, 248, 0.35)' : 'rgba(239, 68, 68, 0.35)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(rcx, rcy, radR, 0, PI2);
  ctx.arc(rcx, rcy, 4.2, 0, PI2);
  ctx.stroke();

  const rAngle = (frame * 0.05) % PI2;
  ctx.strokeStyle = done ? '#38bdf8' : '#ef4444';
  ctx.beginPath();
  ctx.moveTo(rcx, rcy);
  ctx.lineTo(rcx + Math.cos(rAngle) * radR, rcy + Math.sin(rAngle) * radR);
  ctx.stroke();

  ctx.fillStyle = done ? 'rgba(56, 189, 248, 0.14)' : 'rgba(239, 68, 68, 0.14)';
  ctx.beginPath();
  ctx.moveTo(rcx, rcy);
  ctx.arc(rcx, rcy, radR, rAngle - 0.5, rAngle);
  ctx.closePath();
  ctx.fill();

  for (let b = 0; b < 3; b++) {
    const diff = ((rAngle - SOC_BLIP_ANGLES[b]) % PI2 + PI2) % PI2;
    if (diff < 1.4) {
      const alphaStep = Math.min(3, Math.floor((1 - diff / 1.4) * 4));
      ctx.fillStyle = done ? SOC_BLIP_COLORS_SAFE[alphaStep] : SOC_BLIP_COLORS_ALERT[alphaStep];
      ctx.beginPath();
      ctx.arc(rcx + SOC_BLIP_DX[b] * 0.7, rcy + SOC_BLIP_DY[b] * 0.7, 1.3, 0, PI2);
      ctx.fill();
    }
  }

  // Right: Live Equalizer Bars + Scrolling Feed
  for (let b = 0; b < 5; b++) {
    const bx = 22 + b * 4;
    const barVal = 2.5 + Math.sin(frame * 0.14 + b * 1.3) * 2.5 + Math.sin(frame * 0.28 + b * 2.5) * 1.5;
    const bh = Math.max(2, Math.min(9, barVal));
    ctx.fillStyle = done ? '#06b6d4' : (b >= 3 ? '#ef4444' : '#f59e0b');
    ctx.fillRect(bx, 19 - bh, 2.8, bh);
  }

  const feedIdx = Math.floor(frame / 32) % SOC_THREAT_FEEDS.length;
  ctx.font = '4px monospace';
  ctx.fillStyle = done ? '#34d399' : '#fbbf24';
  ctx.fillText(SOC_THREAT_FEEDS[feedIdx].slice(0, 10), 22, 25);

  ctx.font = 'bold 4.8px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = done ? '#34d399' : '#ef4444';
  ctx.fillText(done ? 'UMBRELLA OK' : 'C2 ALERT!', sw / 2, sh - 3);
  ctx.restore();
  ctx.restore();

  drawQuestBadge(ctx, bcx, dispBaseY - scrH - 18, done, '#450a0a', '#ef4444', '#f87171');
};

// 7. Chunky 3D Isometric Neapolitan Bar & Pizza Counter (aligned along +gy left perimeter)
export const drawChunkyNeapolitanBar = (
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  canvasW: number,
  frame: number = 0
) => {
  const pt = gridToScreen(gx, gy, canvasW, getElevationAt(gx, gy));
  const bcx = pt.x;
  const bcy = pt.y + 18;
  const rx = 16;
  const ly = 28;
  const h = 30;

  // Floor shadow
  ctx.beginPath();
  ctx.ellipse(bcx, bcy + 4, 42, 16, 0, 0, PI2);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fill();

  // Wooden Base Counter + Marble Isometric Top Cap
  drawIsoPrism(ctx, bcx, bcy, rx, ly, h - 5, '#92400e', '#78350f', '#451a03', '#451a03');
  drawIsoPrism(ctx, bcx, bcy - (h - 5), rx + 2, ly + 2, 5, '#f8fafc', '#e2e8f0', '#cbd5e1', '#64748b');

  const topY = bcy - h;

  // Faema E61 Isometric Espresso Machine on back-half of bar
  drawIsoPrism(ctx, bcx + 12, topY - 4, 9, 10, 18, '#e2e8f0', '#94a3b8', '#64748b', '#334155');
  // Control badge
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(bcx + 8, topY - 12, 8, 5);

  // Ceramic Espresso Cup with Crema & Steam on center counter
  const cupX = bcx - 2;
  const cupY = topY - 2;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(cupX - 3, cupY - 5, 7, 7);
  ctx.fillStyle = '#3e1c00';
  ctx.fillRect(cupX - 2, cupY - 5, 5, 2);
  drawSteamPlume(ctx, cupX, cupY - 7, frame, 6);
  drawSteamPlume(ctx, bcx + 12, topY - 22, frame + 30, 4);

  // Open Isometric Pizza Box on front-left corner of counter
  const px = bcx - 18;
  const py = topY + 6;
  drawIsoPrism(ctx, px, py, 9, 9, 3, '#fef08a', '#eab308', '#ca8a04', '#dc2626');
  // Margherita Pizza Disc inside
  ctx.fillStyle = '#ea580c';
  ctx.beginPath();
  ctx.ellipse(px, py - 3, 6, 3.2, 0, 0, PI2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(px - 2, py - 4, 2, 2);
  ctx.fillRect(px + 1, py - 3, 2, 2);
  ctx.fillStyle = '#16a34a';
  ctx.fillRect(px - 1, py - 3, 2, 1.5);
};

// 8. Isometric Cisco Certification Showcase Cabinet
export const drawChunkyTrophyShowcase = (
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  canvasW: number
) => {
  const pt = gridToScreen(gx, gy, canvasW);
  const bcx = pt.x;
  const bcy = pt.y + 18;
  const h = 58;

  ctx.beginPath();
  ctx.ellipse(bcx, bcy + 4, 28, 12, 0, 0, PI2);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fill();

  drawIsoPrism(ctx, bcx, bcy, 17, 13, h, '#312e81', '#1e1b4b', '#0f172a', '#ca8a04');

  // Gold Certification Plaques inside front glass pane
  const leftCornerX = bcx - 17 - 13;
  const leftCornerY = bcy - 0.5 * (17 - 13);
  ctx.save();
  ctx.transform(1, 0.5, 0, 1, leftCornerX + 4, leftCornerY - h + 6);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(0, 0, 26, h - 12);
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, 26, h - 12);

  // Shelves & trophies
  ctx.strokeStyle = '#64748b';
  ctx.beginPath();
  ctx.moveTo(2, 16); ctx.lineTo(24, 16);
  ctx.moveTo(2, 32); ctx.lineTo(24, 32);
  ctx.stroke();

  ctx.fillStyle = '#eab308';
  ctx.beginPath();
  ctx.arc(8, 10, 3.5, 0, PI2);
  ctx.arc(18, 10, 3.5, 0, PI2);
  ctx.arc(13, 25, 4.2, 0, PI2);
  ctx.fill();
  ctx.restore();
};

// 10. Large 3D Isometric Terracotta Monstera Plant
export const drawChunkyMonstera = (
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  canvasW: number
) => {
  const pt = gridToScreen(gx, gy, canvasW, getElevationAt(gx, gy));
  const bcx = pt.x;
  const bcy = pt.y + 18;

  ctx.beginPath();
  ctx.ellipse(bcx, bcy + 3, 20, 9, 0, 0, PI2);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fill();

  drawIsoPrism(ctx, bcx, bcy, 9, 9, 18, '#78350f', '#b45309', '#92400e', '#451a03');
  drawIsoPrism(ctx, bcx, bcy - 16, 11, 11, 4, '#92400e', '#d97706', '#b45309', '#78350f');

  // Layered Monstera Canopy
  ctx.fillStyle = '#166534';
  ctx.beginPath();
  ctx.ellipse(bcx - 13, bcy - 30, 14, 8, -0.45, 0, PI2);
  ctx.ellipse(bcx + 13, bcy - 31, 14, 8, 0.45, 0, PI2);
  ctx.fill();
  ctx.fillStyle = '#15803d';
  ctx.beginPath();
  ctx.ellipse(bcx - 5, bcy - 40, 13, 8, -0.25, 0, PI2);
  ctx.ellipse(bcx + 6, bcy - 39, 13, 8, 0.25, 0, PI2);
  ctx.fill();
  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.ellipse(bcx, bcy - 46, 11, 7, 0, 0, PI2);
  ctx.fill();
};

// ==========================================
// ROOM 2: UNDERGROUND DATACENTER & VAULT
// ==========================================

// 11. Heavy Industrial Datacenter Vault Walls (Split-Level Compatible)
export const drawUndergroundDatacenterWalls = (ctx: CanvasRenderingContext2D, canvasW: number, frame: number) => {
  const origin = gridToScreen(0, 0, canvasW);
  const wallH = 175;
  const wallThick = 12;

  const leftEnd = gridToScreen(0, GRID_SIZE, canvasW);
  const rightEnd = gridToScreen(GRID_SIZE, 0, canvasW);
  const mezzLeftEnd = gridToScreen(0, MEZZ_MAX_Y, canvasW);
  const mezzRightEnd = gridToScreen(MEZZ_MAX_X, 0, canvasW);

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

  // Stepped Left Baseboard with Yellow/Black Safety Hazard Stripes
  const drawHazardStrip = (x0: number, y0: number, x1: number, y1: number, slopeDir: number) => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0, y0 - 11);
    ctx.lineTo(x1, y1 - 11);
    ctx.lineTo(x1, y1);
    ctx.closePath();
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    const segs = 7;
    for (let s = 0; s < segs; s++) {
      const tFrac = s / segs;
      const px = x0 + (x1 - x0) * tFrac;
      const py = y0 + (y1 - y0) * tFrac;
      ctx.fillStyle = s % 2 === 0 ? '#eab308' : '#0f172a';
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + 9 * slopeDir, py - 5);
      ctx.lineTo(px + 3 * slopeDir, py - 11);
      ctx.lineTo(px - 5 * slopeDir, py - 5);
      ctx.closePath();
      ctx.fill();
    }
  };

  drawHazardStrip(origin.x, origin.y - ELEVATION_H, mezzLeftEnd.x, mezzLeftEnd.y - ELEVATION_H, 1);
  drawHazardStrip(mezzLeftEnd.x, mezzLeftEnd.y, leftEnd.x, leftEnd.y, 1);

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

  // Stepped Right Baseboard Hazard Stripes
  drawHazardStrip(origin.x, origin.y - ELEVATION_H, mezzRightEnd.x, mezzRightEnd.y - ELEVATION_H, -1);
  drawHazardStrip(mezzRightEnd.x, mezzRightEnd.y, rightEnd.x, rightEnd.y, -1);

  // Subterranean Telemetry Status Panel flush on Right Wall above raised server deck
  const pRightPanel = gridToScreen(4.1, 0, canvasW, ELEVATION_H);
  const panelY = pRightPanel.y - 130;

  ctx.save();
  ctx.transform(1, 0.5, 0, 1, pRightPanel.x - 48, panelY);

  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(3, 3, 108, 60);
  ctx.fillStyle = '#030712';
  ctx.fillRect(0, 0, 108, 60);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, 108, 60);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 8px monospace';
  ctx.fillText('DATACENTER VAULT // -1F', 6, 13);

  ctx.fillStyle = '#10b981';
  ctx.font = '7px monospace';
  ctx.fillText('COOLING: 19.5C [STABLE]', 6, 25);
  ctx.fillText('AIRFLOW: COLD AISLE OK', 6, 36);

  ctx.fillStyle = '#f59e0b';
  ctx.fillText('UPS LOAD: 42% (A+B GRID)', 6, 47);

  // Blinking telemetry dot
  ctx.fillStyle = Math.sin(frame * 0.1) > 0 ? '#ef4444' : '#7f1d1d';
  ctx.beginPath();
  ctx.arc(98, 10, 3.5, 0, PI2);
  ctx.fill();
  ctx.restore();

  // Wall-mounted Industrial Emergency Beacon with steel bracket at (1.5, 0)
  const beaconPos = gridToScreen(1.5, 0, canvasW);
  const by = beaconPos.y - wallH + 34;
  const pulse = 0.5 + 0.5 * Math.sin(frame * 0.09);

  // Steel wall mount plate & arm
  ctx.save();
  ctx.transform(1, 0.5, 0, 1, beaconPos.x - 6, by - 4);
  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 0, 12, 16);
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, 12, 16);
  ctx.restore();

  ctx.fillStyle = '#475569';
  ctx.fillRect(beaconPos.x - 4, by + 2, 8, 5);

  ctx.save();
  ctx.fillStyle = '#ef4444';
  ctx.shadowColor = '#ef4444';
  ctx.shadowBlur = 10 + 10 * pulse;
  ctx.beginPath();
  ctx.arc(beaconPos.x, by, 6, Math.PI, 0);
  ctx.lineTo(beaconPos.x + 6, by + 3);
  ctx.lineTo(beaconPos.x - 6, by + 3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

// 12. Two-Level Raised Datacenter Floor with Perforated Cooling Grilles & Cool Mist Particles
export const drawUndergroundFloor = (
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  tgt: TilePos | null,
  frame: number = 0
) => {
  const originX = canvasW * 0.5;
  const halfW = TILE_W * 0.5; // 48
  const halfH = TILE_H * 0.5; // 24
  const tgtC = tgt ? Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(tgt.x))) : -1;
  const tgtR = tgt ? Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(tgt.y))) : -1;

  const drawVaultTile = (c: number, r: number, elevPx: number, isColdAisle: boolean) => {
    const { ptX, ptY } = drawIsoFloorTile(ctx, c, r, originX, halfW, halfH, elevPx);
    const isAlternate = (c + r) % 2 === 0;

    if (isColdAisle) {
      ctx.fillStyle = isAlternate ? COLOR_VAULT_AISLE_1 : COLOR_VAULT_AISLE_2;
      ctx.fill();

      const pulse = 0.5 + 0.5 * Math.sin(frame * 0.06 + (c + r) * 0.8);
      ctx.strokeStyle = pulse > 0.55 ? COLOR_VAULT_STROKE_PULSE : COLOR_VAULT_STROKE_AISLE;
      ctx.lineWidth = pulse > 0.55 ? 1.8 : 1.5;
      ctx.stroke();

      const glowRadius = 13 + pulse * 5;
      const glowAlpha = 0.18 + pulse * 0.22;
      ctx.fillStyle = COLOR_CYAN_GLOW;
      ctx.globalAlpha = glowAlpha;
      ctx.beginPath();
      ctx.arc(ptX, ptY + halfH, glowRadius, 0, PI2);
      ctx.fill();

      ctx.globalAlpha = 0.6 + pulse * 0.4;
      for (let dx = -8; dx <= 8; dx += 8) {
        for (let dy = -4; dy <= 4; dy += 4) {
          ctx.fillRect(ptX + dx, ptY + halfH + dy, 2, 2);
        }
      }
      ctx.globalAlpha = 1.0;

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

    if (tgt && tgtC === c && tgtR === r) {
      ctx.fillStyle = COLOR_TARGET_CYAN;
      ctx.fill();
      ctx.strokeStyle = COLOR_CYAN_GLOW;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  };

  // Pass 1: Lower Vault Floor
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (c < MEZZ_MAX_X && r < MEZZ_MAX_Y) continue;
      const isColdAisle = c >= 3 && c <= 5 && r >= 4 && r <= 5;
      drawVaultTile(c, r, 0, isColdAisle);
    }
  }

  // Pass 2: Raised Server Deck Risers
  const pFrontL = gridToScreen(0, MEZZ_MAX_Y, canvasW, 0);
  const pFrontR = gridToScreen(MEZZ_MAX_X, MEZZ_MAX_Y, canvasW, 0);
  ctx.beginPath();
  ctx.moveTo(pFrontL.x, pFrontL.y);
  ctx.lineTo(pFrontL.x, pFrontL.y - ELEVATION_H);
  ctx.lineTo(pFrontR.x, pFrontR.y - ELEVATION_H);
  ctx.lineTo(pFrontR.x, pFrontR.y);
  ctx.closePath();
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  const pSideTop = gridToScreen(MEZZ_MAX_X, 0, canvasW, 0);
  ctx.beginPath();
  ctx.moveTo(pSideTop.x, pSideTop.y);
  ctx.lineTo(pSideTop.x, pSideTop.y - ELEVATION_H);
  ctx.lineTo(pFrontR.x, pFrontR.y - ELEVATION_H);
  ctx.lineTo(pFrontR.x, pFrontR.y);
  ctx.closePath();
  ctx.fillStyle = '#090d16';
  ctx.fill();
  ctx.strokeStyle = '#0284c7';
  ctx.stroke();

  // Pass 3: Upper Server Deck Tiles
  for (let r = 0; r < MEZZ_MAX_Y; r++) {
    for (let c = 0; c < MEZZ_MAX_X; c++) {
      const isColdAisle = c >= 1 && c <= 3 && r === 2;
      drawVaultTile(c, r, ELEVATION_H, isColdAisle);
    }
  }

  // Pass 4: Vault Steps
  const steps = [
    { y0: STAIR_START_Y, y1: 2.7, topElev: 12, riserH: 6 },
    { y0: 2.7, y1: MEZZ_MAX_Y, topElev: 6, riserH: 6 }
  ];
  for (const st of steps) {
    const tTL = gridToScreen(STAIR_MIN_X, st.y0, canvasW, st.topElev);
    const tTR = gridToScreen(STAIR_MAX_X, st.y0, canvasW, st.topElev);
    const tBR = gridToScreen(STAIR_MAX_X, st.y1, canvasW, st.topElev);
    const tBL = gridToScreen(STAIR_MIN_X, st.y1, canvasW, st.topElev);
    ctx.beginPath();
    ctx.moveTo(tTL.x, tTL.y);
    ctx.lineTo(tTR.x, tTR.y);
    ctx.lineTo(tBR.x, tBR.y);
    ctx.lineTo(tBL.x, tBL.y);
    ctx.closePath();
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(tBL.x, tBL.y);
    ctx.lineTo(tBR.x, tBR.y);
    ctx.lineTo(tBR.x, tBR.y + st.riserH);
    ctx.lineTo(tBL.x, tBL.y + st.riserH);
    ctx.closePath();
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
};

// 13. Wall-Integrated Flush Isometric Elevator (Recessed Directly Into Right Wall: 1F <-> -1F)
export const drawChunkyIndustrialElevator = (
  ctx: CanvasRenderingContext2D,
  gx: number,
  _gy: number,
  canvasW: number,
  room: 'office' | 'datacenter_vault',
  frame: number
) => {
  const isVault = room === 'datacenter_vault';
  const fw = 52;
  const fh = 104;
  // Anchor directly onto the right wall plane (gy = 0, slope +0.5)
  const wallAnchor = gridToScreen(gx - 0.54, 0, canvasW, 0);

  // Flush floor steel threshold sill projecting minimally onto floor tile (gy: 0..0.28)
  const s0 = gridToScreen(gx - 0.54, 0.0, canvasW, 0);
  const s1 = gridToScreen(gx + 0.54, 0.0, canvasW, 0);
  const s2 = gridToScreen(gx + 0.54, 0.26, canvasW, 0);
  const s3 = gridToScreen(gx - 0.54, 0.26, canvasW, 0);
  ctx.beginPath();
  ctx.moveTo(s0.x, s0.y);
  ctx.lineTo(s1.x, s1.y);
  ctx.lineTo(s2.x, s2.y);
  ctx.lineTo(s3.x, s3.y);
  ctx.closePath();
  ctx.fillStyle = '#475569';
  ctx.fill();
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Tactile floor arrival strip
  ctx.strokeStyle = isVault ? 'rgba(56, 189, 248, 0.55)' : 'rgba(251, 191, 36, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(s3.x + 2, s3.y);
  ctx.lineTo(s2.x - 2, s2.y);
  ctx.stroke();

  ctx.save();
  ctx.transform(1, 0.5, 0, 1, wallAnchor.x, wallAnchor.y - fh);

  // Outer brushed-steel doorframe flush with wall masonry
  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 0, fw, fh);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(0, 0, fw, fh);

  // Subtle recessed inner wall reveal (gives authentic built-into-wall depth!)
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(4, 24, fw - 8, fh - 24);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(4, 24, 3, fh - 24); // left reveal bevel
  ctx.fillRect(4, 24, fw - 8, 3);  // top lintel reveal bevel

  // Integrated Header Transom with Digital Floor Indicator
  ctx.fillStyle = '#020617';
  ctx.fillRect(6, 4, fw - 12, 16);
  ctx.strokeStyle = isVault ? '#38bdf8' : '#f59e0b';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(6, 4, fw - 12, 16);

  ctx.fillStyle = isVault ? '#38bdf8' : '#f59e0b';
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  const arrowBlink = Math.sin(frame * 0.1) > 0 ? (isVault ? '▲' : '▼') : ' ';
  ctx.fillText(isVault ? `-1F ${arrowBlink}` : `1F ${arrowBlink}`, fw / 2, 15);
  ctx.textAlign = 'start';

  // Recessed Stainless Steel Double Sliding Doors
  const doorX = 7;
  const doorY = 27;
  const doorW = (fw - 14) / 2;
  const doorH = fh - doorY;

  ctx.fillStyle = '#64748b';
  ctx.fillRect(doorX, doorY, doorW, doorH);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.strokeRect(doorX, doorY, doorW, doorH);

  ctx.fillStyle = '#475569';
  ctx.fillRect(doorX + doorW, doorY, doorW, doorH);
  ctx.strokeStyle = '#1e293b';
  ctx.strokeRect(doorX + doorW, doorY, doorW, doorH);

  // Brushed metallic vertical sheen & center seam
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.fillRect(doorX + 3, doorY + 4, 3.5, doorH - 8);
  ctx.fillRect(doorX + doorW + 3, doorY + 4, 3.5, doorH - 8);

  ctx.strokeStyle = '#020617';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(doorX + doorW, doorY);
  ctx.lineTo(doorX + doorW, doorY + doorH);
  ctx.stroke();

  // Wall-mounted Call Button Plate on right masonry beside doorframe
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(fw + 3, 52, 8, 18);
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1;
  ctx.strokeRect(fw + 3, 52, 8, 18);

  ctx.fillStyle = isVault ? '#10b981' : '#38bdf8';
  ctx.beginPath();
  ctx.arc(fw + 7, 58, 1.8, 0, PI2);
  ctx.fill();
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(fw + 7, 64, 1.8, 0, PI2);
  ctx.fill();

  ctx.restore();
};

// 14. Chunky 3D Isometric Wireshark DPI Console Workstation (Vector Shark Fin + Hex Dump)
export const drawChunkyWiresharkConsole = (
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  canvasW: number,
  level4Done: boolean,
  frame: number,
  hideChair: boolean = false
) => {
  const pt = gridToScreen(gx, gy, canvasW, getElevationAt(gx, gy));
  const bcx = pt.x;
  const bcy = pt.y + 18;
  const rx = 25;
  const ly = 14;
  const legH = 24;
  const topThick = 6;

  // Floor contact shadow
  ctx.beginPath();
  ctx.ellipse(bcx, bcy + 4, 42, 16, 0, 0, PI2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fill();

  // Carbon Steel Frame Legs
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(bcx - rx - ly + 6, bcy - 0.5 * (rx - ly));
  ctx.lineTo(bcx - rx - ly + 6, bcy - 0.5 * (rx - ly) - legH);
  ctx.moveTo(bcx - ly + rx - 2, bcy + 0.5 * (rx + ly) - 2);
  ctx.lineTo(bcx - ly + rx - 2, bcy + 0.5 * (rx + ly) - 2 - legH);
  ctx.moveTo(bcx + rx + ly - 6, bcy + 0.5 * (rx - ly));
  ctx.lineTo(bcx + rx + ly - 6, bcy + 0.5 * (rx - ly) - legH);
  ctx.stroke();

  // Carbon Desk Slab with Cyan Rim
  drawIsoPrism(ctx, bcx, bcy - legH, rx, ly, topThick, '#1e293b', '#0f172a', '#020617', '#0284c7');

  const topY = bcy - legH - topThick;

  // Ultrawide Isometric DPI Monitor on back edge (+gx plane, slope +0.5)
  ctx.save();
  ctx.transform(1, 0.5, 0, 1, bcx - 21, topY - 40);
  // Stand
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(19, 27, 8, 6);
  ctx.fillRect(14, 32, 18, 3);
  // Bezel
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, 46, 28);
  ctx.strokeStyle = level4Done ? '#10b981' : '#38bdf8';
  ctx.lineWidth = 1.8;
  ctx.strokeRect(0, 0, 46, 28);

  const scrX = 2, scrY = 2, scrW = 42, scrH = 24;
  ctx.fillStyle = '#040d1a';
  ctx.fillRect(scrX, scrY, scrW, scrH);

  ctx.save();
  ctx.beginPath();
  ctx.rect(scrX, scrY, scrW, scrH);
  ctx.clip();

  // Vector Cyan Shark Fin Icon (zero emoji tofu!) + DPI Title
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.moveTo(scrX + 2, scrY + 6.5);
  ctx.quadraticCurveTo(scrX + 4.5, scrY + 1.5, scrX + 7.5, scrY + 1.5);
  ctx.quadraticCurveTo(scrX + 6, scrY + 4.5, scrX + 7.5, scrY + 6.5);
  ctx.closePath();
  ctx.fill();

  ctx.font = 'bold 5px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('DPI', scrX + 9, scrY + 6);

  // 5 Packet Flow Indicators
  const activeStep = Math.floor(frame * 0.22) % 5;
  for (let p = 0; p < 5; p++) {
    const isSuspicious = !level4Done && (p === 2 || p === 4);
    const isActive = p === activeStep;
    ctx.fillStyle = isActive
      ? (isSuspicious ? '#fbbf24' : '#34d399')
      : (isSuspicious ? '#92400e' : '#064e3b');
    ctx.fillRect(scrX + 21 + p * 4, scrY + 2.5, 3, 3);
  }

  // Scrolling Raw Hex Dump
  const hexIdx = Math.floor(frame / 26) % WIRESHARK_HEX_LINES.length;
  ctx.font = '4.3px monospace';
  ctx.fillStyle = level4Done ? '#6ee7b7' : '#94a3b8';
  ctx.fillText(WIRESHARK_HEX_LINES[hexIdx], scrX + 2, scrY + 12.5);
  ctx.fillStyle = level4Done ? '#34d399' : (hexIdx % 2 === 0 ? '#fbbf24' : '#6ee7b7');
  ctx.fillText(WIRESHARK_HEX_LINES[(hexIdx + 1) % WIRESHARK_HEX_LINES.length], scrX + 2, scrY + 18);

  // PCAP Stream Status
  ctx.font = 'bold 4.5px monospace';
  ctx.fillStyle = level4Done ? '#10b981' : '#ef4444';
  ctx.fillText(level4Done ? 'PCAP: FILTER OK' : 'DNS EXFIL ALERT', scrX + 2, scrY + 23);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  for (let ly2 = scrY; ly2 < scrY + scrH; ly2 += 2) {
    ctx.fillRect(scrX, ly2, scrW, 1);
  }
  ctx.restore();
  ctx.restore();

  // Isometric Keyboard
  ctx.save();
  ctx.transform(1, 0.5, 0, 1, bcx - 10, topY - 4);
  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 0, 18, 6);
  ctx.restore();

  // Chair floor mat & empty swivel chair aligned with sit spot (gx, gy + 1.0)
  const chairGx = gx;
  const chairGy = gy + 1.0;
  const chairPt = gridToScreen(chairGx, chairGy, canvasW, getElevationAt(chairGx, chairGy));
  ctx.fillStyle = 'rgba(15, 23, 42, 0.5)';
  ctx.beginPath();
  ctx.ellipse(chairPt.x, chairPt.y + 16, 17, 8, 0, 0, PI2);
  ctx.fill();

  if (!hideChair) {
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(chairPt.x, chairPt.y + 9); ctx.lineTo(chairPt.x, chairPt.y + 16);
    ctx.moveTo(chairPt.x - 10, chairPt.y + 16); ctx.lineTo(chairPt.x + 10, chairPt.y + 14);
    ctx.stroke();

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.ellipse(chairPt.x, chairPt.y + 8, 14, 6.5, 0, 0, PI2);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(chairPt.x - 16, chairPt.y - 16, 18, 20);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(chairPt.x - 16, chairPt.y - 16, 18, 20);
  }

  drawQuestBadge(ctx, bcx + 24, topY - 38, level4Done, '#451a03', '#38bdf8', '#38bdf8');
};

// 15. Cisco Firepower 4100 NGFW Rack (3D Isometric Chassis)
export const drawChunkyFirepowerWall = (
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  canvasW: number,
  frame: number
) => {
  const pt = gridToScreen(gx, gy, canvasW, getElevationAt(gx, gy));
  const bcx = pt.x;
  const bcy = pt.y + 18;
  const rx = 24;
  const ly = 14;
  const h = 68;

  ctx.beginPath();
  ctx.ellipse(bcx, bcy + 4, 34, 14, 0, 0, PI2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fill();

  drawIsoPrism(ctx, bcx, bcy, rx, ly, h, '#334155', '#1e293b', '#0f172a', '#020617');

  // Isometric Front Appliance Face (+gx face, slope +0.5)
  const leftCornerX = bcx - rx - ly;
  const leftCornerY = bcy - 0.5 * (rx - ly);
  const fw = rx * 2;
  ctx.save();
  ctx.transform(1, 0.5, 0, 1, leftCornerX + 4, leftCornerY - h + 6);

  // Firepower Cyan Banner
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(0, 0, fw - 8, 10);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 5.5px monospace';
  ctx.fillText('FIREPOWER 4100', 2, 7.5);

  // Dual Intake Fan Grilles
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(12, 26, 7.5, 0, PI2);
  ctx.arc(29, 26, 7.5, 0, PI2);
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Blinking IPS Threat Inspection LEDs
  for (let i = 0; i < 6; i++) {
    const isGreen = ((frame + i * 5) % 15) < 8;
    ctx.fillStyle = isGreen ? '#10b981' : '#f59e0b';
    ctx.fillRect(2 + i * 6, 44, 4, 3);
  }
  ctx.restore();
};

// 16. Cisco UCS SAN Storage Vault (3D Isometric Storage Array)
export const drawChunkySanVault = (
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  canvasW: number,
  frame: number
) => {
  const pt = gridToScreen(gx, gy, canvasW, getElevationAt(gx, gy));
  const bcx = pt.x;
  const bcy = pt.y + 18;
  const rx = 18;
  const ly = 22;
  const h = 66;

  ctx.beginPath();
  ctx.ellipse(bcx, bcy + 4, 34, 14, 0, 0, PI2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fill();

  drawIsoPrism(ctx, bcx, bcy, rx, ly, h, '#334155', '#0f172a', '#1e293b', '#0284c7');

  // Drive Bays on Right-Front SE Face (+gy face, slope -0.5) facing center room!
  const fx = bcx - ly + rx;
  const fy = bcy + 0.5 * (rx + ly);
  const bayW = ly * 2 - 8;

  ctx.save();
  ctx.transform(1, -0.5, 0, 1, fx + 4, fy - h + 6);
  for (let r = 0; r < 4; r++) {
    const rowY = r * 13;
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, rowY, bayW, 10);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(0, rowY, bayW, 10);

    for (let d = 0; d < 4; d++) {
      const isRead = ((frame + r * 7 + d * 3) % 20) < 10;
      ctx.fillStyle = isRead ? '#38bdf8' : '#0369a1';
      ctx.fillRect(3 + d * 8.5, rowY + 3.5, 4, 3);
    }
  }
  ctx.restore();
};

// 17. SecBot Sentinel AI Drone (Hovering Patrol Unit with Isometric Landing Pad)
export const drawChunkySecBot = (
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  canvasW: number,
  frame: number
) => {
  const pt = gridToScreen(gx, gy, canvasW, getElevationAt(gx, gy));
  const bcx = pt.x;
  const bcy = pt.y + 18;
  const hoverY = Math.sin(frame * 0.08) * 5;
  const bx = bcx;
  const by = bcy - 34 + hoverY;

  // Isometric Charging Pad Base
  drawIsoPrism(ctx, bcx, bcy, 15, 15, 4, '#1e293b', '#0f172a', '#020617', '#38bdf8');

  // Anti-gravity cyan glow on pad
  const shadowScale = 1 - hoverY / 20;
  ctx.beginPath();
  ctx.ellipse(bcx, bcy - 4, 12 * shadowScale, 6 * shadowScale, 0, 0, PI2);
  ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
  ctx.fill();

  // Drone Spherical Chassis
  ctx.beginPath();
  ctx.arc(bx, by, 14, 0, PI2);
  ctx.fillStyle = '#1e293b';
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Scanning Visor Eye
  const eyeOffset = Math.sin(frame * 0.1) * 4;
  ctx.fillStyle = '#020617';
  ctx.fillRect(bx - 9, by - 4, 18, 7);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx - 9, by - 4, 18, 7);

  ctx.save();
  ctx.fillStyle = '#38bdf8';
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(bx + eyeOffset, by - 0.5, 2.8, 0, PI2);
  ctx.fill();
  ctx.restore();

  // Telemetry Antenna
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bx, by - 14);
  ctx.lineTo(bx, by - 23);
  ctx.stroke();

  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.arc(bx, by - 24, 2.5, 0, PI2);
  ctx.fill();
};

// 18. CRAC Precision Datacenter Cooling Unit (Decorative Symmetry in Lower-Right Vault)
export const drawChunkyCracCoolingUnit = (
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  canvasW: number,
  frame: number
) => {
  const pt = gridToScreen(gx, gy, canvasW, getElevationAt(gx, gy));
  const bcx = pt.x;
  const bcy = pt.y + 18;
  const rx = 22;
  const ly = 16;
  const h = 76;

  ctx.beginPath();
  ctx.ellipse(bcx, bcy + 4, 34, 14, 0, 0, PI2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fill();

  drawIsoPrism(ctx, bcx, bcy, rx, ly, h, '#475569', '#1e293b', '#0f172a', '#0284c7');

  // Isometric Front Intake Louvers & Temp LCD (+gx face, slope +0.5)
  const leftCornerX = bcx - rx - ly;
  const leftCornerY = bcy - 0.5 * (rx - ly);
  ctx.save();
  ctx.transform(1, 0.5, 0, 1, leftCornerX + 4, leftCornerY - h + 6);

  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, rx * 2 - 8, 12);
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 5.5px monospace';
  ctx.fillText('CRAC 19.5C', 4, 8.5);

  // Cooling vent louvers
  for (let l = 0; l < 6; l++) {
    ctx.fillStyle = l % 2 === 0 ? '#0f172a' : '#334155';
    ctx.fillRect(2, 18 + l * 7, rx * 2 - 12, 4);
  }
  ctx.restore();

  // Rising cool mist plume on top discharge grate
  const mistPulse = 0.25 + 0.15 * Math.sin(frame * 0.08);
  ctx.fillStyle = `rgba(186, 230, 253, ${mistPulse})`;
  ctx.beginPath();
  ctx.ellipse(bcx, bcy - h - 6, 14, 6, 0, 0, PI2);
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

