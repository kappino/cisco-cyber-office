// Isometric Projection & Grid Math Constants
// Strict 2:1 Dimetric/Isometric Ratio (96x48)

export const GRID_SIZE = 8;
export const TILE_W = 96;
export const TILE_H = 48;
export const ORIGIN_Y = 215;

// Split-Level Raised Tech Mezzanine Constants
export const ELEVATION_H = 18;
export const MEZZ_MAX_X = 5;
export const MEZZ_MAX_Y = 3;
export const STAIR_MIN_X = 2.0;
export const STAIR_MAX_X = 3.8;
export const STAIR_START_Y = 2.4; // Full +18px elevation at <= 2.4, ramps to 0px at >= 3.0

export interface TilePos {
  x: number;
  y: number;
}

export type Direction = 'SE' | 'SW' | 'NE' | 'NW';

export interface Entity {
  id: string;
  depth: number;
  draw: (ctx: CanvasRenderingContext2D, animFrame: number) => void;
}

/**
 * Returns true if (gx, gy) lies within the raised mezzanine footprint [0..5) x [0..3).
 */
export const isInMezzanineFootprint = (gx: number, gy: number): boolean => {
  return gx >= 0 && gx < MEZZ_MAX_X && gy >= 0 && gy < MEZZ_MAX_Y;
};

/**
 * Computes continuous floor elevation in pixels at grid coordinate (gx, gy).
 * Returns ELEVATION_H (18px) on the raised platform, smoothly ramps down along
 * the central staircase (gx in [2.0..3.8], gy in [2.4..3.0]), and 0 on the main floor.
 */
export const getElevationAt = (gx: number, gy: number): number => {
  if (gx >= 0 && gx < MEZZ_MAX_X && gy >= 0 && gy < MEZZ_MAX_Y) {
    if (gx >= STAIR_MIN_X && gx <= STAIR_MAX_X && gy >= STAIR_START_Y) {
      const t = (MEZZ_MAX_Y - gy) / (MEZZ_MAX_Y - STAIR_START_Y);
      return ELEVATION_H * Math.max(0, Math.min(1, t));
    }
    return ELEVATION_H;
  }
  return 0;
};

export const gridToScreen = (
  gx: number,
  gy: number,
  canvasW: number,
  elevPx: number = 0
): { x: number; y: number } => {
  const originX = canvasW / 2;
  const sx = (gx - gy) * (TILE_W / 2) + originX;
  const sy = (gx + gy) * (TILE_H / 2) + ORIGIN_Y - elevPx;
  return { x: sx, y: sy };
};

export const screenToGrid = (sx: number, sy: number, canvasW: number): TilePos => {
  const originX = canvasW / 2;
  const dx = sx - originX;
  const dy = sy - ORIGIN_Y;
  const gx = (dx / (TILE_W / 2) + dy / (TILE_H / 2)) / 2;
  const gy = (dy / (TILE_H / 2) - dx / (TILE_W / 2)) / 2;
  return { x: gx, y: gy };
};

/**
 * Elevation-aware inverse projection from screen coordinates to floor grid.
 * Checks the raised mezzanine surface first (shifted by +ELEVATION_H in sy),
 * then falls back to the main floor plane.
 */
export const screenToGridWithElevation = (
  sx: number,
  sy: number,
  canvasW: number
): TilePos => {
  const upper = screenToGrid(sx, sy + ELEVATION_H, canvasW);
  if (upper.x >= -0.15 && upper.x < MEZZ_MAX_X && upper.y >= -0.15 && upper.y < MEZZ_MAX_Y) {
    // Check if the click is actually on the front/side step riser below the upper deck
    if (upper.x >= STAIR_MIN_X && upper.x <= STAIR_MAX_X && upper.y >= STAIR_START_Y) {
      // Approximate mid-stair elevation
      return screenToGrid(sx, sy + ELEVATION_H * 0.5, canvasW);
    }
    return upper;
  }

  const lower = screenToGrid(sx, sy, canvasW);
  // If user clicked on the vertical riser face between upper and lower planes,
  // snap cleanly onto the adjacent lower floor tile just outside the platform.
  if (lower.x >= 0 && lower.x < MEZZ_MAX_X && lower.y >= 0 && lower.y < MEZZ_MAX_Y) {
    if (lower.x >= STAIR_MIN_X && lower.x <= STAIR_MAX_X && lower.y >= STAIR_START_Y) {
      return screenToGrid(sx, sy + ELEVATION_H * 0.5, canvasW);
    }
    if (MEZZ_MAX_Y - lower.y <= MEZZ_MAX_X - lower.x) {
      return { x: lower.x, y: MEZZ_MAX_Y + 0.25 };
    }
    return { x: MEZZ_MAX_X + 0.25, y: lower.y };
  }

  return lower;
};
