import { AvatarConfig } from '../types/game';
import { Direction, TilePos, gridToScreen, getElevationAt } from './isoMath';

// 9. Charming Marco NPC
export const drawCharmingMarcoNpc = (
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  canvasW: number,
  frame: number
) => {
  const pt = gridToScreen(gx, gy, canvasW, getElevationAt(gx, gy));
  const breathe = Math.sin(frame * 0.08) * 1.5;

  // Shadow
  ctx.beginPath();
  ctx.ellipse(pt.x, pt.y + 16, 20, 8, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fill();

  // Shoes with white rubber sole
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(pt.x - 8, pt.y + 8, 7, 7);
  ctx.fillRect(pt.x + 1, pt.y + 8, 7, 7);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(pt.x - 8, pt.y + 13, 7, 2);
  ctx.fillRect(pt.x + 1, pt.y + 13, 7, 2);

  // Chinos / Pants
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(pt.x - 7, pt.y - 4, 6, 14);
  ctx.fillRect(pt.x + 1, pt.y - 4, 6, 14);

  // Belt
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(pt.x - 8, pt.y - 5, 16, 2.5);

  // Navy Cisco Polo with white collar
  ctx.fillStyle = '#0d274d';
  ctx.fillRect(pt.x - 12, pt.y - 26 + breathe, 24, 22);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1;
  ctx.strokeRect(pt.x - 12, pt.y - 26 + breathe, 24, 22);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(pt.x - 4, pt.y - 26 + breathe, 8, 4);

  // Ears
  ctx.fillStyle = '#ffd1b3';
  ctx.fillRect(pt.x - 12, pt.y - 40 + breathe, 2, 4);
  ctx.fillRect(pt.x + 10, pt.y - 40 + breathe, 2, 4);

  // Head
  ctx.fillStyle = '#ffd1b3';
  ctx.fillRect(pt.x - 10, pt.y - 46 + breathe, 20, 20);

  // Dark Hair & Beard
  ctx.fillStyle = '#171717';
  ctx.fillRect(pt.x - 11, pt.y - 50 + breathe, 22, 9);
  ctx.fillRect(pt.x - 10, pt.y - 32 + breathe, 20, 7);

  // Glasses
  ctx.strokeStyle = '#00bceb';
  ctx.lineWidth = 1.8;
  ctx.strokeRect(pt.x - 8, pt.y - 39 + breathe, 6, 5);
  ctx.strokeRect(pt.x + 2, pt.y - 39 + breathe, 6, 5);
  ctx.beginPath();
  ctx.moveTo(pt.x - 2, pt.y - 36 + breathe);
  ctx.lineTo(pt.x + 2, pt.y - 36 + breathe);
  ctx.stroke();

  // Floating Nametag
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fillRect(pt.x - 56, pt.y - 70 + breathe, 112, 18);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1;
  ctx.strokeRect(pt.x - 56, pt.y - 70 + breathe, 112, 18);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Marco (NetAdmin)', pt.x, pt.y - 57 + breathe);
};

export interface SpeedTrailPoint {
  x: number;
  y: number;
  dir: Direction;
  alpha: number;
  active: boolean;
}

const drawRoundedBox = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) => {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
};

/**
 * Renders the diegetic Habbo emote bubble floating above the player's nametag.
 * Features a gentle floating bob motion, drop shadow, speech bubble tail,
 * and pixel art that alternates between a steaming espresso cup and a Neapolitan pizza slice.
 */
