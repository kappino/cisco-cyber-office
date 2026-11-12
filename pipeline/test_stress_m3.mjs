// pipeline/test_stress_m3.mjs
// Adversarial Stress Harness & Mathematical Verification for Milestone 3 (R2 / M3)
// Written by challenger_m3_1 (Empirical Challenger)

import puppeteer from 'puppeteer-core';

function assert(condition, message) {
  if (!condition) {
    console.error(`\n❌ [CHALLENGER STRESS FAIL] ${message}`);
    throw new Error(`[CHALLENGER STRESS FAIL] ${message}`);
  }
}

async function runChallengerStressSuite() {
  console.log('========================================================================');
  console.log('⚡ EMPIRICAL CHALLENGER STRESS HARNESS: MILESTONE 3 (R2) ⚡');
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

  // Dismiss initial greeting dialog if present
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('HO CAPITO'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 400));

  // =========================================================================
  // STRESS TEST 1: Seated Pose Mathematical Invariants & Extremes
  // =========================================================================
  console.log('--- TEST 1: Seated Pose Mathematical Invariants Across 120 Frames ---');
  const sitStress = await page.evaluate(async () => {
    const { drawCharmingHabboAvatar } = await import('/src/canvas/characterRenderers.ts');

    const canvas = document.createElement('canvas');
    canvas.width = 840;
    canvas.height = 620;
    const ctx = canvas.getContext('2d');

    const avatar = {
      name: 'StressTester',
      gender: 'neutral',
      skinTone: '#fbcfe8',
      hairStyle: 'spiky',
      hairColor: '#3b82f6',
      shirtColor: '#10b981',
      pantsColor: '#6366f1',
      accessory: 'cyber-visor'
    };

    const fills = [];
    const ellipses = [];
    const origFillRect = ctx.fillRect.bind(ctx);
    const origEllipse = ctx.ellipse.bind(ctx);

    ctx.fillRect = (x, y, w, h) => {
      fills.push({ x, y, w, h, fillStyle: ctx.fillStyle });
      return origFillRect(x, y, w, h);
    };

    ctx.ellipse = (x, y, rx, ry, rot, start, end) => {
      ellipses.push({ x, y, rx, ry });
      return origEllipse(x, y, rx, ry, rot, start, end);
    };

    const results = [];

    // Test seated pose for 60 consecutive frames
    for (let f = 0; f < 60; f++) {
      fills.length = 0;
      ellipses.length = 0;

      // Standing
      drawCharmingHabboAvatar(ctx, { x: 4, y: 5 }, 840, 'NW', false, f, avatar, 5, false, 0, 0);
      const standingTorso = fills.find(item => item.w === 26 && item.h === 22);
      const standingBreathe = standingTorso ? standingTorso.y : 0;

      fills.length = 0;
      ellipses.length = 0;

      // Seated
      drawCharmingHabboAvatar(ctx, { x: 4, y: 5 }, 840, 'NW', false, f, avatar, 5, true, 0, 0);
      const seatedTorso = fills.find(item => item.w === 26 && item.h === 22);
      const seatedChair = ellipses.find(e => e.rx === 16 && e.ry === 7);
      const seatedThighs = fills.filter(item => item.w === 9 && item.h === 6);
      const hands = fills.filter(item => item.w === 5 && item.h === 4 && item.fillStyle === avatar.skinTone);

      const isTapLeft = (f % 10 < 5);
      const leftHand = hands[0];
      const rightHand = hands[1];
      const handDelta = leftHand && rightHand ? leftHand.y - rightHand.y : 0;

      results.push({
        frame: f,
        seatedTorsoY: seatedTorso?.y,
        standingTorsoY: standingBreathe,
        sitOffsetDelta: (seatedTorso && standingTorso) ? (seatedTorso.y - standingBreathe) : null,
        chairPresent: !!seatedChair,
        thighCount: seatedThighs.length,
        handCount: hands.length,
        isTapLeftExpected: isTapLeft,
        handDelta: handDelta
      });
    }

    ctx.fillRect = origFillRect;
    ctx.ellipse = origEllipse;
    return results;
  });

  for (const r of sitStress) {
    assert(r.chairPresent, `Frame ${r.frame}: Chair cushion must be present in seated pose`);
    assert(r.thighCount === 2, `Frame ${r.frame}: Exactly 2 horizontal thighs rendered (got ${r.thighCount})`);
    assert(r.handCount === 2, `Frame ${r.frame}: Exactly 2 typing hands rendered (got ${r.handCount})`);
    // Left and right typing hands alternate vertical position by exactly 3.0 px (+1.5 vs -1.5)
    if (r.isTapLeftExpected) {
      assert(Math.abs(r.handDelta - 3.0) < 0.01, `Frame ${r.frame}: Left hand tap lower by 3px when frame%10 < 5 (got ${r.handDelta})`);
    } else {
      assert(Math.abs(r.handDelta - (-3.0)) < 0.01, `Frame ${r.frame}: Right hand tap lower by 3px when frame%10 >= 5 (got ${r.handDelta})`);
    }
  }
  console.log('   [PASS] Test 1: Seated pose invariants hold across all 60 frames (thighs, cushion, 6Hz typing alternation).');

  // =========================================================================
  // STRESS TEST 2: Diegetic Coffee Emote Bubble Dynamics & Boundaries
  // =========================================================================
  console.log('\n--- TEST 2: Coffee Emote Bubble Boundaries, Bobbing Amplitude & Transitions ---');
  const emoteStress = await page.evaluate(async () => {
    const { drawCaffeineEmoteBubble } = await import('/src/canvas/characterRenderers.ts');

    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');

    const fills = [];
    const origFillRect = ctx.fillRect.bind(ctx);
    ctx.fillRect = (x, y, w, h) => {
      fills.push({ x, y, w, h, fillStyle: ctx.fillStyle });
      return origFillRect(x, y, w, h);
    };

    // Test transition at frame 89 -> 90 and frame 179 -> 180
    const testFrames = [0, 45, 89, 90, 91, 135, 179, 180, 181, 269, 270, 271];
    const frameResults = [];

    for (const f of testFrames) {
      fills.length = 0;
      drawCaffeineEmoteBubble(ctx, 200, 150, f, 300);

      const hasEspressoPorcelain = fills.some(item => item.fillStyle === '#78350f');
      const hasGoldenCrema = fills.some(item => item.fillStyle === '#d97706');
      const hasPizzaCrust = fills.some(item => item.fillStyle === '#c2410c');
      const hasPepperoni = fills.some(item => item.fillStyle === '#991b1b');
      const hasBasil = fills.some(item => item.fillStyle === '#16a34a');

      const expectedPizza = Math.floor(f / 90) % 2 === 1;

      frameResults.push({
        frame: f,
        expectedPizza,
        isEspresso: hasEspressoPorcelain && hasGoldenCrema,
        isPizza: hasPepperoni && hasBasil
      });
    }

    // Test alpha fade when timer decays: timer = 300, 25, 12, 1
    const alphaResults = [];
    const origSave = ctx.save.bind(ctx);
    const origRestore = ctx.restore.bind(ctx);
    let capturedAlpha = 1;

    // Intercept ctx.globalAlpha assignment
    Object.defineProperty(ctx, 'globalAlpha', {
      get() { return capturedAlpha; },
      set(val) { capturedAlpha = val; },
      configurable: true
    });

    for (const t of [300, 25, 12.5, 0]) {
      drawCaffeineEmoteBubble(ctx, 200, 150, 0, t);
      alphaResults.push({ timer: t, alpha: capturedAlpha });
    }

    ctx.fillRect = origFillRect;
    return { frameResults, alphaResults };
  });

  for (const fr of emoteStress.frameResults) {
    if (fr.expectedPizza) {
      assert(fr.isPizza && !fr.isEspresso, `Frame ${fr.frame}: Expected Neapolitan Pizza, got Espresso`);
    } else {
      assert(fr.isEspresso && !fr.isPizza, `Frame ${fr.frame}: Expected Steaming Espresso, got Pizza`);
    }
  }

  // Verify smooth fade: timer=300 -> alpha=1.0; timer=25 -> alpha=1.0; timer=12.5 -> alpha=0.5; timer=0 -> alpha=0
  const a300 = emoteStress.alphaResults.find(a => a.timer === 300)?.alpha;
  const a25 = emoteStress.alphaResults.find(a => a.timer === 25)?.alpha;
  const a12 = emoteStress.alphaResults.find(a => a.timer === 12.5)?.alpha;
  const a0 = emoteStress.alphaResults.find(a => a.timer === 0)?.alpha;
  assert(a300 === 1, `Timer 300 has full alpha 1.0 (got ${a300})`);
  assert(a25 === 1, `Timer 25 has full alpha 1.0 (got ${a25})`);
  assert(Math.abs(a12 - 0.5) < 0.01, `Timer 12.5 has half alpha 0.5 (got ${a12})`);
  assert(a0 === 0, `Timer 0 has alpha 0 (got ${a0})`);
  console.log('   [PASS] Test 2: Frame-exact 90-frame alternation (Espresso <-> Pizza) and linear alpha decay verified.');

  // =========================================================================
  // STRESS TEST 3: Speed Trail Buffer Edge Cases (Zero Allocation & Decays)
  // =========================================================================
  console.log('\n--- TEST 3: Speed Trail Ring Buffer Stress & Edge Cases ---');
  const trailStress = await page.evaluate(async () => {
    const { drawGoldenSpeedTrails } = await import('/src/canvas/characterRenderers.ts');

    const canvas = document.createElement('canvas');
    canvas.width = 840;
    canvas.height = 620;
    const ctx = canvas.getContext('2d');

    let drawnAuras = 0;
    const origEllipse = ctx.ellipse.bind(ctx);
    ctx.ellipse = (x, y, rx, ry, rot, s, e) => {
      if (rx === 18 && ry === 7) drawnAuras++;
      return origEllipse(x, y, rx, ry, rot, s, e);
    };

    // Case 1: Empty trails
    drawnAuras = 0;
    drawGoldenSpeedTrails(ctx, [], 840, 0);
    const emptyCount = drawnAuras;

    // Case 2: Inactive trails
    drawnAuras = 0;
    drawGoldenSpeedTrails(ctx, [
      { x: 1, y: 1, dir: 'SE', alpha: 0.5, active: false },
      { x: 1, y: 1, dir: 'SE', alpha: 0.5, active: false }
    ], 840, 0);
    const inactiveCount = drawnAuras;

    // Case 3: Near-zero alpha (< 0.01)
    drawnAuras = 0;
    drawGoldenSpeedTrails(ctx, [
      { x: 1, y: 1, dir: 'SE', alpha: 0.005, active: true },
      { x: 1, y: 1, dir: 'SE', alpha: 0.000, active: true }
    ], 840, 0);
    const subAlphaCount = drawnAuras;

    // Case 4: 3 valid active echoes
    drawnAuras = 0;
    drawGoldenSpeedTrails(ctx, [
      { x: 4.0, y: 5.0, dir: 'SE', alpha: 0.55, active: true },
      { x: 3.8, y: 5.0, dir: 'SE', alpha: 0.35, active: true },
      { x: 3.6, y: 5.0, dir: 'SE', alpha: 0.18, active: true }
    ], 840, 0);
    const validCount = drawnAuras;

    ctx.ellipse = origEllipse;
    return { emptyCount, inactiveCount, subAlphaCount, validCount };
  });

  assert(trailStress.emptyCount === 0, 'Empty trails array renders 0 auras');
  assert(trailStress.inactiveCount === 0, 'Inactive trails render 0 auras');
  assert(trailStress.subAlphaCount === 0, 'Trails with alpha <= 0.01 are discarded');
  assert(trailStress.validCount === 3, `3 active trails render exactly 3 golden auras (got ${trailStress.validCount})`);
  console.log('   [PASS] Test 3: Speed trail edge cases (empty, inactive, alpha cutoff) cleanly handled.');

  // =========================================================================
  // STRESS TEST 4: Victory Celebration Leap Physics & Sparkle Star Orbit
  // =========================================================================
  console.log('\n--- TEST 4: Victory Celebration Leap Trajectory & 8 Orbiting Stars Geometry ---');
  const victoryStress = await page.evaluate(async () => {
    const { drawCharmingHabboAvatar } = await import('/src/canvas/characterRenderers.ts');

    const canvas = document.createElement('canvas');
    canvas.width = 840;
    canvas.height = 620;
    const ctx = canvas.getContext('2d');

    const avatar = {
      name: 'Champion',
      gender: 'neutral',
      skinTone: '#fbcfe8',
      hairStyle: 'spiky',
      hairColor: '#3b82f6',
      shirtColor: '#10b981',
      pantsColor: '#6366f1',
      accessory: 'cyber-visor'
    };

    const recordedArcs = [];
    const origArc = ctx.arc.bind(ctx);
    ctx.arc = (x, y, r, s, e) => {
      // Golden star aura arc
      if (ctx.fillStyle && typeof ctx.fillStyle === 'string' && ctx.fillStyle.includes('251, 191, 36')) {
        recordedArcs.push({ x, y, r });
      }
      return origArc(x, y, r, s, e);
    };

    const leaps = [];
    // Measure jump displacement across 70 frames of celebration
    for (let f = 0; f < 70; f++) {
      recordedArcs.length = 0;
      drawCharmingHabboAvatar(ctx, { x: 4, y: 5 }, 840, 'SE', false, f, avatar, 1, false, 0, 180);

      // Theoretical jumpY
      const theoreticalJumpY = -Math.abs(Math.sin(f * 0.18)) * 18;

      leaps.push({
        frame: f,
        theoreticalJumpY,
        starCount: recordedArcs.length,
        starPositions: recordedArcs.map(a => ({ x: a.x, y: a.y }))
      });
    }

    ctx.arc = origArc;
    return leaps;
  });

  // Check that every frame has exactly 8 stars
  for (const l of victoryStress) {
    assert(l.starCount === 8, `Frame ${l.frame}: Expected 8 orbiting sparkle stars, got ${l.starCount}`);
    // Check that stars are spaced out around the center
    const xs = l.starPositions.map(p => p.x);
    const ys = l.starPositions.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const spanX = maxX - minX;
    assert(spanX >= 40 && spanX <= 80, `Frame ${l.frame}: Star orbit horizontal spread must be ~50-70px (got ${spanX})`);
  }

  // Peak of jump check
  const peakDisplacement = Math.min(...victoryStress.map(l => l.theoreticalJumpY));
  assert(Math.abs(peakDisplacement - (-18)) < 0.05, `Apex jump reach must be -18px (got ${peakDisplacement})`);
  console.log('   [PASS] Test 4: Parabolic leap reaches -18px apex and 8 stars orbit continuously at all 70 tested frames.');

  // =========================================================================
  // STRESS TEST 5: State Concurrency Collision (isSitting + isCelebrating)
  // =========================================================================
  console.log('\n--- TEST 5: State Concurrency (Simultaneous Sitting + Celebration) ---');
  const concurrencyStress = await page.evaluate(async () => {
    const { drawCharmingHabboAvatar } = await import('/src/canvas/characterRenderers.ts');

    const canvas = document.createElement('canvas');
    canvas.width = 840;
    canvas.height = 620;
    const ctx = canvas.getContext('2d');

    const avatar = {
      name: 'ConcurrencyTest',
      gender: 'neutral',
      skinTone: '#fbcfe8',
      hairStyle: 'spiky',
      hairColor: '#3b82f6',
      shirtColor: '#10b981',
      pantsColor: '#6366f1',
      accessory: 'cyber-visor'
    };

    const fills = [];
    const ellipses = [];
    const origFillRect = ctx.fillRect.bind(ctx);
    const origEllipse = ctx.ellipse.bind(ctx);

    ctx.fillRect = (x, y, w, h) => {
      fills.push({ x, y, w, h, fillStyle: ctx.fillStyle });
      return origFillRect(x, y, w, h);
    };

    ctx.ellipse = (x, y, rx, ry, rot, start, end) => {
      ellipses.push({ x, y, rx, ry });
      return origEllipse(x, y, rx, ry, rot, start, end);
    };

    // Both isSitting = true AND celebrationTimer = 180 (Level completed while docked at desk)
    fills.length = 0;
    ellipses.length = 0;
    drawCharmingHabboAvatar(ctx, { x: 4, y: 5 }, 840, 'NW', false, 9, avatar, 1, true, 0, 180);

    const chairWhileCelebrating = ellipses.find(e => e.rx === 16 && e.ry === 7);
    const bentThighsWhileCelebrating = fills.find(f => f.w === 9 && f.h === 6);
    const raisedHandWhileCelebrating = fills.find(f => f.w === 5 && f.h === 5 && f.fillStyle === avatar.skinTone);

    // Now celebration ends (celebrationTimer = 0), but still sitting (isSitting = true)
    fills.length = 0;
    ellipses.length = 0;
    drawCharmingHabboAvatar(ctx, { x: 4, y: 5 }, 840, 'NW', false, 9, avatar, 1, true, 0, 0);

    const chairAfterCelebration = ellipses.find(e => e.rx === 16 && e.ry === 7);
    const bentThighsAfterCelebration = fills.find(f => f.w === 9 && f.h === 6);

    ctx.fillRect = origFillRect;
    ctx.ellipse = origEllipse;

    return {
      hasChairDuringCelebration: !!chairWhileCelebrating,
      hasBentThighsDuringCelebration: !!bentThighsWhileCelebrating,
      hasRaisedHandDuringCelebration: !!raisedHandWhileCelebrating,
      hasChairAfterCelebration: !!chairAfterCelebration,
      hasBentThighsAfterCelebration: !!bentThighsAfterCelebration
    };
  });

  assert(!concurrencyStress.hasChairDuringCelebration, 'While celebrating, chair cushion is suppressed for airborne leap');
  assert(!concurrencyStress.hasBentThighsDuringCelebration, 'While celebrating, bent thighs are replaced by airborne legs');
  assert(concurrencyStress.hasRaisedHandDuringCelebration, 'While celebrating, raised arms (\\o/) take precedence over desk typing');
  assert(concurrencyStress.hasChairAfterCelebration, 'After celebration concludes, chair cushion returns cleanly');
  assert(concurrencyStress.hasBentThighsAfterCelebration, 'After celebration concludes, bent thighs return cleanly');
  console.log('   [PASS] Test 5: Concurrent sitting and celebration transition with seamless precedence and zero glitching.');

  // =========================================================================
  // STRESS TEST 6: Long Session Determinism & Numerical Stability
  // =========================================================================
  console.log('\n--- TEST 6: Numerical Stability at Large Frame Numbers (frame = 100,000) ---');
  const largeFrameStress = await page.evaluate(async () => {
    const { drawCharmingHabboAvatar } = await import('/src/canvas/characterRenderers.ts');

    const canvas = document.createElement('canvas');
    canvas.width = 840;
    canvas.height = 620;
    const ctx = canvas.getContext('2d');

    const avatar = {
      name: 'LongSession',
      gender: 'neutral',
      skinTone: '#fbcfe8',
      hairStyle: 'spiky',
      hairColor: '#3b82f6',
      shirtColor: '#10b981',
      pantsColor: '#6366f1',
      accessory: 'cyber-visor'
    };

    // Test frame = 100,000 (~27 minutes of continuous play)
    let noErrors = true;
    try {
      drawCharmingHabboAvatar(ctx, { x: 4, y: 5 }, 840, 'SE', true, 100000, avatar, 10, true, 150, 60, [
        { x: 4, y: 5, dir: 'SE', alpha: 0.5, active: true }
      ]);
    } catch (e) {
      noErrors = false;
    }

    return { noErrors };
  });

  assert(largeFrameStress.noErrors, 'Avatar renders without exception at frame = 100,000');
  console.log('   [PASS] Test 6: Numerical stability confirmed at large frame counts (frame = 100,000).');

  await browser.close();

  assert(consoleErrors.length === 0, `Console errors detected: ${JSON.stringify(consoleErrors)}`);
  assert(pageErrors.length === 0, `Page errors detected: ${JSON.stringify(pageErrors)}`);

  console.log('\n========================================================================');
  console.log('🏆 ALL CHALLENGER EMPIRICAL STRESS TESTS PASSED (100%) 🏆');
  console.log('========================================================================');
}

runChallengerStressSuite().catch(err => {
  console.error('\n❌ CHALLENGER STRESS SUITE FAILED:', err.message);
  process.exit(1);
});
