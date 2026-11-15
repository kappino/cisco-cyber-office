import Phaser from 'phaser';
import { getIsometricDepth, gridToScreen } from './isoMath';

/** Small furnishings stay along the walls, leaving the central walking aisle open. */
export function buildCozyDecor(scene: Phaser.Scene, roomId: string): Phaser.GameObjects.GameObject[] {
  const objects: Phaser.GameObjects.GameObject[] = [];
  const plant = (gx: number, gy: number) => {
    const { x, y } = gridToScreen(gx, gy);
    const g = scene.add.graphics().setDepth(getIsometricDepth(gx, gy));
    g.fillStyle(0x000000, .55); g.fillEllipse(x, y + 12, 27, 11);
    g.fillStyle(0x9a3412); g.fillPoints([{ x: x - 9, y: y - 5 }, { x: x + 9, y: y - 5 }, { x: x + 6, y: y + 10 }, { x: x - 6, y: y + 10 }], true);
    g.fillStyle(0xb97a50); g.fillEllipse(x, y - 5, 19, 7);
    g.lineStyle(2, 0x58764b); g.lineBetween(x, y - 6, x, y - 35);
    g.fillStyle(0x759c68); g.fillEllipse(x - 7, y - 22, 17, 8); g.fillEllipse(x + 7, y - 29, 18, 9);
    g.fillStyle(0x9dbd78); g.fillEllipse(x - 5, y - 36, 14, 8);
    objects.push(g);
  };
  plant(1, 1); plant(6.6, 1); plant(1, 6.5);
  // Project every corner onto the north wall (gy=0), away from the west window.
  const wallPoint = (gx: number, height: number) => {
    const p = gridToScreen(gx, 0);
    return { x: p.x, y: p.y - height };
  };
  const board = scene.add.graphics().setDepth(4);
  const rectangle = (left: number, right: number, bottom: number, top: number, color: number) => {
    board.fillStyle(color);
    board.fillPoints([wallPoint(left, top), wallPoint(right, top), wallPoint(right, bottom), wallPoint(left, bottom)], true);
  };
  rectangle(1.35, 2.85, 46, 89, 0x795b3e);
  rectangle(1.42, 2.78, 49, 86, 0xd4b18a);
  [0xf3d58d, 0xb8d4c2, 0xc8d8e4].forEach((color, i) => {
    const x = 1.55 + i * .38;
    rectangle(x, x + .25, 58 + i % 2 * 6, 75 + i % 2 * 6, color);
    const a = wallPoint(x + .04, 68 + i % 2 * 6), b = wallPoint(x + .19, 68 + i % 2 * 6);
    board.lineStyle(1, 0x6e7a68, .5); board.lineBetween(a.x, a.y, b.x, b.y);
  });
  objects.push(board);
  const titlePosition = wallPoint(1.38, 99);
  const title = scene.add.text(titlePosition.x, titlePosition.y, roomId === 'office' ? 'BACHECA DEL TEAM' : roomId === 'corridor' ? 'LABORATORIO DIDATTICO' : 'COLLAUDI & CAFFÈ', { fontSize: '7px', fontFamily: 'sans-serif', color: '#526381', resolution: 3 }).setAngle(26.565).setDepth(4);
  objects.push(title);
  if (roomId !== 'office') {
    // Cabinets occupy cells already blocked by the room plan.
    const gx = roomId === 'corridor' ? 6.15 : 1.15;
    const gy = roomId === 'corridor' ? 5.1 : 4.15;
    const p = gridToScreen(gx, gy);
    const cabinet = scene.add.graphics().setDepth(getIsometricDepth(gx, gy));
    cabinet.fillStyle(0x000000, .55); cabinet.fillEllipse(p.x, p.y + 12, 70, 21);
    const top = [{ x:p.x-33,y:p.y-28 },{ x:p.x+7,y:p.y-48 },{ x:p.x+36,y:p.y-34 },{ x:p.x-4,y:p.y-14 }];
    cabinet.fillStyle(0xd8b68f); cabinet.fillPoints(top, true);
    cabinet.fillStyle(0xc3cdd9); cabinet.fillPoints([top[0],top[3],{x:p.x-4,y:p.y+12},{x:p.x-33,y:p.y-2}],true);
    cabinet.fillStyle(0x9baabd); cabinet.fillPoints([top[3],top[2],{x:p.x+36,y:p.y-8},{x:p.x-4,y:p.y+12}],true);
    cabinet.lineStyle(1,0x8192a8); cabinet.lineBetween(p.x+15,p.y-23,p.x+15,p.y+2);
    cabinet.fillStyle(0x677c96); cabinet.fillRect(p.x+9,p.y-11,5,2); cabinet.fillRect(p.x+19,p.y-16,5,2);
    // A tester, a coiled patch lead and a labelled storage box.
    cabinet.fillStyle(0x465976); cabinet.fillRoundedRect(p.x-12,p.y-41,15,13,2);
    cabinet.fillStyle(0xa9d5d1); cabinet.fillRect(p.x-9,p.y-38,9,5);
    cabinet.lineStyle(2,0xd9a46e); cabinet.strokeEllipse(p.x+15,p.y-35,13,6);
    cabinet.fillStyle(0xf0ede7); cabinet.fillRect(p.x+4,p.y-46,10,6);
    objects.push(cabinet);
    const wall = gridToScreen(0,5.8);
    const clock = scene.add.graphics().setDepth(getIsometricDepth(0,5.8));
    clock.fillStyle(0x526079); clock.fillCircle(wall.x,wall.y-56,12);
    clock.fillStyle(0xf7f8fc); clock.fillCircle(wall.x,wall.y-56,10);
    clock.lineStyle(1.5,0x526079); clock.lineBetween(wall.x,wall.y-56,wall.x,wall.y-63); clock.lineBetween(wall.x,wall.y-56,wall.x+5,wall.y-53);
    objects.push(clock);
  }
  return objects;
}
