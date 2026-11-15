import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

async function sourceModule(path) {
  const js = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
}
const { storyMissions } = await sourceModule('src/data/storyMissions.ts');
const { storyOffice } = await sourceModule('src/data/storyOffice.ts');
const { ROOM_CONFIGS } = await sourceModule('src/game/data/roomData.ts');
const { walkingPath } = await sourceModule('src/game/utils/walkingPath.ts');
const iso = await sourceModule('src/game/utils/isoMath.ts');
assert.equal(storyMissions.length, 6);
assert.equal(new Set(storyMissions.map(m => m.id)).size, 6);
for (const mission of storyMissions) {
  assert.ok(ROOM_CONFIGS[mission.room]);
  assert.ok(mission.correct >= 0 && mission.correct < mission.choices.length);
  assert.ok(mission.explanation.length > 100);
  assert.ok(mission.configuration.length > 0);
}
for (const [roomId, fixtures] of Object.entries(storyOffice)) {
  const room = ROOM_CONFIGS[roomId];
  const blocked = new Set([...fixtures.devices.filter(d => d.game).map(d => `${Math.floor(d.game.gx)},${Math.floor(d.game.gy)}`), ...fixtures.racks.map(r => `${Math.floor(r.gx)},${Math.floor(r.gy)}`)]);
  const walkable = (x, y) => room.solidGrid[Math.floor(x)]?.[Math.floor(y)] === 0 && !blocked.has(`${Math.floor(x)},${Math.floor(y)}`);
  assert.ok(walkable(room.defaultSpawn.gx, room.defaultSpawn.gy), `${roomId}: spawn libero`);
  let reachable = 0;
  for (let x = 1; x < 7; x++) for (let y = 1; y < 7; y++) {
    if (walkable(x + .5, y + .5) && walkingPath({ gx: room.defaultSpawn.gx, gy: room.defaultSpawn.gy }, { gx: x + .5, gy: y + .5 }, walkable).length) reachable++;
  }
  assert.ok(reachable > 12, `${roomId}: spazio esplorabile sufficiente (${reachable})`);
}
const free = (x, y) => x >= 1 && x < 7 && y >= 1 && y < 7 && !(Math.floor(x) === 3 && Math.floor(y) < 5);
const path = walkingPath({ gx: 2.5, gy: 2.5 }, { gx: 5.5, gy: 2.5 }, free);
assert.ok(path.length > 5);
path.forEach(p => assert.ok(free(p.gx, p.gy)));
assert.deepEqual(path.at(-1), { gx: 5.5, gy: 2.5 });
assert.deepEqual(walkingPath({ gx: 2.5, gy: 2.5 }, { gx: 3.5, gy: 2.5 }, free), []);
for (const gx of [0, 1.5, 4, 7.2]) for (const gy of [0, 2.4, 6]) {
  const p = iso.gridToScreen(gx, gy), r = iso.screenToGrid(p.x, p.y);
  assert.ok(Math.abs(r.gx - gx) < 1e-10 && Math.abs(r.gy - gy) < 1e-10);
}
console.log('PASS: missioni, configurazioni, spawn delle 3 stanze, aree raggiungibili, percorsi e geometria. Nessuna API chiamata.');
const { initialPractice, practiceCommand } = await sourceModule('src/utils/practiceConsole.ts');
let practice = { ...initialPractice };
const send = command => { const response = practiceCommand(practice, command); practice = response.state; return response.output; };
assert.match(send('ping stampante'), /nessuna risposta/);
send('switchport access vlan 10'); assert.equal(practice.printerVlan, 20, 'Configurazione fuori modalità rifiutata');
send('connect reception'); send('configure terminal'); send('interface Ethernet0/2'); send('switchport access vlan 10');
assert.match(send('ping stampante'), /4\/4/);
send('interface Ethernet0/0'); send('switchport trunk allowed vlan add 30');
assert.match(send('show interfaces trunk'), /10,20,30/);
send('copy running-config startup-config'); assert.equal(practice.saved, false, 'Salvataggio richiede EXEC');
send('end'); send('copy running-config startup-config'); assert.equal(practice.saved, true);
assert.equal(initialPractice.printerVlan, 20, 'Stato iniziale immutato');
assert.match(send('comando inesistente'), /non previsto/);
console.log('PASS: banco CLI, modalità, cavo, VLAN, trunk, ping e persistenza simulata.');
const { consoleKey } = await sourceModule('src/utils/consoleKeys.ts');
assert.equal(consoleKey('c', true, false, false), '\x03');
assert.equal(consoleKey('ArrowUp', false, false, false), '\x1b[A');
assert.equal(consoleKey('Enter', false, false, false), '\r');
assert.equal(consoleKey('Backspace', false, false, false), '\x7f');
assert.equal(consoleKey('Tab', false, false, false), null, 'Tab resta navigazione accessibile');
assert.equal(consoleKey('r', false, false, true), null, 'Shortcut del browser preservato');
assert.equal(consoleKey('?', false, false, false), '?');
console.log('PASS: tasti terminale, sequenze di controllo e navigazione browser.');
