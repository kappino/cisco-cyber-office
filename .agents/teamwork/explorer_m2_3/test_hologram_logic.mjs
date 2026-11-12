// Simulation test for drawCiscoHologram math and invariants
import assert from 'assert';

const GRID_SIZE = 8;
const TILE_W = 96;
const TILE_H = 48;
const ORIGIN_Y = 205;

function gridToScreen(gx, gy, canvasW) {
  const originX = canvasW / 2;
  const sx = (gx - gy) * (TILE_W / 2) + originX;
  const sy = (gx + gy) * (TILE_H / 2) + ORIGIN_Y;
  return { x: sx, y: sy };
}

console.log('Testing Hologram Isometric Coordinates at gx=4, gy=4...');
const pt = gridToScreen(4, 4, 840);
console.log(`pt.x = ${pt.x}, pt.y = ${pt.y}`);
assert.strictEqual(pt.x, 420, 'Hologram X should be centered at 420 on 840px canvas');
assert.strictEqual(pt.y, 397, 'Hologram Y screen origin should be 397');

const baseX = pt.x;
const baseY = pt.y + 24;
assert.strictEqual(baseX, 420);
assert.strictEqual(baseY, 421);

console.log('Testing 3D Rotation math across 360 frames...');
const barHeights = [10, 16, 22, 28, 36, 28, 22, 16, 10];
for (let frame = 0; frame < 360; frame++) {
  const rot = frame * 0.035;
  const holoBob = Math.sin(frame * 0.06) * 4;
  const holoCenterY = pt.y - 48 + holoBob;

  assert(!isNaN(holoCenterY), `holoCenterY is NaN at frame ${frame}`);

  // Test 9 bars
  for (let i = 0; i < 9; i++) {
    const angle = rot + (i - 4) * 0.26;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const bx = baseX + sinA * 26;
    const depthScale = (cosA + 1.6) / 2.6;
    const bh = barHeights[i] * depthScale;
    const bw = Math.max(2, 3.2 * depthScale);

    assert(!isNaN(bx) && isFinite(bx), `bx is invalid at frame ${frame}, bar ${i}`);
    assert(!isNaN(bh) && isFinite(bh), `bh is invalid at frame ${frame}, bar ${i}`);
    assert(!isNaN(bw) && isFinite(bw), `bw is invalid at frame ${frame}, bar ${i}`);
    assert(depthScale > 0.1 && depthScale <= 1.0, `depthScale ${depthScale} out of bounds`);
  }

  // Test Datacenter Shield
  const shieldRot = frame * 0.038;
  const cosR = Math.cos(shieldRot);
  const v0x = baseX - 18 * cosR;
  const v1x = baseX + 18 * cosR;
  assert(!isNaN(v0x) && isFinite(v0x));
  assert(!isNaN(v1x) && isFinite(v1x));

  // Test Sparks
  for (let s = 0; s < 5; s++) {
    const sSpeed = 0.04 + (s % 2) * 0.015;
    const sDir = (s % 2 === 0) ? 1 : -1;
    const sAngle = frame * sSpeed * sDir + s * ((Math.PI * 2) / 5);
    const sSin = Math.sin(sAngle);
    const sRadX = 26 + (s % 3) * 5;
    const sRadY = sRadX * 0.45;
    const sx = baseX + Math.cos(sAngle) * sRadX;
    const sy = holoCenterY + (s - 2) * 7 + sSin * sRadY;
    assert(!isNaN(sx) && isFinite(sx));
    assert(!isNaN(sy) && isFinite(sy));
  }
}

console.log('✅ All mathematical simulations passed with 0 NaN and bounded values!');
