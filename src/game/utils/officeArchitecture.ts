import Phaser from 'phaser';
import { gridToScreen } from './isoMath';

/** The coffee gallery is a shallow split level, reached by the full-width steps. */
export function officeElevation(gx: number, gy: number): number {
  if (gx > 2.5) return 0;
  return Math.max(0, Math.min(1, (gy - 4.2) / 0.8)) * 12;
}

/** Code-native illustration: shared geometry keeps furnishings and navigation aligned. */
export function buildOfficeArchitecture(scene: Phaser.Scene): Phaser.GameObjects.GameObject[] {
  const objects: Phaser.GameObjects.GameObject[] = [];
  const graphics = (depth: number) => {
    const g = scene.add.graphics().setDepth(depth);
    objects.push(g);
    return g;
  };
  const polygon = (g: Phaser.GameObjects.Graphics, points: number[][], color: number, alpha = 1) => {
    g.fillStyle(color, alpha);
    g.fillPoints(points.map(([x, y]) => ({ x, y })), true);
  };
  const point = (x: number, y: number, h = 0): number[] => {
    const p = gridToScreen(x, y);
    return [p.x, p.y - h];
  };
  const slab = (g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, d: number, h: number, top: number, left: number, right: number, base = 0) => {
    const a = point(x, y, h + base), b = point(x + w, y, h + base);
    const c = point(x + w, y + d, h + base), e = point(x, y + d, h + base);
    polygon(g, [e, c, point(x + w, y + d, base), point(x, y + d, base)], left);
    polygon(g, [b, c, point(x + w, y + d, base), point(x + w, y, base)], right);
    polygon(g, [a, b, c, e], top);
  };

  // L-shaped foundation; the inset foreground corner makes the plan legible.
  const outline = [[0, 0], [8, 0], [8, 6], [6, 6], [6, 8], [0, 8]];
  const foundation = graphics(-10);
  const ground = outline.map(([x, y]) => point(x, y));
  polygon(foundation, ground.map(([x, y]) => [x + 8, y + 24]), 0x040b13, 0.45);
  for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length;
    const a = ground[i], b = ground[j];
    polygon(foundation, [a, b, [b[0], b[1] + 14], [a[0], a[1] + 14]], i % 2 ? 0x807669 : 0xaba08d);
  }
  const floor = graphics(0);
  for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) {
    if (x >= 6 && y >= 6) continue;
    const h = officeElevation(x + 0.5, y + 0.5);
    const colors = [0xc79d70, 0xbd9164, 0xd0a779];
    polygon(floor, [point(x, y, h), point(x + 1, y, h), point(x + 1, y + 1, h), point(x, y + 1, h)], colors[(x * 3 + y) % 3]);
    floor.lineStyle(0.6, 0x75573e, 0.28);
    const a = point(x, y + 0.5, h), b = point(x + 1, y + 0.5, h);
    floor.lineBetween(a[0], a[1], b[0], b[1]);
  }
  // Warm limestone coffee platform, three visible treads and an open circulation spine.
  slab(floor, 0, 5, 2.5, 3, 12, 0xd8c9ac, 0xa3947b, 0xb4a58c);
  for (let i = 0; i < 3; i++) slab(floor, 0, 4.2 + i * 0.27, 2.5, 0.27, (i + 1) * 4, 0xe8ddc7, 0xac9c84, 0xb6a58c);
  polygon(floor, [point(2.8, 2.2), point(5.6, 2.2), point(5.6, 4.6), point(2.8, 4.6)], 0x7a89a3);
  floor.lineStyle(1, 0xb6c1d7, 0.75);
  floor.strokePoints([point(2.9, 2.3), point(5.5, 2.3), point(5.5, 4.5), point(2.9, 4.5)].map(([x,y])=>({x,y})), true);

  // Plaster walls, oak cap and a generous opening onto the gulf.
  const walls = graphics(3);
  polygon(walls, [point(0, 0), point(0, 8), point(0, 8, 100), point(0, 0, 100)], 0xd6d4c5);
  polygon(walls, [point(0, 0), point(8, 0), point(8, 0, 100), point(0, 0, 100)], 0xeee8d8);
  walls.lineStyle(4, 0xb89a71);
  for (const [x,y] of [[0,8],[8,0]]) {
    const a=point(0,0,100), b=point(x,y,100);
    walls.lineBetween(a[0],a[1],b[0],b[1]);
  }
  walls.lineStyle(3, 0x9b8e78);
  for (const [x,y] of [[0,8],[8,0]]) {
    const a=point(0,0), b=point(x,y);
    walls.lineBetween(a[0],a[1],b[0],b[1]);
  }
  const windowPos = gridToScreen(0, 3.9);
  const window = scene.add.image(windowPos.x, windowPos.y - 52, 'window_vesuvius_iso_morning').setScale(1 / 3).setDepth(4);
  window.setName('office-panorama');
  objects.push(window);
  const light = graphics(1);
  polygon(light, [point(0.2,1.1),point(0.2,6.6),point(3.5,6.6),point(3.5,1.1)], 0xffedb4, 0.16);

  const label = (x:number,y:number,text:string) => {
    const p=gridToScreen(x,y);
    objects.push(scene.add.text(p.x,p.y-67,text,{fontFamily:'Arial, sans-serif',fontSize:'9px',resolution:3,fontStyle:'bold',color:'#52605c',letterSpacing:2}).setDepth(4).setOrigin(0.5).setAngle(26.565));
  };
  label(3.1,0,'CISCO / STUDIO RETI');


  // Furnishings hug the perimeter; the route between mentor, coffee and door stays clear.
  const planter = (x:number,y:number) => {
    const g=graphics((x+y)*10+5), h=officeElevation(x,y);
    slab(g,x-0.2,y-0.2,0.4,0.4,12,0xd2ad86,0x9a7353,0xb68c66,h);
    const p=point(x,y,h+20);
    g.lineStyle(2,0x486b4b);
    g.lineBetween(p[0],p[1]+10,p[0],p[1]-13);
    for(let i=0;i<6;i++) {
      g.fillStyle(i%2?0x567c54:0x75905d);
      g.fillEllipse(p[0]+(i%2?7:-7),p[1]-i*3,17,7);
    }
  };
  planter(0.55,0.7); planter(0.65,7.2); planter(5.7,0.65); planter(7.2,5.5);
  const shelf=graphics(30);
  slab(shelf,0.8,0.35,1.3,0.45,31,0xb9976c,0x8d7355,0x6b5946);
  for(let i=0;i<8;i++) {
    const p=point(0.95+i*0.13,0.82,22);
    shelf.fillStyle([0x537e83,0xe6d7b3,0xb46e51,0x6c8062][i%4]);
    shelf.fillRect(p[0],p[1]-6,3,10);
  }
  const lounge=graphics(99);
  slab(lounge,3.3,6.3,1.9,0.65,11,0x6d7da4,0x455671,0x566987);
  slab(lounge,3.3,6.8,1.9,0.18,26,0x8796b6,0x566987,0x455671);
  slab(lounge,3.2,6.25,0.18,0.75,20,0x8796b6,0x566987,0x455671);
  slab(lounge,5.2,6.25,0.18,0.75,20,0x8796b6,0x566987,0x455671);
  slab(lounge,3.8,5.35,1.1,0.55,12,0xe7dfce,0xb9b0a0,0xcac1b0);
  const magazine=point(4.15,5.55,13);
  lounge.fillStyle(0xc47d59); lounge.fillRect(magazine[0]-6,magazine[1]-3,12,6);
  return objects;
}
