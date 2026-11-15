export const TILE_W = 96;
export const TILE_H = 48;
export const HALF_W = 48;
export const HALF_H = 24;
export const ORIGIN_X = 420;
export const ORIGIN_Y = 170;

export type Direction = 'SE' | 'SW' | 'NE' | 'NW';

export interface ScreenCoord {
  x: number;
  y: number;
}

export interface GridCoord {
  gx: number;
  gy: number;
}

/**
 * Transforms isometric grid coordinates to screen pixel coordinates.
 */
export function gridToScreen(
  gx: number,
  gy: number,
  originX: number = ORIGIN_X,
  originY: number = ORIGIN_Y
): ScreenCoord {
  const x = originX + (gx - gy) * HALF_W;
  const y = originY + (gx + gy) * HALF_H;
  return { x, y };
}

/**
 * Transforms screen pixel coordinates to continuous isometric grid coordinates.
 */
export function screenToGrid(
  sx: number,
  sy: number,
  originX: number = ORIGIN_X,
  originY: number = ORIGIN_Y
): GridCoord {
  const dx = sx - originX;
  const dy = sy - originY;
  const gx = (dx / HALF_W + dy / HALF_H) / 2;
  const gy = (dy / HALF_H - dx / HALF_W) / 2;
  return { gx, gy };
}

/**
 * Computes sorting depth for Phaser game objects.
 */
export function getIsometricDepth(gx: number, gy: number, layerBonus: number = 5): number {
  return Math.floor((gx + gy) * 10) + layerBonus;
}

/**
 * Derives 4-direction orientation from grid movement vector (dgx, dgy).
 */
export function getDirectionFromVector(
  dgx: number,
  dgy: number,
  currentDir: Direction = 'SE'
): Direction {
  if (Math.abs(dgx) < 0.001 && Math.abs(dgy) < 0.001) {
    return currentDir;
  }
  if (dgx >= 0 && dgy >= 0) {
    return dgx >= dgy ? 'SE' : 'SW';
  }
  if (dgx >= 0 && dgy < 0) {
    return dgx >= Math.abs(dgy) ? 'SE' : 'NE';
  }
  if (dgx < 0 && dgy >= 0) {
    return Math.abs(dgx) >= dgy ? 'NW' : 'SW';
  }
  return Math.abs(dgx) >= Math.abs(dgy) ? 'NW' : 'NE';
}
