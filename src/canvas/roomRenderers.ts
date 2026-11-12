import { GRID_SIZE, TILE_W, TILE_H, TilePos, gridToScreen } from './isoMath';

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

// 2. Warm Parquet Floor with Cisco Blue Carpet in Center
export const drawWarmParquetFloor = (ctx: CanvasRenderingContext2D, canvasW: number, tgt: TilePos | null) => {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const pt = gridToScreen(c, r, canvasW);
      const isAlternate = (c + r) % 2 === 0;

      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x + TILE_W / 2, pt.y + TILE_H / 2);
      ctx.lineTo(pt.x, pt.y + TILE_H);
      ctx.lineTo(pt.x - TILE_W / 2, pt.y + TILE_H / 2);
      ctx.closePath();

      const isRug = c >= 3 && c <= 5 && r >= 3 && r <= 5;

      if (isRug) {
        ctx.fillStyle = isAlternate ? '#0369a1' : '#0284c7';
        ctx.fill();
        ctx.strokeStyle = '#075985';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.fillStyle = isAlternate ? '#b45309' : '#92400e';
        ctx.fill();
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      if (tgt && Math.round(tgt.x) === c && Math.round(tgt.y) === r) {
        ctx.fillStyle = 'rgba(254, 240, 138, 0.5)';
        ctx.fill();
        ctx.strokeStyle = '#f59e0b';
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

// 5. Chunky Admin Workstation Desk
export const drawChunkyAdminDesk = (
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  canvasW: number,
  done: boolean
) => {
  const pt = gridToScreen(gx, gy, canvasW);
  const dw = 76;
  const dh = 40;
  const dx = pt.x - dw / 2;
  const dy = pt.y - 20;

  ctx.beginPath();
  ctx.ellipse(pt.x, pt.y + 16, 46, 16, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fill();

  ctx.fillStyle = '#78350f';
  ctx.fillRect(dx, dy, dw, dh);
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 2;
  ctx.strokeRect(dx, dy, dw, dh);

  ctx.fillStyle = '#451a03';
  ctx.fillRect(dx, dy + dh, dw, 7);

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(dx + 2, dy + dh + 7, 4, 14);
  ctx.fillRect(dx + dw - 6, dy + dh + 7, 4, 14);

  // Left Monitor: Cisco IOS CLI
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(dx + 6, dy - 32, 30, 26);
  ctx.fillStyle = '#052e16';
  ctx.fillRect(dx + 8, dy - 30, 26, 22);
  ctx.fillStyle = done ? '#34d399' : '#10b981';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('Switch#', dx + 10, dy - 18);
  ctx.fillText('>_ cli', dx + 10, dy - 9);

  // Right Monitor: Packet Tracer
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(dx + 40, dy - 32, 30, 26);
  ctx.fillStyle = '#082f49';
  ctx.fillRect(dx + 42, dy - 30, 26, 22);
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(dx + 50, dy - 20, 3.5, 0, Math.PI * 2);
  ctx.arc(dx + 60, dy - 16, 3.5, 0, Math.PI * 2);
  ctx.arc(dx + 54, dy - 26, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Keyboard & Mouse
  ctx.fillStyle = '#334155';
  ctx.fillRect(dx + 22, dy + 14, 30, 10);
  ctx.fillStyle = '#64748b';
  ctx.fillRect(dx + 56, dy + 15, 6, 8);

  // Steaming Espresso Ceramic Cup
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(dx + 8, dy + 12, 8, 10);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillRect(dx + 11, dy + 6, 2, 4);

  // Ergonomic Chair
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(pt.x, pt.y + 24, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#475569';
  ctx.stroke();

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

// 6. Chunky SOC Threat Wall (Cisco Umbrella)
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

  ctx.beginPath();
  ctx.ellipse(pt.x, pt.y + 14, 36, 12, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fill();

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(pt.x - 16, pt.y + 2, 32, 6);
  ctx.fillStyle = '#475569';
  ctx.fillRect(pt.x - 4, pt.y - 12, 8, 16);

  ctx.fillStyle = '#020617';
  ctx.fillRect(sx, sy, sw, sh);
  ctx.strokeStyle = done ? '#38bdf8' : '#ef4444';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(sx, sy, sw, sh);

  ctx.fillStyle = '#081a36';
  ctx.fillRect(sx + 3, sy + 3, sw - 6, sh - 6);

  const rAngle = (frame * 0.05) % (Math.PI * 2);
  const cx = sx + sw / 2;
  const cy = sy + sh / 2 - 2;

  ctx.strokeStyle = done ? 'rgba(56, 189, 248, 0.4)' : 'rgba(239, 68, 68, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 15, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(rAngle) * 15, cy + Math.sin(rAngle) * 15);
  ctx.stroke();

  ctx.fillStyle = done ? '#34d399' : '#ef4444';
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(done ? 'UMBRELLA: SAFE' : 'C2 BEACON ALERT', cx, sy + sh - 6);

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
  ctx.fillText(done ? '✓' : '!', pt.x, badgeY + 4);
};

// 7. Chunky Neapolitan Bar & Pizza Box
export const drawChunkyNeapolitanBar = (
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  canvasW: number
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

  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(bx + 4, by - 20, 26, 22);
  ctx.fillStyle = '#475569';
  ctx.fillRect(bx + 8, by - 16, 18, 8);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(bx + 8, by + 2, 7, 3);
  ctx.fillRect(bx + 17, by + 2, 7, 3);

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

// 12. Raised Datacenter Floor with Perforated Cooling Grilles
export const drawUndergroundFloor = (ctx: CanvasRenderingContext2D, canvasW: number, tgt: TilePos | null) => {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const pt = gridToScreen(c, r, canvasW);
      const isAlternate = (c + r) % 2 === 0;

      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x + TILE_W / 2, pt.y + TILE_H / 2);
      ctx.lineTo(pt.x, pt.y + TILE_H);
      ctx.lineTo(pt.x - TILE_W / 2, pt.y + TILE_H / 2);
      ctx.closePath();

      // Cold aisle perforated tiles down the central corridor
      const isColdAisle = (c >= 2 && c <= 4 && r >= 2 && r <= 4);

      if (isColdAisle) {
        ctx.fillStyle = isAlternate ? '#1e293b' : '#0f172a';
        ctx.fill();
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Sub-floor blue cooling glow
        ctx.save();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y + TILE_H / 2, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Perforated hole pattern
        ctx.fillStyle = '#38bdf8';
        for (let dx = -8; dx <= 8; dx += 8) {
          for (let dy = -4; dy <= 4; dy += 4) {
            ctx.fillRect(pt.x + dx, pt.y + TILE_H / 2 + dy, 2, 2);
          }
        }
      } else {
        ctx.fillStyle = isAlternate ? '#1e293b' : '#151d2f';
        ctx.fill();
        ctx.strokeStyle = '#090d16';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      if (tgt && Math.round(tgt.x) === c && Math.round(tgt.y) === r) {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
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

// 14. Chunky Wireshark DPI Console Workstation (Tile 2, 2 in Vault)
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

  // Console Desk (High-Tech Carbon)
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(dx, dy + 16, w, 22);
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(dx, dy + 16, w, 22);

  // Dual Ultrawide Curving Monitor
  ctx.fillStyle = '#020617';
  ctx.fillRect(dx + 4, dy - 18, w - 8, 32);
  ctx.strokeStyle = level4Done ? '#10b981' : '#38bdf8';
  ctx.lineWidth = 2;
  ctx.strokeRect(dx + 4, dy - 18, w - 8, 32);

  // Monitor Display: Wireshark Packet Streams
  ctx.fillStyle = '#040d1a';
  ctx.fillRect(dx + 6, dy - 16, w - 12, 28);

  // Shark Fin Logo or Anomaly Beacon
  ctx.font = 'bold 8px monospace';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('🦈 WIRESHARK', dx + 8, dy - 7);

  // Streaming Packet Lines on Screen
  for (let l = 0; l < 3; l++) {
    const isThreatLine = !level4Done && l === 1;
    ctx.fillStyle = isThreatLine ? '#ef4444' : '#10b981';
    ctx.fillRect(dx + 8, dy - 2 + l * 4, 20 + ((frame + l * 10) % 18), 2.5);
  }

  // Workstation Status Notification
  ctx.font = 'bold 6.5px monospace';
  ctx.fillStyle = level4Done ? '#10b981' : '#ef4444';
  ctx.fillText(level4Done ? 'SAFE: 0 THREATS' : 'ALERT: DNS EXFIL', dx + 8, dy + 10);
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

