import { AvatarConfig } from '../types/game';
import { Direction, TilePos, gridToScreen } from './isoMath';

// 9. Charming Marco NPC
export const drawCharmingMarcoNpc = (
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  canvasW: number,
  frame: number
) => {
  const pt = gridToScreen(gx, gy, canvasW);
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

// 11. Charming Habbo Proportioned Avatar
export const drawCharmingHabboAvatar = (
  ctx: CanvasRenderingContext2D,
  p: TilePos,
  canvasW: number,
  dir: Direction,
  isWalking: boolean,
  frame: number,
  avatar: AvatarConfig,
  playerLevel: number
) => {
  const pt = gridToScreen(p.x, p.y, canvasW);
  const walkCycle = isWalking ? Math.sin(frame * 0.35) : 0;
  const breathe = !isWalking ? Math.sin(frame * 0.08) * 1.5 : 0;

  // Floor Shadow
  ctx.beginPath();
  ctx.ellipse(pt.x, pt.y + 16, 20, 8, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fill();

  // Shoes & Pants
  const legOffset = walkCycle * 4;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(pt.x - 9, pt.y + 8 + legOffset, 8, 7);
  ctx.fillRect(pt.x + 1, pt.y + 8 - legOffset, 8, 7);
  // White Sneaker Soles
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(pt.x - 9, pt.y + 13 + legOffset, 8, 2);
  ctx.fillRect(pt.x + 1, pt.y + 13 - legOffset, 8, 2);

  // Denim Trousers / Slacks
  ctx.fillStyle = avatar.pantsColor;
  ctx.fillRect(pt.x - 8, pt.y - 6, 7, 15);
  ctx.fillRect(pt.x + 1, pt.y - 6, 7, 15);

  // Belt & Buckle
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(pt.x - 9, pt.y - 7, 18, 3);
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(pt.x - 2, pt.y - 7, 4, 3);

  // Torso / Shirt with white collar
  ctx.fillStyle = avatar.shirtColor;
  ctx.fillRect(pt.x - 13, pt.y - 28 + breathe, 26, 22);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1;
  ctx.strokeRect(pt.x - 13, pt.y - 28 + breathe, 26, 22);

  // Collar
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(pt.x - 4, pt.y - 28 + breathe, 8, 4);

  // Arms
  const armSwing = isWalking ? -walkCycle * 3 : 0;
  ctx.fillStyle = avatar.shirtColor;
  ctx.fillRect(pt.x - 17, pt.y - 26 + breathe + armSwing, 4, 16);
  ctx.fillRect(pt.x + 13, pt.y - 26 + breathe - armSwing, 4, 16);

  // Hands
  ctx.fillStyle = avatar.skinTone;
  ctx.fillRect(pt.x - 17, pt.y - 10 + breathe + armSwing, 4, 5);
  ctx.fillRect(pt.x + 13, pt.y - 10 + breathe - armSwing, 4, 5);

  // Ears
  ctx.fillStyle = avatar.skinTone;
  ctx.fillRect(pt.x - 13, pt.y - 41 + breathe, 2, 5);
  ctx.fillRect(pt.x + 11, pt.y - 41 + breathe, 2, 5);

  // Head
  ctx.fillStyle = avatar.skinTone;
  ctx.fillRect(pt.x - 11, pt.y - 48 + breathe, 22, 20);
  ctx.strokeRect(pt.x - 11, pt.y - 48 + breathe, 22, 20);

  // Face Direction & Expressive Eyes
  if (dir === 'SE' || dir === 'SW') {
    const shift = dir === 'SE' ? 2 : -2;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(pt.x - 6 + shift, pt.y - 41 + breathe, 4, 5);
    ctx.fillRect(pt.x + 2 + shift, pt.y - 41 + breathe, 4, 5);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(pt.x - 5 + shift, pt.y - 40 + breathe, 3, 4);
    ctx.fillRect(pt.x + 3 + shift, pt.y - 40 + breathe, 3, 4);

    // Smile
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(pt.x + shift, pt.y - 33 + breathe, 4, 0, Math.PI);
    ctx.stroke();

    // Accessories
    if (avatar.accessory === 'cyber-visor') {
      ctx.fillStyle = '#00bceb';
      ctx.fillRect(pt.x - 9 + shift, pt.y - 42 + breathe, 18, 7);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(pt.x - 7 + shift, pt.y - 41 + breathe, 5, 2);
    } else if (avatar.accessory === 'glasses') {
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(pt.x - 8 + shift, pt.y - 42 + breathe, 6, 6);
      ctx.strokeRect(pt.x + 2 + shift, pt.y - 42 + breathe, 6, 6);
      ctx.beginPath();
      ctx.moveTo(pt.x - 2 + shift, pt.y - 39 + breathe);
      ctx.lineTo(pt.x + 2 + shift, pt.y - 39 + breathe);
      ctx.stroke();
    }
  }

  // Hair Style
  ctx.fillStyle = avatar.hairColor;
  if (avatar.hairStyle === 'spiky') {
    ctx.beginPath();
    ctx.moveTo(pt.x - 13, pt.y - 48 + breathe);
    ctx.lineTo(pt.x - 7, pt.y - 58 + breathe);
    ctx.lineTo(pt.x - 2, pt.y - 50 + breathe);
    ctx.lineTo(pt.x + 4, pt.y - 59 + breathe);
    ctx.lineTo(pt.x + 9, pt.y - 50 + breathe);
    ctx.lineTo(pt.x + 13, pt.y - 48 + breathe);
    ctx.closePath();
    ctx.fill();
  } else if (avatar.hairStyle === 'curly') {
    ctx.beginPath();
    ctx.arc(pt.x - 8, pt.y - 51 + breathe, 6, 0, Math.PI * 2);
    ctx.arc(pt.x, pt.y - 54 + breathe, 7, 0, Math.PI * 2);
    ctx.arc(pt.x + 8, pt.y - 51 + breathe, 6, 0, Math.PI * 2);
    ctx.fill();
  } else if (avatar.hairStyle === 'cyber') {
    ctx.fillRect(pt.x - 4, pt.y - 58 + breathe, 8, 12);
    ctx.fillStyle = '#00bceb';
    ctx.fillRect(pt.x - 12, pt.y - 50 + breathe, 24, 3);
  } else {
    ctx.beginPath();
    ctx.moveTo(pt.x - 12, pt.y - 48 + breathe);
    ctx.quadraticCurveTo(pt.x, pt.y - 57 + breathe, pt.x + 12, pt.y - 48 + breathe);
    ctx.lineTo(pt.x + 12, pt.y - 44 + breathe);
    ctx.lineTo(pt.x - 12, pt.y - 44 + breathe);
    ctx.closePath();
    ctx.fill();
  }

  // Floating Habbo Nametag
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fillRect(pt.x - 55, pt.y - 74 + breathe, 110, 18);
  ctx.strokeStyle = '#00bceb';
  ctx.lineWidth = 1;
  ctx.strokeRect(pt.x - 55, pt.y - 74 + breathe, 110, 18);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`[Lv.${playerLevel}] ${avatar.name}`, pt.x, pt.y - 61 + breathe);
};
