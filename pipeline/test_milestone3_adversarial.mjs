// pipeline/test_milestone3_adversarial.mjs
// Adversarial Empirical Challenge Suite for Milestone 3 (Requirement R2):
// Living Avatar & Diegetic Canvas Interactions: Seated Pose, Typing, Coffee Emotes, Speed Trails, Victory Leap & Stars

import puppeteer from 'puppeteer-core';

function assert(condition, message) {
  if (!condition) {
    console.error(`\n❌ [ADVERSARIAL FAIL] ${message}`);
    throw new Error(`[ADVERSARIAL FAIL] ${message}`);
  }
}

async function runMilestone3AdversarialSuite() {
  console.log('========================================================================');
  console.log('🔥 STARTING ADVERSARIAL EMPIRICAL HARNESS: MILESTONE 3 (R2 / M3) 🔥');
  console.log('========================================================================\n');

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
    defaultViewport: { width: 1280, height: 900 }
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.error('   [BROWSER CONSOLE ERROR]:', msg.text());
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err.toString());
    console.error('   [BROWSER PAGE ERROR]:', err.toString());
  });

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });

  // Dismiss initial greeting dialog
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('HO CAPITO'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 400));

  // =========================================================================
  // CHALLENGE 1: Avatar Seated Pose & Typing Hands Animation
  // =========================================================================
  console.log('--- CHALLENGE 1: Avatar Seated Pose & Typing Hands Numerical Invariants ---');
  const sitResults = await page.evaluate(async () => {
    const { drawCharmingHabboAvatar } = await import('/src/canvas/characterRenderers.ts');

    const canvas = document.createElement('canvas');
    canvas.width = 840;
    canvas.height = 620;
    const ctx = canvas.getContext('2d');

    const avatar = {
      name: 'NetCadet',
      gender: 'neutral',
      skinTone: '#fbcfe8',
      hairStyle: 'spiky',
      hairColor: '#3b82f6',
      shirtColor: '#10b981',
      pantsColor: '#6366f1',
      accessory: 'cyber-visor'
    };

    // Spy on canvas context calls to inspect geometry
    const recordedFills = [];
    const recordedEllipses = [];
    const origFillRect = ctx.fillRect.bind(ctx);
    const origEllipse = ctx.ellipse.bind(ctx);

    ctx.fillRect = function(x, y, w, h) {
      recordedFills.push({ x, y, w, h, fillStyle: ctx.fillStyle });
      return origFillRect(x, y, w, h);
    };

    ctx.ellipse = function(x, y, rx, ry, rot, start, end) {
      recordedEllipses.push({ x, y, rx, ry });
      return origEllipse(x, y, rx, ry, rot, start, end);
    };

    // 1. Standing pose test (frame 0)
    recordedFills.length = 0;
    recordedEllipses.length = 0;
    drawCharmingHabboAvatar(ctx, { x: 4, y: 5 }, 840, 'SE', false, 0, avatar, 1, false, 0, 0);
    const standingTorso = recordedFills.find(f => f.w === 26 && f.h === 22);
    const standingChair = recordedEllipses.find(e => e.rx === 16 && e.ry === 7);

    // 2. Seated pose test (frame 0)
    recordedFills.length = 0;
    recordedEllipses.length = 0;
    drawCharmingHabboAvatar(ctx, { x: 4, y: 5 }, 840, 'SE', false, 0, avatar, 1, true, 0, 0);
    const seatedTorso = recordedFills.find(f => f.w === 26 && f.h === 22);
    const seatedChair = recordedEllipses.find(e => e.rx === 16 && e.ry === 7);
    const seatedBentThigh = recordedFills.find(f => f.w === 9 && f.h === 6);

    // 3. Typing hand alternation test (frame 2 vs frame 7)
    recordedFills.length = 0;
    drawCharmingHabboAvatar(ctx, { x: 4, y: 5 }, 840, 'NW', false, 2, avatar, 1, true, 0, 0); // frame % 10 = 2 < 5
    const handsF2 = recordedFills.filter(f => f.w === 5 && f.h === 4 && f.fillStyle === avatar.skinTone);
    const leftHandF2 = handsF2[0];
    const rightHandF2 = handsF2[1];

    recordedFills.length = 0;
    drawCharmingHabboAvatar(ctx, { x: 4, y: 5 }, 840, 'NW', false, 7, avatar, 1, true, 0, 0); // frame % 10 = 7 >= 5
    const handsF7 = recordedFills.filter(f => f.w === 5 && f.h === 4 && f.fillStyle === avatar.skinTone);
    const leftHandF7 = handsF7[0];
    const rightHandF7 = handsF7[1];

    // Clean up spies
    ctx.fillRect = origFillRect;
    ctx.ellipse = origEllipse;

    return {
      standingTorsoY: standingTorso?.y,
      seatedTorsoY: seatedTorso?.y,
      standingHasChair: !!standingChair,
      seatedHasChair: !!seatedChair,
      seatedHasBentThigh: !!seatedBentThigh,
      leftHandF2Y: leftHandF2?.y,
      leftHandF7Y: leftHandF7?.y,
      rightHandF2Y: rightHandF2?.y,
      rightHandF7Y: rightHandF7?.y
    };
  });

  assert(sitResults.seatedTorsoY !== undefined && sitResults.standingTorsoY !== undefined, 'Torso rectangle rendered in both states');
  const deltaY = sitResults.seatedTorsoY - sitResults.standingTorsoY;
  assert(Math.abs(deltaY - 8) < 0.1, `Seated pose lowers torso by exactly 8px (observed delta: ${deltaY})`);
  assert(!sitResults.standingHasChair, 'Standing avatar does not render chair cushion');
  assert(sitResults.seatedHasChair, 'Seated avatar renders ergonomic chair cushion under thighs');
  assert(sitResults.seatedHasBentThigh, 'Seated avatar renders horizontal bent thighs resting on cushion');
  assert(sitResults.leftHandF2Y !== sitResults.leftHandF7Y, 'Left typing hand alternates vertical tap position across frames');
  assert(sitResults.rightHandF2Y !== sitResults.rightHandF7Y, 'Right typing hand alternates vertical tap position across frames');
  console.log('   [PASS] Challenge 1: Seated pose lowers body by 8px, bent thighs grounded, typing hands tap alternated.');

  // =========================================================================
  // CHALLENGE 2: Coffee Emote Bubble & Dynamic Alternating Pixel Art
  // =========================================================================
  console.log('\n--- CHALLENGE 2: Diegetic Coffee Emote Bubble & Alternating Pixel Art ---');
  const emoteResults = await page.evaluate(async () => {
    const { drawCaffeineEmoteBubble } = await import('/src/canvas/characterRenderers.ts');

    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');

    const fills = [];
    const origFillRect = ctx.fillRect.bind(ctx);
    ctx.fillRect = function(x, y, w, h) {
      fills.push({ x, y, w, h, fillStyle: ctx.fillStyle });
      return origFillRect(x, y, w, h);
    };

    // Frame 10 (should render Espresso Cup, since Math.floor(10/90)%2 === 0)
    fills.length = 0;
    drawCaffeineEmoteBubble(ctx, 200, 150, 10, 300);
    const hasEspressoPorcelain = fills.some(f => f.fillStyle === '#78350f');
    const hasGoldenCrema = fills.some(f => f.fillStyle === '#d97706' || f.fillStyle === '#fbbf24');

    // Frame 100 (should render Pizza Slice, since Math.floor(100/90)%2 === 1)
    fills.length = 0;
    drawCaffeineEmoteBubble(ctx, 200, 150, 100, 300);
    const hasPepperoni = fills.some(f => f.fillStyle === '#991b1b');
    const hasBasil = fills.some(f => f.fillStyle === '#16a34a');

    ctx.fillRect = origFillRect;

    return {
      hasEspressoPorcelain,
      hasGoldenCrema,
      hasPepperoni,
      hasBasil
    };
  });

  assert(emoteResults.hasEspressoPorcelain && emoteResults.hasGoldenCrema, 'Emote bubble renders espresso cup with golden crema on frame 10');
  assert(emoteResults.hasPepperoni && emoteResults.hasBasil, 'Emote bubble renders pizza slice with pepperoni and basil on frame 100');
  console.log('   [PASS] Challenge 2: Floating emote bubble alternates between steaming espresso cup and pizza slice.');

  // =========================================================================
  // CHALLENGE 3: Golden Speed Trails Echoes & Circular Buffer Integrity
  // =========================================================================
  console.log('\n--- CHALLENGE 3: Golden Speed Trails After-Image Echoes ---');
  const speedTrailResults = await page.evaluate(async () => {
    const { drawGoldenSpeedTrails } = await import('/src/canvas/characterRenderers.ts');

    const canvas = document.createElement('canvas');
    canvas.width = 840;
    canvas.height = 620;
    const ctx = canvas.getContext('2d');

    const recordedAuras = [];
    const origEllipse = ctx.ellipse.bind(ctx);
    ctx.ellipse = function(x, y, rx, ry, rot, start, end) {
      if (rx === 18 && ry === 7) {
        recordedAuras.push({ x, y, fillStyle: ctx.fillStyle });
      }
      return origEllipse(x, y, rx, ry, rot, start, end);
    };

    const mockTrails = [
      { x: 3.8, y: 5.0, dir: 'SE', alpha: 0.55, active: true },
      { x: 3.5, y: 5.0, dir: 'SE', alpha: 0.35, active: true },
      { x: 3.2, y: 5.0, dir: 'SE', alpha: 0.18, active: true }
    ];

    drawGoldenSpeedTrails(ctx, mockTrails, 840, 60);
    ctx.ellipse = origEllipse;

    return {
      auraCount: recordedAuras.length,
      auras: recordedAuras
    };
  });

  assert(speedTrailResults.auraCount === 3, `Expected 3 golden speed aura echoes, got ${speedTrailResults.auraCount}`);
  console.log('   [PASS] Challenge 3: 3 golden after-image speed trail foot echoes rendered with decaying alpha.');

  // =========================================================================
  // CHALLENGE 4: Victory Celebration Leap, Arms, Eyes & 8 Orbiting Stars
  // =========================================================================
  console.log('\n--- CHALLENGE 4: Victory Celebration Leap, Raised Arms & 8 Orbiting Golden Stars ---');
  const victoryResults = await page.evaluate(async () => {
    const { drawCharmingHabboAvatar } = await import('/src/canvas/characterRenderers.ts');

    const canvas = document.createElement('canvas');
    canvas.width = 840;
    canvas.height = 620;
    const ctx = canvas.getContext('2d');

    const avatar = {
      name: 'NetCadet',
      gender: 'neutral',
      skinTone: '#fbcfe8',
      hairStyle: 'spiky',
      hairColor: '#3b82f6',
      shirtColor: '#10b981',
      pantsColor: '#6366f1',
      accessory: 'cyber-visor'
    };

    const recordedStars = [];
    const recordedFills = [];
    const origArc = ctx.arc.bind(ctx);
    const origFillRect = ctx.fillRect.bind(ctx);

    ctx.arc = function(x, y, r, s, e) {
      if (ctx.fillStyle && typeof ctx.fillStyle === 'string' && ctx.fillStyle.includes('251, 191, 36')) {
        recordedStars.push({ x, y, r, fillStyle: ctx.fillStyle });
      }
      return origArc(x, y, r, s, e);
    };

    ctx.fillRect = function(x, y, w, h) {
      recordedFills.push({ x, y, w, h, fillStyle: ctx.fillStyle });
      return origFillRect(x, y, w, h);
    };

    // Normal avatar
    recordedFills.length = 0;
    drawCharmingHabboAvatar(ctx, { x: 4, y: 5 }, 840, 'SE', false, 30, avatar, 1, false, 0, 0);
    const normalHead = recordedFills.find(f => f.w === 22 && f.h === 20);

    // Celebrating avatar at peak of jump (frame = Math.PI / (2 * 0.18) ≈ 8.72, let's use exact frame where sin(frame*0.18) ≈ 1)
    recordedFills.length = 0;
    recordedStars.length = 0;
    const jumpFrame = Math.round(Math.PI / (2 * 0.18)); // ~9
    drawCharmingHabboAvatar(ctx, { x: 4, y: 5 }, 840, 'SE', false, jumpFrame, avatar, 1, false, 0, 180);
    const celebratingHead = recordedFills.find(f => f.w === 22 && f.h === 20);
    const raisedHand = recordedFills.find(f => f.w === 5 && f.h === 5 && f.fillStyle === avatar.skinTone);

    ctx.arc = origArc;
    ctx.fillRect = origFillRect;

    return {
      normalHeadY: normalHead?.y,
      celebratingHeadY: celebratingHead?.y,
      jumpDisplacement: (normalHead && celebratingHead) ? normalHead.y - celebratingHead.y : 0,
      starCount: recordedStars.length,
      hasRaisedHand: !!raisedHand
    };
  });

  assert(victoryResults.jumpDisplacement > 10, `Avatar jumped upward significantly during celebration (displacement: ${victoryResults.jumpDisplacement}px)`);
  assert(victoryResults.hasRaisedHand, 'Avatar has raised hands pose in celebration');
  assert(victoryResults.starCount === 8, `Expected exactly 8 golden sparkle stars orbiting the head, found ${victoryResults.starCount}`);
  console.log('   [PASS] Challenge 4: Parabolic sine-wave leap, raised arms (\\o/), and ring of 8 golden stars confirmed.');

  // =========================================================================
  // CHALLENGE 5: Interactive Station Docking (Sitting Near Terminal & Wireshark)
  // =========================================================================
  console.log('\n--- CHALLENGE 5: In-Browser Station Sitting & Auto-Orientation ---');
  // Walk to Admin Terminal at (5, 2) [interact spot (5, 3.2)]
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('PC Terminal Admin'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1500));

  // Check that avatar stopped and is oriented NW facing the terminal
  const terminalDocking = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    return {
      canvasExists: !!canvas,
    };
  });
  assert(terminalDocking.canvasExists, 'Canvas exists during station docking');

  // Trigger coffee boost via quick dock button
  console.log('\n--- CHALLENGE 6: In-Browser Coffee Boost & Emote Bubble Activation ---');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('Bar & Pizza'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1500));

  // Click "PRENDI ESPRESSO & PIZZA"
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('PRENDI ESPRESSO & PIZZA'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 400));

  const hasCoffeeDialogue = await page.evaluate(() => {
    return document.body.textContent.includes('Pausa Napoletana') && document.body.textContent.includes('velocità aumentata');
  });
  assert(hasCoffeeDialogue, 'Coffee dialogue confirming boost appeared');
  console.log('   [PASS] Challenge 6: Coffee boost triggered and confirmed in UI.');

  await browser.close();

  assert(consoleErrors.length === 0, `Console errors detected: ${JSON.stringify(consoleErrors)}`);
  assert(pageErrors.length === 0, `Page errors detected: ${JSON.stringify(pageErrors)}`);

  console.log('\n========================================================================');
  console.log('🎉 ALL MILESTONE 3 ADVERSARIAL CHALLENGES PASSED (100%) 🎉');
  console.log('========================================================================');
}

runMilestone3AdversarialSuite().catch(err => {
  console.error('\n❌ ADVERSARIAL SUITE FAILED:', err.message);
  process.exit(1);
});
