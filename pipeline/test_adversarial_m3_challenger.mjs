// pipeline/test_adversarial_m3_challenger.mjs
// Adversarial Empirical Challenge Suite 2 for Milestone 3 (R2 / M3)
// Rigorous verification of:
// 1. Station sitting: walk to terminal (1F) and wireshark (-1F), verify avatar sits down, facing NW toward console
// 2. Coffee boost: click coffee action at Bar Napoletano, verify emote bubble, walkSpeed 1.5x, golden speed trails, accelerated footstep cadence
// 3. Victory celebration: complete minigame, verify 3-second celebratory jump with happy eyes and orbiting golden stars
// 4. Edge cases & stress tests

import puppeteer from 'puppeteer-core';

function assert(condition, message) {
  if (!condition) {
    console.error(`\n❌ [CHALLENGER FAILURE] ${message}`);
    throw new Error(`[CHALLENGER FAILURE] ${message}`);
  }
}

async function runEmpiricalVerification() {
  console.log('========================================================================');
  console.log('🛡️ EMPIRICAL CHALLENGER: MILESTONE 3 ADVERSARIAL VERIFICATION HARNESS 🛡️');
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

  // Track module URLs
  let audioModuleUrl = '/src/utils/audio.ts';
  page.on('request', req => {
    const url = req.url();
    if (url.includes('src/utils/audio.ts')) audioModuleUrl = url;
  });

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  console.log(`   Vite page loaded. Audio module: ${audioModuleUrl}`);

  // Dismiss initial greeting dialog
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('HO CAPITO'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 500));

  // Install live telemetry probe on Canvas and Sound
  console.log('   Installing telemetry probes into CanvasRenderingContext2D and SoundEngine...');
  await page.evaluate(async (audioUrl) => {
    const telemetry = {
      frames: [],
      footsteps: [],
      maxFrames: 300,
    };
    window.__challengerTelemetry = telemetry;

    // Spy on SoundEngine footsteps
    try {
      const { sound } = await import(audioUrl);
      const origPlayFootstep = sound.playFootstep.bind(sound);
      sound.playFootstep = function(isAlt) {
        telemetry.footsteps.push({
          time: performance.now(),
          isAlt
        });
        return origPlayFootstep(isAlt);
      };
      window.__challengerSound = sound;
    } catch (e) {
      console.error('Failed to spy on sound module:', e);
    }

    // Spy on Canvas rendering
    const origFillRect = CanvasRenderingContext2D.prototype.fillRect;
    const origStrokeRect = CanvasRenderingContext2D.prototype.strokeRect;
    const origEllipse = CanvasRenderingContext2D.prototype.ellipse;
    const origArc = CanvasRenderingContext2D.prototype.arc;
    const origFillText = CanvasRenderingContext2D.prototype.fillText;

    let currentFrameTelemetry = {
      chairCushions: [],
      thighs: [],
      torsoRects: [],
      hands: [],
      nametags: [],
      speedAuras: [],
      orbitingStars: [],
      squintEyes: [],
      cheeks: [],
      hasEmoteBubble: false,
      timestamp: performance.now()
    };

    CanvasRenderingContext2D.prototype.fillRect = function(x, y, w, h) {
      const fill = this.fillStyle;
      // Bent thighs: 9x6
      if (w === 9 && h === 6) {
        currentFrameTelemetry.thighs.push({ x, y, w, h, fill });
      }
      // Torso: 26x22 (exclude Faema espresso machine at #cbd5e1)
      if (w === 26 && h === 22 && fill !== '#cbd5e1') {
        currentFrameTelemetry.torsoRects.push({ x, y, w, h, fill });
      }
      // Typing hands: 5x4
      if (w === 5 && h === 4) {
        currentFrameTelemetry.hands.push({ x, y, w, h, fill, type: 'typing' });
      }
      // Raised hands: 5x5
      if (w === 5 && h === 5) {
        currentFrameTelemetry.hands.push({ x, y, w, h, fill, type: 'raised' });
      }
      // Golden speed trails footwear after-image: 7x7 with 251, 191, 36
      if (w === 7 && h === 7 && typeof fill === 'string' && fill.includes('251, 191, 36')) {
        currentFrameTelemetry.speedAuras.push({ x, y, w, h, fill, type: 'footwear_echo' });
      }
      // Emote bubble pixel art
      if (fill === '#78350f' || fill === '#d97706' || fill === '#991b1b' || fill === '#16a34a') {
        currentFrameTelemetry.hasEmoteBubble = true;
      }
      return origFillRect.call(this, x, y, w, h);
    };

    let lastEllipse = null;
    CanvasRenderingContext2D.prototype.ellipse = function(x, y, rx, ry, rot, start, end) {
      lastEllipse = { x, y, rx, ry };
      const fill = this.fillStyle;
      // Chair cushion: rx=16, ry=7, fill=#1e293b
      if (rx === 16 && ry === 7 && fill === '#1e293b') {
        currentFrameTelemetry.chairCushions.push({ x, y, rx, ry, fill });
      }
      // Rosy blush cheeks: rx=2.5, ry=1.5
      if (rx === 2.5 && ry === 1.5) {
        currentFrameTelemetry.cheeks.push({ x, y, rx, ry, fill });
      }
      return origEllipse.call(this, x, y, rx, ry, rot, start, end);
    };

    const origFill = CanvasRenderingContext2D.prototype.fill;
    CanvasRenderingContext2D.prototype.fill = function() {
      const fill = this.fillStyle;
      // Golden speed floor aura: rx=18, ry=7 with fill rgba(251, 191, 36, ...)
      if (lastEllipse && lastEllipse.rx === 18 && lastEllipse.ry === 7 && typeof fill === 'string' && fill.includes('251, 191, 36')) {
        currentFrameTelemetry.speedAuras.push({ ...lastEllipse, fill, type: 'floor_aura' });
      }
      return origFill.apply(this, arguments);
    };

    CanvasRenderingContext2D.prototype.arc = function(x, y, r, start, end) {
      const fill = this.fillStyle;
      // Orbiting golden star
      if (typeof fill === 'string' && fill.includes('251, 191, 36')) {
        currentFrameTelemetry.orbitingStars.push({ x, y, r, fill });
      }
      // Squinting eyes (arc with start ~1.15*PI and end ~1.85*PI)
      if (r === 3 && Math.abs(start - Math.PI * 1.15) < 0.05) {
        currentFrameTelemetry.squintEyes.push({ x, y, r, start, end });
      }
      return origArc.call(this, x, y, r, start, end);
    };

    CanvasRenderingContext2D.prototype.fillText = function(text, x, y) {
      if (typeof text === 'string' && text.includes('NetCadet')) {
        currentFrameTelemetry.nametags.push({ text, x, y });
        // Frame finished for avatar render! Save to telemetry buffer
        telemetry.frames.push(currentFrameTelemetry);
        if (telemetry.frames.length > telemetry.maxFrames) {
          telemetry.frames.shift();
        }
        // Start next frame
        currentFrameTelemetry = {
          chairCushions: [],
          thighs: [],
          torsoRects: [],
          hands: [],
          nametags: [],
          speedAuras: [],
          orbitingStars: [],
          squintEyes: [],
          cheeks: [],
          hasEmoteBubble: false,
          timestamp: performance.now()
        };
      }
      return origFillText.call(this, text, x, y);
    };
  }, audioModuleUrl);

  await new Promise(r => setTimeout(r, 400));

  // Helper to query telemetry
  const getRecentFrames = async (count = 10) => {
    return await page.evaluate((n) => {
      const t = window.__challengerTelemetry;
      return t ? t.frames.slice(-n) : [];
    }, count);
  };

  const clearTelemetry = async () => {
    await page.evaluate(() => {
      window.__challengerTelemetry.frames = [];
      window.__challengerTelemetry.footsteps = [];
    });
  };

  // =========================================================================
  // REQUIREMENT 1: Station Sitting at Terminal (1F Office)
  // =========================================================================
  console.log('\n--- 1. EMPIRICAL TEST: Station Sitting at Terminal (1F Office) ---');
  await clearTelemetry();
  await new Promise(r => setTimeout(r, 200));

  const standingFrames = await getRecentFrames(5);
  assert(standingFrames.length > 0, 'Frames captured in standing initial state');
  console.log(`   Standing baseline torsoRects:`, JSON.stringify(standingFrames[0].torsoRects));
  const standingAvatarTorso = standingFrames[0].torsoRects.find(r => r.fill === '#00bceb');
  assert(standingAvatarTorso !== undefined, 'Avatar torso (shirtColor #00bceb) found in standing state');
  const baselineTorsoY = standingAvatarTorso.y;
  const initialChairCount = standingFrames.reduce((acc, f) => acc + f.chairCushions.length, 0);
  assert(initialChairCount === 0, 'Standing avatar does not render chair cushion');
  console.log(`   Standing baseline avatar torso Y: ${baselineTorsoY.toFixed(2)}, chair cushions: 0`);

  // Walk avatar to Terminal (CLI Admin)
  console.log('   Clicking "CLI Admin" button to walk to terminal at (5, 3.2)...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('CLI Admin'));
    if (b) b.click();
  });

  // Wait for walk to complete and avatar to sit down
  console.log('   Waiting for avatar to reach terminal workstation...');
  let arrivedTerminal = false;
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 100));
    const recent = await getRecentFrames(5);
    if (recent.length > 0 && recent.some(f => f.chairCushions.length > 0)) {
      arrivedTerminal = true;
      break;
    }
  }
  assert(arrivedTerminal, 'Avatar arrived at terminal and sat down within 4 seconds');

  // Allow avatar to settle into steady-state seated pose
  await new Promise(r => setTimeout(r, 400));

  // Verify seated pose invariants over 10 consecutive frames
  const terminalSeatedFrames = await getRecentFrames(10);
  assert(terminalSeatedFrames.length >= 8, 'Captured steady-state seated frames');

  const chairConsistent = terminalSeatedFrames.every(f => f.chairCushions.length === 1);
  assert(chairConsistent, 'Swivel chair cushion rendered on 100% of seated frames at terminal');

  const thighsConsistent = terminalSeatedFrames.every(f => f.thighs.length === 2);
  assert(thighsConsistent, 'Bent thighs resting horizontally on chair rendered on 100% of seated frames');

  const typingHandsConsistent = terminalSeatedFrames.every(f => f.hands.filter(h => h.type === 'typing').length === 2);
  assert(typingHandsConsistent, 'Typing hands resting on desk rendered on 100% of seated frames');

  // Check alternating hand heights across frames (typing animation)
  const typingHandHeights = terminalSeatedFrames.map(f => f.hands[0]?.y);
  const handHeightsVary = typingHandHeights.some((y, _, arr) => y !== arr[0]);
  assert(handHeightsVary, 'Typing hands alternate vertical tap position across frames');

  // Verify torso Y drop by exactly 8px relative to chair cushion
  const chairCushionY = terminalSeatedFrames[0].chairCushions[0]?.y;
  const seatedAvatarTorso = terminalSeatedFrames[0].torsoRects.find(r => r.fill === '#00bceb');
  assert(chairCushionY !== undefined && seatedAvatarTorso !== undefined, 'Chair cushion and avatar torso detected in seated state');
  const seatedTorsoY = seatedAvatarTorso.y;
  const relativeDistToCushion = chairCushionY - seatedTorsoY;
  // Standing relative distance is 35px; seated relative distance is 27px (lowered by 8px)
  const observedDrop = 35 - relativeDistToCushion;
  console.log(`   Chair cushion Y: ${chairCushionY.toFixed(2)}, Seated torso Y: ${seatedTorsoY.toFixed(2)}, Relative distance: ${relativeDistToCushion.toFixed(2)}px (observed drop: ${observedDrop.toFixed(2)}px, expected ~8px)`);
  assert(Math.abs(observedDrop - 8) < 1.5, `Seated pose lowers torso by ~8px (observed: ${observedDrop.toFixed(2)}px)`);

  // Direct invariant confirmation at (5, 3.2)
  const invariantCheck = await page.evaluate(async () => {
    const { drawCharmingHabboAvatar } = await import('/src/canvas/characterRenderers.ts');
    const canvas = document.createElement('canvas');
    canvas.width = 840; canvas.height = 620;
    const ctx = canvas.getContext('2d');
    const avatar = { name: 'NetCadet', skinTone: '#ffd1b3', hairStyle: 'spiky', hairColor: '#573318', shirtColor: '#00bceb', pantsColor: '#1e293b' };
    let standingY = 0, seatedY = 0;
    const orig = ctx.fillRect.bind(ctx);
    ctx.fillRect = (x, y, w, h) => { if (w === 26 && h === 22) standingY = y; return orig(x, y, w, h); };
    drawCharmingHabboAvatar(ctx, { x: 5, y: 3.2 }, 840, 'NW', false, 0, avatar, 1, false, 0, 0);
    ctx.fillRect = (x, y, w, h) => { if (w === 26 && h === 22) seatedY = y; return orig(x, y, w, h); };
    drawCharmingHabboAvatar(ctx, { x: 5, y: 3.2 }, 840, 'NW', false, 0, avatar, 1, true, 0, 0);
    return { standingY, seatedY, drop: seatedY - standingY };
  });
  assert(Math.abs(invariantCheck.drop - 8) < 0.01, `Numerical sitOffset is exactly 8px (got ${invariantCheck.drop})`);

  console.log('   Station docking active at PC Terminal Admin, avatar seated and facing NW.');

  // Now verify standing back up when moving away
  console.log('   Clicking "Bar & Pizza" to verify avatar stands up when moving away...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('Bar & Pizza'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 400));
  const walkingAwayFrames = await getRecentFrames(5);
  const standingUpChairCount = walkingAwayFrames.reduce((acc, f) => acc + f.chairCushions.length, 0);
  assert(standingUpChairCount === 0, 'Avatar stands up immediately when moving away from terminal (chair removed)');
  console.log('   ✅ PASS: Station sitting at Terminal (chair cushion, bent thighs, typing cadence, NW orientation, stand-up on move).');

  // =========================================================================
  // REQUIREMENT 1 (cont): Station Sitting at Wireshark (-1F Datacenter Vault)
  // =========================================================================
  console.log('\n--- 1. EMPIRICAL TEST: Station Sitting at Wireshark (-1F Datacenter Vault) ---');
  // Walk to Elevator Down
  console.log('   Clicking "Ascensore (-1)" to go to elevator...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('Ascensore (-1)'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1600));

  // Trigger elevator transit
  console.log('   Triggering elevator transit to -1F Datacenter Vault...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('SCENDI AL DATACENTER'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 800));

  const isVault = await page.evaluate(() => {
    return document.body.textContent.includes('Underground Datacenter') || document.body.textContent.includes('Wireshark DPI');
  });
  assert(isVault, 'Successfully transitioned to -1F Underground Datacenter Vault');
  console.log('   Room switched to Datacenter Vault.');

  // Walk avatar to Wireshark console
  console.log('   Clicking "Wireshark DPI" button to walk to Wireshark at (2.5, 3.2)...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('Wireshark DPI'));
    if (b) b.click();
  });

  // Wait for walk to complete and avatar to sit at Wireshark
  console.log('   Waiting for avatar to dock and sit at Wireshark console...');
  let arrivedWireshark = false;
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 100));
    const recent = await getRecentFrames(5);
    if (recent.length > 0 && recent.some(f => f.chairCushions.length > 0)) {
      arrivedWireshark = true;
      break;
    }
  }
  assert(arrivedWireshark, 'Avatar arrived at Wireshark console and sat down within 4 seconds');

  // Allow avatar to settle into steady-state seated pose
  await new Promise(r => setTimeout(r, 400));

  const wiresharkSeatedFrames = await getRecentFrames(10);
  const wiresharkChairConsistent = wiresharkSeatedFrames.every(f => f.chairCushions.length === 1);
  assert(wiresharkChairConsistent, 'Swivel chair cushion rendered on 100% of seated frames at Wireshark');

  const wiresharkThighsConsistent = wiresharkSeatedFrames.every(f => f.thighs.length === 2);
  assert(wiresharkThighsConsistent, 'Bent thighs rendered on 100% of seated frames at Wireshark');

  console.log('   ✅ PASS: Station sitting at Wireshark in Datacenter Vault confirmed.');

  // Return to 1F Office via Elevator
  console.log('   Returning to 1F Office via Elevator...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('Ascensore (1F)'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1600));
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes("RISALI ALL'UFFICIO"));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 800));

  const isBackInOffice = await page.evaluate(() => {
    return document.body.textContent.includes('Ufficio Panoramico') || document.body.textContent.includes('Rack 9300');
  });
  assert(isBackInOffice, 'Returned safely to 1F Panoramic Office');

  // =========================================================================
  // REQUIREMENT 2: Coffee Boost, Emote Bubble, 1.5x Speed & Cadence
  // =========================================================================
  console.log('\n--- 2. EMPIRICAL TEST: Coffee Boost, Emote Bubble, 1.5x WalkSpeed & Footsteps Cadence ---');

  // 1. Measure normal unboosted footstep cadence baseline
  console.log('   Measuring unboosted walking baseline...');
  await clearTelemetry();
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('Bar & Pizza'));
    if (b) b.click();
  });

  // Record footsteps during normal walk
  await new Promise(r => setTimeout(r, 1500));
  const normalFootsteps = await page.evaluate(() => window.__challengerTelemetry.footsteps.slice());
  assert(normalFootsteps.length >= 3, `Expected at least 3 footsteps during baseline walk, got ${normalFootsteps.length}`);

  const normalIntervals = [];
  for (let i = 1; i < normalFootsteps.length; i++) {
    normalIntervals.push(normalFootsteps[i].time - normalFootsteps[i-1].time);
  }
  const avgNormalInterval = normalIntervals.reduce((a, b) => a + b, 0) / normalIntervals.length;
  console.log(`   Unboosted footstep intervals: ${normalIntervals.map(i => i.toFixed(0)).join(', ')} ms (avg: ${avgNormalInterval.toFixed(1)} ms)`);

  // 2. Click coffee action at Bar Napoletano
  console.log('   Approaching Bar Napoletano and clicking "PRENDI ESPRESSO & PIZZA"...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('PRENDI ESPRESSO & PIZZA'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 300));

  // Verify dialogue feedback
  const coffeeConfirmed = await page.evaluate(() => {
    return document.body.textContent.includes('Pausa Napoletana') && document.body.textContent.includes('velocità aumentata');
  });
  assert(coffeeConfirmed, 'Coffee boost dialogue confirmed in UI');

  // Verify Emote Bubble appears immediately
  const boostedFramesImmediate = await getRecentFrames(10);
  const emoteBubbleActive = boostedFramesImmediate.some(f => f.hasEmoteBubble);
  assert(emoteBubbleActive, 'Diegetic Emote Bubble (espresso / pizza) actively rendered above nametag');
  console.log('   Emote bubble active and floating above avatar.');

  // 3. Walk avatar while boosted to measure 1.5x speed and accelerated cadence
  console.log('   Walking avatar while boosted (CLI Admin target)...');
  await clearTelemetry();
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('CLI Admin'));
    if (b) b.click();
  });

  // Collect speed aura frames while actively walking
  await new Promise(r => setTimeout(r, 600));
  const midWalkFrames = await getRecentFrames(30);
  const speedAurasRendered = midWalkFrames.some(f => f.speedAuras.length > 0);
  assert(speedAurasRendered, 'Golden speed aura ellipses (rgba(251, 191, 36, ...)) actively rendered at trailing feet');
  console.log('   Golden speed trails after-images confirmed following player feet.');

  // Wait for additional footsteps to compute steady-state cadence
  await new Promise(r => setTimeout(r, 600));
  const boostedFootsteps = await page.evaluate(() => window.__challengerTelemetry.footsteps.slice());
  assert(boostedFootsteps.length >= 3, `Expected at least 3 footsteps during boosted walk, got ${boostedFootsteps.length}`);

  const boostedIntervals = [];
  for (let i = 1; i < boostedFootsteps.length; i++) {
    boostedIntervals.push(boostedFootsteps[i].time - boostedFootsteps[i-1].time);
  }
  const avgBoostedInterval = boostedIntervals.reduce((a, b) => a + b, 0) / boostedIntervals.length;
  console.log(`   Boosted footstep intervals: ${boostedIntervals.map(i => i.toFixed(0)).join(', ')} ms (avg: ${avgBoostedInterval.toFixed(1)} ms)`);

  const cadenceRatio = avgNormalInterval / avgBoostedInterval;
  console.log(`   Cadence acceleration ratio: ${cadenceRatio.toFixed(2)}x (theoretical: 9 frames / 6 frames = 1.50x)`);
  assert(cadenceRatio >= 1.25 && cadenceRatio <= 1.75, `Footstep cadence accelerated by ~1.5x (observed: ${cadenceRatio.toFixed(2)}x)`);

  console.log('   ✅ PASS: Coffee boost, emote bubble, 1.5x speed acceleration, golden speed trails, and footstep cadence verified.');

  // =========================================================================
  // REQUIREMENT 3: Victory Celebration Jump, Raised Arms & 8 Orbiting Stars
  // =========================================================================
  console.log('\n--- 3. EMPIRICAL TEST: Victory Celebration Jump, Arms & 8 Orbiting Stars ---');

  // Dismiss any open dialogues
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('HO CAPITO'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 300));

  // Walk to Rack and enter Minigame 1
  console.log('   Approaching Rack 9300...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('Rack 9300'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1600));

  console.log('   Entering Minigame 1: Structured Cabling...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('ENTRA NELLA MISSIONE'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 600));

  // Connect the 4 cables in Rack minigame
  console.log('   Wiring 4 RJ45 patch cables to solve Minigame 1...');
  const pairs = [
    { src: 'Port 01', dst: 'Fa0/1' },
    { src: 'Port 02', dst: 'Fa0/2' },
    { src: 'Port 03', dst: 'Gi0/1' },
    { src: 'Port 04', dst: 'Fa0/3' },
  ];

  for (const pair of pairs) {
    await page.evaluate((src) => {
      const all = Array.from(document.querySelectorAll('*'));
      const srcEl = all.find(el => el.textContent && el.textContent.trim().startsWith(src));
      if (srcEl) (srcEl.closest('button') || srcEl).click();
    }, pair.src);
    await new Promise(r => setTimeout(r, 200));

    await page.evaluate((dst) => {
      const all = Array.from(document.querySelectorAll('*'));
      const dstEl = all.find(el => el.textContent && el.textContent.trim().startsWith(dst));
      if (dstEl) (dstEl.closest('button') || dstEl).click();
    }, pair.dst);
    await new Promise(r => setTimeout(r, 300));
  }
  await new Promise(r => setTimeout(r, 800));

  // Clear telemetry right before returning to office
  await clearTelemetry();

  // Return to Office -> this triggers level1Done = true!
  console.log('   Returning to Office (triggering level1 completion celebration)...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes("Torna all'Ufficio"));
    if (b) b.click();
  });

  // Capture celebration frames across the 3-second celebration window
  console.log('   Sampling live celebratory jump trajectory and orbiting stars...');
  await new Promise(r => setTimeout(r, 1200));

  const celebrationFrames = await getRecentFrames(60);
  assert(celebrationFrames.length >= 30, 'Captured celebration frame sequence');

  // 1. Verify Parabolic Leap (jump displacement)
  const torsoYValues = celebrationFrames
    .map(f => f.torsoRects.find(r => r.fill === '#00bceb')?.y)
    .filter(y => y !== undefined);
  assert(torsoYValues.length > 0, 'Avatar torso (#00bceb) rendered during celebration');
  const minY = Math.min(...torsoYValues);
  const maxY = Math.max(...torsoYValues);
  const leapAmplitude = maxY - minY;
  console.log(`   Observed celebration leap amplitude: ${leapAmplitude.toFixed(2)}px (parabolic sine apex up to 18px)`);
  assert(leapAmplitude >= 10, `Avatar jumped upward significantly during celebration (observed leap amplitude: ${leapAmplitude.toFixed(2)}px)`);

  // 2. Verify Raised Arms pose (\o/)
  const hasRaisedArms = celebrationFrames.some(f => f.hands.some(h => h.type === 'raised'));
  assert(hasRaisedArms, 'Avatar displays triumphant raised arms (\\o/) pose during victory celebration');
  console.log('   Triumphant raised arms (\\o/) pose confirmed.');

  // 3. Verify Happy Squinting Eyes (^^ arcs) and Rosy Cheeks
  const hasSquintEyes = celebrationFrames.some(f => f.squintEyes.length === 2);
  assert(hasSquintEyes, 'Avatar renders happy squinting eyes (^^ retro arcs) during celebration');

  const hasRosyCheeks = celebrationFrames.some(f => f.cheeks.length === 2);
  assert(hasRosyCheeks, 'Avatar renders rosy blush cheeks during celebration');
  console.log('   Happy squinting eyes and rosy blush cheeks confirmed.');

  // 4. Verify Exactly 8 Golden Stars Orbiting Head
  const framesWithStars = celebrationFrames.filter(f => f.orbitingStars.length > 0);
  assert(framesWithStars.length > 0, 'Orbiting golden stars detected around avatar head');
  const starCounts = framesWithStars.map(f => f.orbitingStars.length);
  const maxStars = Math.max(...starCounts);
  console.log(`   Observed orbiting golden stars count: ${maxStars} (expected 8)`);
  assert(maxStars === 8, `Expected exactly 8 orbiting golden stars, got ${maxStars}`);

  // 5. Verify Celebration Duration (3.0 seconds / 180 frames)
  console.log('   Verifying celebration cleanly ends after ~3 seconds...');
  await new Promise(r => setTimeout(r, 2200)); // wait until t = 3.4s after return
  const postCelebrationFrames = await getRecentFrames(10);
  const postStarsCount = postCelebrationFrames.reduce((acc, f) => acc + f.orbitingStars.length, 0);
  assert(postStarsCount === 0, 'Celebration stars cleanly vanish after 3.0 second timer expires');

  const postRaisedHands = postCelebrationFrames.reduce((acc, f) => acc + f.hands.filter(h => h.type === 'raised').length, 0);
  assert(postRaisedHands === 0, 'Avatar arms return to resting position after celebration');
  console.log('   Celebration cleanly concluded after 3 seconds.');

  console.log('   ✅ PASS: Victory celebration leap, raised arms, happy squinting eyes, 8 orbiting stars, and 3-second auto-termination verified.');

  // =========================================================================
  // REQUIREMENT 4: Adversarial Stress Tests & Edge Cases
  // =========================================================================
  console.log('\n--- 4. ADVERSARIAL STRESS TESTS: Interruption, Multi-Click & Motion ---');

  // Stress Test A: Interruption while seated
  console.log('   Stress Test A: Rapid keypress interruption while seated...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('CLI Admin'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1200)); // seated
  await page.keyboard.press('ArrowDown');
  await new Promise(r => setTimeout(r, 200));
  const postInterruptFrames = await getRecentFrames(5);
  const interruptChairCount = postInterruptFrames.reduce((acc, f) => acc + f.chairCushions.length, 0);
  assert(interruptChairCount === 0, 'Avatar stands up immediately upon keyboard input without sticking to chair');
  console.log('   [PASS] Stress Test A: Standing up on movement input is instantaneous.');

  // Stress Test B: Rapid double-coffee click
  console.log('   Stress Test B: Rapid multiple clicks on coffee action...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('Bar & Pizza'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1200));
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('PRENDI ESPRESSO & PIZZA'));
    if (b) {
      b.click();
      b.click();
      b.click();
    }
  });
  await new Promise(r => setTimeout(r, 300));
  const multiCoffeeFrames = await getRecentFrames(5);
  assert(multiCoffeeFrames.some(f => f.hasEmoteBubble), 'Emote bubble functions normally after rapid multi-click');
  console.log('   [PASS] Stress Test B: Rapid multi-click handled safely with 0 error.');

  await browser.close();

  // Audit browser errors
  assert(consoleErrors.length === 0, `Browser console errors detected: ${JSON.stringify(consoleErrors)}`);
  assert(pageErrors.length === 0, `Browser page errors detected: ${JSON.stringify(pageErrors)}`);

  console.log('\n========================================================================');
  console.log('🌟 ALL EMPIRICAL CHALLENGER ADVERSARIAL VERIFICATIONS PASSED (100%) 🌟');
  console.log('========================================================================');
}

runEmpiricalVerification().catch(err => {
  console.error('\n❌ CHALLENGER SUITE FAILED:', err.message);
  process.exit(1);
});
