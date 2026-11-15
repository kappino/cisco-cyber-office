export interface WalkPoint { gx: number; gy: number }
/** Four-way search avoids diagonal corner clipping and never targets blocked furniture. */
export function walkingPath(start: WalkPoint, end: WalkPoint, walkable: (x: number, y: number) => boolean): WalkPoint[] {
  const sx = Math.floor(start.gx), sy = Math.floor(start.gy);
  const ex = Math.floor(end.gx), ey = Math.floor(end.gy);
  if (!walkable(end.gx, end.gy)) return [];
  const key = (x: number, y: number) => `${x},${y}`;
  const queue = [[sx, sy]];
  const parents = new Map<string, number[] | null>([[key(sx, sy), null]]);
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    if (x === ex && y === ey) {
      const points: WalkPoint[] = [end];
      let previous = parents.get(key(x, y));
      while (previous && !(previous[0] === sx && previous[1] === sy)) {
        points.unshift({ gx: previous[0] + .5, gy: previous[1] + .5 });
        previous = parents.get(key(previous[0], previous[1]));
      }
      return points;
    }
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx > 7 || ny > 7 || parents.has(key(nx, ny)) || !walkable(nx + .5, ny + .5)) continue;
      parents.set(key(nx, ny), [x, y]); queue.push([nx, ny]);
    }
  }
  return [];
}