export const drawCaffeineEmoteBubble = (
  ctx: CanvasRenderingContext2D,
  anchorX: number,
  nametagTopY: number,
  frame: number,
  caffeineBoostTimer: number
) => {
  ctx.save();

  // Gentle floating bob motion (Math.sin(frame * 0.1) * 2)
  const bobY = Math.sin(frame * 0.1) * 2;
  const bubbleAlpha = Math.min(1, caffeineBoostTimer / 25);
  ctx.globalAlpha = bubbleAlpha;

  // Geometry
  const bubbleW = 36;
  const bubbleH = 26;
  const bubbleCenterX = anchorX;
  const bubbleCenterY = nametagTopY - 20 + bobY;
  const bx = bubbleCenterX - bubbleW / 2;
  const by = bubbleCenterY - bubbleH / 2;
  const radius = 6;

  // 1. Drop Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  drawRoundedBox(ctx, bx + 1.5, by + 1.5, bubbleW, bubbleH, radius);
  ctx.fill();

  // 2. Bubble Body & Pointer Tail
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  drawRoundedBox(ctx, bx, by, bubbleW, bubbleH, radius);
  ctx.fill();

  // Pointer Tail pointing down towards the nametag
  ctx.beginPath();
  ctx.moveTo(bubbleCenterX - 4, by + bubbleH - 1);
  ctx.lineTo(bubbleCenterX, nametagTopY - 3 + bobY);
  ctx.lineTo(bubbleCenterX + 4, by + bubbleH - 1);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Outline
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  drawRoundedBox(ctx, bx, by, bubbleW, bubbleH, radius);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(bubbleCenterX - 4, by + bubbleH);
  ctx.lineTo(bubbleCenterX, nametagTopY - 3 + bobY);
  ctx.lineTo(bubbleCenterX + 4, by + bubbleH);
  ctx.stroke();

  // Erase inner seam between bubble and tail
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bubbleCenterX - 3, by + bubbleH);
  ctx.lineTo(bubbleCenterX + 3, by + bubbleH);
  ctx.stroke();

  // 3. Pixel Art Inside Bubble (Alternates every 90 frames / 1.5s)
  const showPizza = Math.floor(frame / 90) % 2 === 1;

  if (!showPizza) {
    // === PIXEL ART STEAMING ESPRESSO CUP ===
    const cupY = bubbleCenterY + 2;

    // Ceramic Saucer
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(bubbleCenterX - 8, cupY + 6, 16, 2);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(bubbleCenterX - 6, cupY + 7, 12, 1);

    // Brown Porcelain Cup
    ctx.fillStyle = '#78350f';
    ctx.fillRect(bubbleCenterX - 6, cupY - 2, 12, 8);
    ctx.fillRect(bubbleCenterX - 5, cupY + 5, 10, 1.5);

    // Cup Highlight
    ctx.fillStyle = '#b45309';
    ctx.fillRect(bubbleCenterX - 5, cupY - 1, 2, 6);

    // Porcelain Handle
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(bubbleCenterX + 7, cupY + 2, 2.5, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();

    // Golden Crema
    ctx.fillStyle = '#d97706';
    ctx.fillRect(bubbleCenterX - 5, cupY - 3, 10, 2);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(bubbleCenterX - 2, cupY - 3, 4, 1.5);

    // Rising Steam Curves (Procedural animated wisps)
    const steamWiggle1 = Math.sin(frame * 0.15) * 2;
    const steamWiggle2 = Math.cos(frame * 0.15) * 2;

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.8)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(bubbleCenterX - 2, cupY - 4);
    ctx.quadraticCurveTo(bubbleCenterX - 2 + steamWiggle1, cupY - 8, bubbleCenterX - 1, cupY - 12);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(bubbleCenterX + 2, cupY - 4);
    ctx.quadraticCurveTo(bubbleCenterX + 2 + steamWiggle2, cupY - 9, bubbleCenterX + 3, cupY - 13);
    ctx.stroke();
  } else {
    // === PIXEL ART NEAPOLITAN PIZZA SLICE ===
    const pizzaY = bubbleCenterY;

    // Baked Golden Cornicione Crust
    ctx.fillStyle = '#c2410c';
    ctx.beginPath();
    ctx.moveTo(bubbleCenterX - 8, pizzaY - 7);
    ctx.lineTo(bubbleCenterX + 8, pizzaY - 7);
    ctx.lineTo(bubbleCenterX + 7, pizzaY - 4);
    ctx.lineTo(bubbleCenterX - 7, pizzaY - 4);
    ctx.closePath();
    ctx.fill();

    // Red Tomato Marinara Wedge
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(bubbleCenterX - 7, pizzaY - 4);
    ctx.lineTo(bubbleCenterX + 7, pizzaY - 4);
    ctx.lineTo(bubbleCenterX, pizzaY + 8);
    ctx.closePath();
    ctx.fill();

    // Melted Mozzarella Layer
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.moveTo(bubbleCenterX - 5, pizzaY - 3);
    ctx.lineTo(bubbleCenterX + 5, pizzaY - 3);
    ctx.lineTo(bubbleCenterX, pizzaY + 6);
    ctx.closePath();
    ctx.fill();

    // Pepperoni / Salamino Dots
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(bubbleCenterX - 3, pizzaY - 2, 2.5, 2.5);
    ctx.fillRect(bubbleCenterX + 1, pizzaY + 1, 2.5, 2.5);

    // Fresh Basil Leaf Dot
    ctx.fillStyle = '#16a34a';
    ctx.fillRect(bubbleCenterX, pizzaY - 2, 2, 2);

    // Mozzarella drip at tip
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(bubbleCenterX - 0.5, pizzaY + 8, 1, 2);

    // Rising Warm Steam
    const pizzaSteam = Math.sin(frame * 0.15) * 1.5;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bubbleCenterX, pizzaY - 8);
    ctx.quadraticCurveTo(bubbleCenterX + pizzaSteam, pizzaY - 11, bubbleCenterX, pizzaY - 14);
    ctx.stroke();
  }

  ctx.restore();
};

