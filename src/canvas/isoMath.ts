// Isometric Projection & Grid Math Constants
// Strict 2:1 Dimetric/Isometric Ratio (96x48)

export const GRID_SIZE = 8;
export const TILE_W = 96;
export const TILE_H = 48;
export const ORIGIN_Y = 205;

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

export const gridToScreen = (gx: number, gy: number, canvasW: number): { x: number; y: number } => {
  const originX = canvasW / 2;
  const sx = (gx - gy) * (TILE_W / 2) + originX;
  const sy = (gx + gy) * (TILE_H / 2) + ORIGIN_Y;
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
