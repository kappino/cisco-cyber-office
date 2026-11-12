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