/**
 * Renders the 3-point golden speed aura after-image echoes trailing the avatar's feet.
 * Decays with rgba(251, 191, 36, alpha).
 */
export const drawGoldenSpeedTrails = (
  ctx: CanvasRenderingContext2D,
  trails: readonly SpeedTrailPoint[],
  canvasW: number,
  frame: number
) => {
  ctx.save();

  // Iterate oldest-to-newest so younger echoes draw on top
  for (let i = trails.length - 1; i >= 0; i--) {
    const trail = trails[i];
    if (!trail.active || trail.alpha <= 0.01) continue;

    const tPt = gridToScreen(trail.x, trail.y, canvasW, getElevationAt(trail.x, trail.y));
    const alpha = trail.alpha;

    // 1. Golden Floor Speed Aura Oval
    ctx.beginPath();
    ctx.ellipse(tPt.x, tPt.y + 16, 18, 7, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(251, 191, 36, ${alpha * 0.45})`;
    ctx.fill();

    // 2. Golden Footwear After-Image
    ctx.fillStyle = `rgba(251, 191, 36, ${alpha})`;
    ctx.fillRect(tPt.x - 8, tPt.y + 8, 7, 7);
    ctx.fillRect(tPt.x + 1, tPt.y + 8, 7, 7);

    // Sole Highlights
    ctx.fillStyle = `rgba(254, 240, 138, ${alpha})`;
    ctx.fillRect(tPt.x - 8, tPt.y + 13, 7, 2);
    ctx.fillRect(tPt.x + 1, tPt.y + 13, 7, 2);

    // Faint Shin / Trousers Silhouette
    ctx.fillStyle = `rgba(245, 158, 11, ${alpha * 0.7})`;
    ctx.fillRect(tPt.x - 7, tPt.y - 2, 6, 10);
    ctx.fillRect(tPt.x + 1, tPt.y - 2, 6, 10);

    // 3. Trailing Speed Sparkles
    ctx.fillStyle = `rgba(252, 211, 77, ${alpha})`;
    const sparkY = tPt.y + 12 - ((frame * 0.7 + i * 4) % 10);
    ctx.fillRect(tPt.x - 6 + ((i * 6) % 12), sparkY, 2, 2);
  }

  ctx.restore();
};

// 11. Charming Habbo Proportioned Avatar with Seated Pose, Coffee Emotes & Victory Celebration
export const drawCharmingHabboAvatar = (
  ctx: CanvasRenderingContext2D,
  p: TilePos,
  canvasW: number,
  dir: Direction,
  isWalking: boolean,
  frame: number,
  avatar: AvatarConfig,
  playerLevel: number,
  isSitting: boolean = false,
  caffeineBoostTimer: number = 0,
  celebrationTimer: number = 0,
  speedTrails?: readonly SpeedTrailPoint[]
) => {
  // 1. Golden Speed Trails (rendered behind avatar on floor)
  if (speedTrails && speedTrails.length > 0 && caffeineBoostTimer > 0) {
    drawGoldenSpeedTrails(ctx, speedTrails, canvasW, frame);
  }

  const pt = gridToScreen(p.x, p.y, canvasW, getElevationAt(p.x, p.y));
  const isCelebrating = celebrationTimer > 0;
  const jumpY = isCelebrating ? -Math.abs(Math.sin(frame * 0.18)) * 18 : 0;
  const sitOffset = (!isCelebrating && isSitting) ? 6 : 0;
  const walkCycle = isWalking ? Math.sin(frame * 0.35) : 0;
  const breathe = isWalking
    ? 0
    : isCelebrating
      ? 0
      : isSitting
        ? Math.sin(frame * 0.1) * 0.8
        : Math.sin(frame * 0.08) * 1.5;
  const yShift = isCelebrating ? jumpY : (sitOffset + breathe);
  const isFacingAway = dir === 'NE' || dir === 'NW';
  const facingSign = (dir === 'NE' || dir === 'SE') ? 1 : -1;

  // Floor Shadow & Office Chair Base
  if (isCelebrating) {
    // Leaping high in the air: shadow stays on floor plane at pt.y + 16, scales down and fades
    const shadowScale = Math.max(0.65, 1 + jumpY / 36);
    ctx.beginPath();
    ctx.ellipse(pt.x, pt.y + 16, 20 * shadowScale, 8 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0, 0, 0, ${0.6 * shadowScale})`;
    ctx.fill();
  } else if (isSitting) {
    // Swivel chair floor shadow
    ctx.beginPath();
    ctx.ellipse(pt.x, pt.y + 17, 19, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fill();

    // 5-star caster base legs
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y + 10); ctx.lineTo(pt.x, pt.y + 16);
    ctx.moveTo(pt.x - 10, pt.y + 17); ctx.lineTo(pt.x + 10, pt.y + 15);
    ctx.moveTo(pt.x - 8, pt.y + 14); ctx.lineTo(pt.x + 8, pt.y + 18);
    ctx.stroke();

    // Ergonomic office chair seat cushion
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.ellipse(pt.x, pt.y + 8, 15, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    // Standing floor shadow
    ctx.beginPath();
    ctx.ellipse(pt.x, pt.y + 16, 20, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fill();
  }

  // Legs, Thighs & Shoes
  if (isSitting && !isCelebrating) {
    if (isFacingAway) {
      // Isometric 3/4 seated legs tucked forward toward desk (NE = +x/-y, NW = -x/-y)
      const legDir = dir === 'NE' ? 1 : -1;
      ctx.fillStyle = avatar.pantsColor;
      // Angled thighs reaching toward desk
      ctx.fillRect(pt.x - 6 + legDir * 4, pt.y - 1, 7, 7);
      ctx.fillRect(pt.x + 1 + legDir * 5, pt.y + 1, 7, 7);
      // Lower legs dropping under chair
      ctx.fillRect(pt.x - 5 + legDir * 6, pt.y + 5, 6, 8);
      ctx.fillRect(pt.x + 2 + legDir * 6, pt.y + 6, 6, 8);
      // Shoes
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(pt.x - 5 + legDir * 6, pt.y + 12, 6, 3);
      ctx.fillRect(pt.x + 2 + legDir * 6, pt.y + 13, 6, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(pt.x - 5 + legDir * 6, pt.y + 14, 6, 1.5);
      ctx.fillRect(pt.x + 2 + legDir * 6, pt.y + 15, 6, 1.5);
    } else {
      // Front-facing seated legs
      ctx.fillStyle = avatar.pantsColor;
      ctx.fillRect(pt.x - 10, pt.y + 2, 9, 6);
      ctx.fillRect(pt.x + 1, pt.y + 2, 9, 6);
      ctx.fillRect(pt.x - 8, pt.y + 7, 7, 8);
      ctx.fillRect(pt.x + 2, pt.y + 7, 7, 8);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(pt.x - 8, pt.y + 13, 7, 4);
      ctx.fillRect(pt.x + 2, pt.y + 13, 7, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(pt.x - 8, pt.y + 16, 7, 2);
      ctx.fillRect(pt.x + 2, pt.y + 16, 7, 2);
    }
  } else {
    // Standing / Walking / Celebrating legs & shoes
    const legOffset = walkCycle * 4;
    const footY = isCelebrating ? pt.y + 8 + jumpY : pt.y + 8;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(pt.x - 9, footY + legOffset, 8, 7);
    ctx.fillRect(pt.x + 1, footY - legOffset, 8, 7);
    // White Sneaker Soles
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(pt.x - 9, footY + 5 + legOffset, 8, 2);
    ctx.fillRect(pt.x + 1, footY + 5 - legOffset, 8, 2);

    // Denim Trousers / Slacks
    const pantsY = isCelebrating ? pt.y - 6 + jumpY : pt.y - 6;
    ctx.fillStyle = avatar.pantsColor;
    ctx.fillRect(pt.x - 8, pantsY, 7, 15);
    ctx.fillRect(pt.x + 1, pantsY, 7, 15);
  }

  // Belt & Buckle
  const beltY = isCelebrating ? pt.y - 7 + jumpY : pt.y - 7 + yShift;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(pt.x - 9, beltY, 18, 3);
  if (dir === 'SE' || dir === 'SW') {
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(pt.x - 2, beltY, 4, 3);
  }

  // Torso / Shirt with white collar
  ctx.fillStyle = avatar.shirtColor;
  ctx.fillRect(pt.x - 13, pt.y - 28 + yShift, 26, 22);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1;
  ctx.strokeRect(pt.x - 13, pt.y - 28 + yShift, 26, 22);

  // Collar
  if (dir === 'SE' || dir === 'SW') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(pt.x - 4, pt.y - 28 + yShift, 8, 4);
  }

  // Arms & Hands
  if (isCelebrating) {
    // Cheerful raised arms pose (\o/) with energetic arm pump
    const armWave = Math.sin(frame * 0.3) * 2.5;

    // Left Arm (\)
    ctx.fillStyle = avatar.shirtColor;
    ctx.fillRect(pt.x - 17, pt.y - 36 + yShift + armWave, 4, 12);
    ctx.fillRect(pt.x - 21, pt.y - 44 + yShift + armWave, 5, 10);
    // Left Hand
    ctx.fillStyle = avatar.skinTone;
    ctx.fillRect(pt.x - 22, pt.y - 49 + yShift + armWave, 5, 5);

    // Right Arm (/)
    ctx.fillStyle = avatar.shirtColor;
    ctx.fillRect(pt.x + 13, pt.y - 36 + yShift - armWave, 4, 12);
    ctx.fillRect(pt.x + 16, pt.y - 44 + yShift - armWave, 5, 10);
    // Right Hand
    ctx.fillStyle = avatar.skinTone;
    ctx.fillRect(pt.x + 17, pt.y - 49 + yShift - armWave, 5, 5);
  } else if (isSitting) {
    const isTapLeft = (frame % 10 < 5);
    const leftHandOffset = isTapLeft ? 1.5 : -1.5;
    const rightHandOffset = isTapLeft ? -1.5 : 1.5;

    if (isFacingAway) {
      // Arms reaching forward-upward into the desk keyboard (NE = +x, NW = -x)
      const reachX = dir === 'NE' ? 1 : -1;
      ctx.fillStyle = avatar.shirtColor;
      ctx.fillRect(pt.x - 15 + reachX * 3, pt.y - 26 + yShift, 5, 11);
      ctx.fillRect(pt.x + 10 + reachX * 3, pt.y - 26 + yShift, 5, 11);
      // Forearms angled toward desk surface
      ctx.fillRect(pt.x - 12 + reachX * 7, pt.y - 22 + yShift, 6, 4);
      ctx.fillRect(pt.x + 8 + reachX * 7, pt.y - 20 + yShift, 6, 4);
      // Typing hands
      ctx.fillStyle = avatar.skinTone;
      ctx.fillRect(pt.x - 9 + reachX * 10, pt.y - 22 + yShift + leftHandOffset, 4, 4);
      ctx.fillRect(pt.x + 10 + reachX * 10, pt.y - 20 + yShift + rightHandOffset, 4, 4);
    } else {
      // Front-facing typing arms
      ctx.fillStyle = avatar.shirtColor;
      ctx.fillRect(pt.x - 16, pt.y - 24 + yShift, 4, 12);
      ctx.fillRect(pt.x + 12, pt.y - 24 + yShift, 4, 12);
      ctx.fillRect(pt.x - 15, pt.y - 14 + yShift, 6, 4);
      ctx.fillRect(pt.x + 9, pt.y - 14 + yShift, 6, 4);
      ctx.fillStyle = avatar.skinTone;
      ctx.fillRect(pt.x - 13, pt.y - 12 + yShift + leftHandOffset, 5, 4);
      ctx.fillRect(pt.x + 8, pt.y - 12 + yShift + rightHandOffset, 5, 4);
    }
  } else {
    // Standing arms
    const armSwing = isWalking ? -walkCycle * 3 : 0;
    ctx.fillStyle = avatar.shirtColor;
    ctx.fillRect(pt.x - 17, pt.y - 26 + yShift + armSwing, 4, 16);
    ctx.fillRect(pt.x + 13, pt.y - 26 + yShift - armSwing, 4, 16);

    // Standing hands
    ctx.fillStyle = avatar.skinTone;
    ctx.fillRect(pt.x - 17, pt.y - 10 + yShift + armSwing, 4, 5);
    ctx.fillRect(pt.x + 13, pt.y - 10 + yShift - armSwing, 4, 5);
  }

  // Ergonomic Chair Backrest (drawn OVER back of seated avatar when facing away, so avatar sits *inside* the chair!)
  if (isSitting && !isCelebrating && isFacingAway) {
    const backOffsetX = dir === 'NE' ? -6 : 6;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(pt.x - 10 + backOffsetX, pt.y - 24 + yShift, 20, 20);
    ctx.strokeStyle = '#00bceb';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(pt.x - 10 + backOffsetX, pt.y - 24 + yShift, 20, 20);
    // Lumbar mesh highlight
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(pt.x - 7 + backOffsetX, pt.y - 21 + yShift, 14, 14);
  }

  // Ears
  ctx.fillStyle = avatar.skinTone;
  ctx.fillRect(pt.x - 13, pt.y - 41 + yShift, 2, 5);
  ctx.fillRect(pt.x + 11, pt.y - 41 + yShift, 2, 5);

  // Head
  ctx.fillStyle = avatar.skinTone;
  ctx.fillRect(pt.x - 11, pt.y - 48 + yShift, 22, 20);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1;
  ctx.strokeRect(pt.x - 11, pt.y - 48 + yShift, 22, 20);

  // Face Direction & Expressive Eyes (or 3/4 Back-of-Head Coverage when facing NE / NW)
  if (dir === 'SE' || dir === 'SW') {
    const shift = dir === 'SE' ? 2 : -2;

    if (isCelebrating) {
      // Happy squinting eyes (^^ retro pixel arcs)
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.arc(pt.x - 4 + shift, pt.y - 39 + yShift, 3, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(pt.x + 4 + shift, pt.y - 39 + yShift, 3, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();

      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.arc(pt.x + shift, pt.y - 33 + yShift, 4.5, 0, Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = 'rgba(244, 63, 94, 0.45)';
      ctx.beginPath();
      ctx.ellipse(pt.x - 7 + shift, pt.y - 34 + yShift, 2.5, 1.5, 0, 0, Math.PI * 2);
      ctx.ellipse(pt.x + 7 + shift, pt.y - 34 + yShift, 2.5, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(pt.x - 6 + shift, pt.y - 41 + yShift, 4, 5);
      ctx.fillRect(pt.x + 2 + shift, pt.y - 41 + yShift, 4, 5);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(pt.x - 5 + shift, pt.y - 40 + yShift, 3, 4);
      ctx.fillRect(pt.x + 3 + shift, pt.y - 40 + yShift, 3, 4);

      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(pt.x + shift, pt.y - 33 + yShift, 4, 0, Math.PI);
      ctx.stroke();
    }

    // Accessories
    if (avatar.accessory === 'cyber-visor') {
      ctx.fillStyle = '#00bceb';
      ctx.fillRect(pt.x - 9 + shift, pt.y - 42 + yShift, 18, 7);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(pt.x - 7 + shift, pt.y - 41 + yShift, 5, 2);
    } else if (avatar.accessory === 'glasses') {
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(pt.x - 8 + shift, pt.y - 42 + yShift, 6, 6);
      ctx.strokeRect(pt.x + 2 + shift, pt.y - 42 + yShift, 6, 6);
      ctx.beginPath();
      ctx.moveTo(pt.x - 2 + shift, pt.y - 39 + yShift);
      ctx.lineTo(pt.x + 2 + shift, pt.y - 39 + yShift);
      ctx.stroke();
    }
  } else {
    // Facing NE or NW: Full back-of-head hair coverage + subtle 3/4 side cheek & accessory temple!
    ctx.fillStyle = avatar.hairColor;
    // Leave only a 4px sliver of side-cheek on the facing edge (right for NE, left for NW)
    const hairX = dir === 'NE' ? pt.x - 11 : pt.x - 7;
    ctx.fillRect(hairX, pt.y - 48 + yShift, 18, 17);
    // Nape shadow contour
    ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
    ctx.fillRect(hairX, pt.y - 35 + yShift, 18, 4);

    // Side profile glasses temple / cyber-visor band wrapping around the visible side
    if (avatar.accessory === 'cyber-visor') {
      ctx.fillStyle = '#00bceb';
      ctx.fillRect(dir === 'NE' ? pt.x + 4 : pt.x - 11, pt.y - 42 + yShift, 7, 5);
    } else if (avatar.accessory === 'glasses') {
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const gxEdge = pt.x + facingSign * 11;
      const gxEar = pt.x + facingSign * 5;
      ctx.moveTo(gxEar, pt.y - 39 + yShift);
      ctx.lineTo(gxEdge, pt.y - 39 + yShift);
      ctx.stroke();
    }
  }

  // Hair Style
  ctx.fillStyle = avatar.hairColor;
  if (avatar.hairStyle === 'spiky') {
    ctx.beginPath();
    ctx.moveTo(pt.x - 13, pt.y - 48 + yShift);
    ctx.lineTo(pt.x - 7, pt.y - 58 + yShift);
    ctx.lineTo(pt.x - 2, pt.y - 50 + yShift);
    ctx.lineTo(pt.x + 4, pt.y - 59 + yShift);
    ctx.lineTo(pt.x + 9, pt.y - 50 + yShift);
    ctx.lineTo(pt.x + 13, pt.y - 48 + yShift);
    ctx.closePath();
    ctx.fill();
  } else if (avatar.hairStyle === 'curly') {
    ctx.beginPath();
    ctx.arc(pt.x - 8, pt.y - 51 + yShift, 6, 0, Math.PI * 2);
    ctx.arc(pt.x, pt.y - 54 + yShift, 7, 0, Math.PI * 2);
    ctx.arc(pt.x + 8, pt.y - 51 + yShift, 6, 0, Math.PI * 2);
    ctx.fill();
  } else if (avatar.hairStyle === 'cyber') {
    ctx.fillRect(pt.x - 4, pt.y - 58 + yShift, 8, 12);
    ctx.fillStyle = '#00bceb';
    ctx.fillRect(pt.x - 12, pt.y - 50 + yShift, 24, 3);
  } else {
    ctx.beginPath();
    ctx.moveTo(pt.x - 12, pt.y - 48 + yShift);
    ctx.quadraticCurveTo(pt.x, pt.y - 57 + yShift, pt.x + 12, pt.y - 48 + yShift);
    ctx.lineTo(pt.x + 12, pt.y - 44 + yShift);
    ctx.lineTo(pt.x - 12, pt.y - 44 + yShift);
    ctx.closePath();
    ctx.fill();
  }

  // Ring of 8 Golden Sparkle Stars orbiting the head during celebration
  if (isCelebrating) {
    ctx.save();
    const starCount = 8;
    const orbitAngle = frame * 0.08;
    const radialExpand = Math.sin(frame * 0.15) * 5;
    const rx = 30 + radialExpand;
    const ry = 14 + radialExpand * 0.45;
    const headCenterY = pt.y - 46 + yShift;

    for (let i = 0; i < starCount; i++) {
      const angle = orbitAngle + (i * Math.PI * 2) / starCount;
      const starX = pt.x + Math.cos(angle) * rx;
      const starY = headCenterY + Math.sin(angle) * ry;

      // Depth perspective: stars in front are slightly larger than stars behind
      const depthFactor = (Math.sin(angle) + 2) / 3; // 0.33 to 1.0

      // Sparkle twinkle
      const twinkle = 0.5 + 0.5 * Math.sin(frame * 0.28 + i * 1.3);
      const starR = (3 + twinkle * 3) * depthFactor;

      // 1. Soft golden aura glow
      ctx.fillStyle = `rgba(251, 191, 36, ${0.45 * twinkle})`;
      ctx.beginPath();
      ctx.arc(starX, starY, starR * 1.8, 0, Math.PI * 2);
      ctx.fill();

      // 2. 4-point golden sparkle diamond
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(starX, starY - starR);
      ctx.lineTo(starX + starR * 0.35, starY - starR * 0.35);
      ctx.lineTo(starX + starR, starY);
      ctx.lineTo(starX + starR * 0.35, starY + starR * 0.35);
      ctx.lineTo(starX, starY + starR);
      ctx.lineTo(starX - starR * 0.35, starY + starR * 0.35);
      ctx.lineTo(starX - starR, starY);
      ctx.lineTo(starX - starR * 0.35, starY - starR * 0.35);
      ctx.closePath();
      ctx.fill();

      // 3. Bright white-hot center core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(starX, starY - starR * 0.5);
      ctx.lineTo(starX + starR * 0.2, starY);
      ctx.lineTo(starX, starY + starR * 0.5);
      ctx.lineTo(starX - starR * 0.2, starY);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // Floating Habbo Nametag
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fillRect(pt.x - 55, pt.y - 74 + yShift, 110, 18);
  ctx.strokeStyle = '#00bceb';
  ctx.lineWidth = 1;
  ctx.strokeRect(pt.x - 55, pt.y - 74 + yShift, 110, 18);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`[Lv.${playerLevel}] ${avatar.name}`, pt.x, pt.y - 61 + yShift);

  // Floating Emote Bubble above nametag during caffeine boost
  if (caffeineBoostTimer > 0) {
    drawCaffeineEmoteBubble(ctx, pt.x, pt.y - 74 + yShift, frame, caffeineBoostTimer);
  }
};
