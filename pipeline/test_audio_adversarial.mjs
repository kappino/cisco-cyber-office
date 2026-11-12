// pipeline/test_audio_adversarial.mjs
// Adversarial Empirical Challenge Suite for Milestone 1: Audio Engine & Component Integrations
import puppeteer from 'puppeteer-core';

function assert(condition, message) {
  if (!condition) {
    console.error(`\n❌ [ADVERSARIAL FAIL] ${message}`);
    throw new Error(`[ADVERSARIAL FAIL] ${message}`);
  }
}

async function runAdversarialSuite() {
  console.log('================================================================');
  console.log('🔥 STARTING ADVERSARIAL EMPIRICAL VERIFICATION HARNESS (M1) 🔥');
  console.log('================================================================');

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
    defaultViewport: { width: 1280, height: 900 }
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.error('   [BROWSER CONSOLE ERROR]:', msg.text());
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push(err.toString());
    console.error('   [BROWSER PAGE ERROR]:', err.toString());
  });

  // Track the exact resolved module URLs from Vite (handles ?t= query params in dev server)
  let audioModuleUrl = '/src/utils/audio.ts';
  let bgmModuleUrl = '/src/utils/synthwaveBgm.ts';
  page.on('request', req => {
    const url = req.url();
    if (url.includes('src/utils/audio.ts')) audioModuleUrl = url;
    if (url.includes('src/utils/synthwaveBgm.ts')) bgmModuleUrl = url;
  });

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  console.log(`   Captured audio module URL: ${audioModuleUrl}`);
  console.log(`   Captured BGM module URL: ${bgmModuleUrl}`);

  // Dismiss initial greeting dialog & unlock Web Audio
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('HO CAPITO'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 500));

  // =================================================================
  // CHALLENGE 1: HUD Audio Button Synchronous Mute/Unmute
  // =================================================================
  console.log('\n--- CHALLENGE 1: HUD Audio Button Synchronous Mute/Unmute ---');
  const muteTestResults = await page.evaluate(async (audioUrl, bgmUrl) => {
    const { sound } = await import(audioUrl);
    const { synthwaveBgm } = await import(bgmUrl);

    const results = {};

    results.initialIsMuted = sound.isMuted;
    results.bgmActiveInitially = synthwaveBgm.active;

    // 1. Locate and click HUD mute button
    const buttons = Array.from(document.querySelectorAll('header button'));
    const volBtn = buttons.find(b => b.title && b.title.toLowerCase().includes('audio'));
    if (!volBtn) {
      throw new Error('HUD volume button not found in header');
    }

    volBtn.click();
    await new Promise(r => setTimeout(r, 80)); // allow 40ms ramp + sync

    results.afterMuteClick_isMuted = sound.isMuted;
    results.afterMuteClick_localStorage = localStorage.getItem('cisco_sound_muted');
    results.afterMuteClick_bgmActive = synthwaveBgm.active;
    const masterNodeMuted = sound.getMasterNode();
    results.afterMuteClick_masterGain = masterNodeMuted ? masterNodeMuted.gain.value : null;

    // In muted state, call SFX methods - verify they return safely without throwing
    let sfxBlockedCleanly = true;
    try {
      sound.playMechanicalKey();
      sound.playCyberAlarm();
      sound.playFootstep(true);
      sound.playCoffee();
      sound.playClick();
    } catch {
      sfxBlockedCleanly = false;
    }
    results.sfxBlockedCleanly = sfxBlockedCleanly;

    // 2. Click HUD unmute button again
    volBtn.click();
    await new Promise(r => setTimeout(r, 100));

    results.afterUnmuteClick_isMuted = sound.isMuted;
    results.afterUnmuteClick_localStorage = localStorage.getItem('cisco_sound_muted');
    results.afterUnmuteClick_bgmActive = synthwaveBgm.active;

    // 3. Stress test: Rapid mute toggling (10 rapid clicks)
    for (let i = 0; i < 10; i++) {
      volBtn.click();
    }
    await new Promise(r => setTimeout(r, 100));
    results.rapidToggleFinalState = sound.isMuted;
    results.rapidToggleLocalStorage = localStorage.getItem('cisco_sound_muted');
    results.rapidToggleMatchesStorage = String(sound.isMuted) === localStorage.getItem('cisco_sound_muted');

    // Ensure left in unmuted state for subsequent tests
    if (sound.isMuted) {
      volBtn.click();
      await new Promise(r => setTimeout(r, 50));
    }

    return results;
  }, audioModuleUrl, bgmModuleUrl);

  console.log('   Mute test results:', muteTestResults);
  assert(muteTestResults.afterMuteClick_isMuted === true, 'HUD button click did not set isMuted to true');
  assert(muteTestResults.afterMuteClick_localStorage === 'true', 'localStorage cisco_sound_muted not set to "true"');
  assert(muteTestResults.afterMuteClick_bgmActive === false, 'BGM sequencer did not stop when muted');
  assert(muteTestResults.sfxBlockedCleanly === true, 'SFX methods failed or threw error while muted');
  assert(muteTestResults.afterUnmuteClick_isMuted === false, 'HUD button click did not set isMuted back to false');
  assert(muteTestResults.afterUnmuteClick_localStorage === 'false', 'localStorage cisco_sound_muted not set to "false"');
  assert(muteTestResults.afterUnmuteClick_bgmActive === true, 'BGM sequencer did not resume when unmuted');
  assert(muteTestResults.rapidToggleMatchesStorage === true, 'Rapid toggling corrupted state vs localStorage');
  console.log('   ✅ PASS: HUD Audio synchronous mute/unmute verified.');

  // =================================================================
  // CHALLENGE 2: Keystrokes in CrtTerminalGame.tsx -> playMechanicalKey()
  // =================================================================
  console.log('\n--- CHALLENGE 2: CrtTerminalGame keystrokes -> playMechanicalKey() ---');
  // Walk to CLI Admin terminal
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('CLI Admin'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1600));

  // Enter Minigame 2
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('ENTRA NELLA MISSIONE'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 600));

  // Install spy on playMechanicalKey on active singleton
  await page.evaluate(async (audioUrl) => {
    const { sound } = await import(audioUrl);
    window.__keyCount = 0;
    const orig = sound.playMechanicalKey.bind(sound);
    sound.playMechanicalKey = function () {
      window.__keyCount++;
      orig();
    };
  }, audioModuleUrl);

  const terminalInput = await page.$('input');
  assert(terminalInput !== null, 'Terminal input element not found');

  // Type standard Cisco command: "enable" (6 keystrokes)
  await terminalInput.type('enable');
  let keyCount = await page.evaluate(() => window.__keyCount);
  console.log(`   Typed "enable" -> playMechanicalKey count: ${keyCount} (expected 6)`);
  assert(keyCount === 6, `Expected exactly 6 playMechanicalKey calls, got ${keyCount}`);

  // Test special keys: Enter, Tab, ArrowUp, ArrowDown, Backspace
  await terminalInput.press('Enter');
  await new Promise(r => setTimeout(r, 100));
  await terminalInput.press('Tab');
  await new Promise(r => setTimeout(r, 100));
  await terminalInput.press('ArrowUp');
  await new Promise(r => setTimeout(r, 100));
  await terminalInput.press('ArrowDown');
  await new Promise(r => setTimeout(r, 100));
  await terminalInput.press('Backspace');
  await new Promise(r => setTimeout(r, 100));

  keyCount = await page.evaluate(() => window.__keyCount);
  console.log(`   After 5 special keys (Enter, Tab, Up, Down, Backspace) -> count: ${keyCount} (expected 11)`);
  assert(keyCount === 11, `Expected 11 playMechanicalKey calls, got ${keyCount}`);

  // Stress test: Burst typing 25 characters in rapid succession
  await terminalInput.type('show ip interface brief\n', { delay: 10 });
  keyCount = await page.evaluate(() => window.__keyCount);
  console.log(`   After rapid burst typing -> count: ${keyCount} (expected 35)`);
  assert(keyCount === 35, `Expected 35 playMechanicalKey calls, got ${keyCount}`);
  console.log('   ✅ PASS: CrtTerminalGame keystrokes trigger playMechanicalKey() on every key.');

  // Exit terminal back to office
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes("Torna all'Ufficio"));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 600));

  // =================================================================
  // CHALLENGE 3: Umbrella SOC Threat Alert -> playCyberAlarm()
  // =================================================================
  console.log('\n--- CHALLENGE 3: Umbrella SOC Threat Alert -> playCyberAlarm() ---');

  // Install spy on playCyberAlarm and playClick on active singleton
  await page.evaluate(async (audioUrl) => {
    const { sound } = await import(audioUrl);
    window.__alarmCount = 0;
    window.__clickCount = 0;
    const origAlarm = sound.playCyberAlarm.bind(sound);
    sound.playCyberAlarm = function () {
      window.__alarmCount++;
      origAlarm();
    };
    const origClick = sound.playClick.bind(sound);
    sound.playClick = function () {
      window.__clickCount++;
      origClick();
    };
  }, audioModuleUrl);

  // Walk to Umbrella SOC station
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('SOC Wall'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1600));

  // Enter Umbrella SOC
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('ENTRA NELLA MISSIONE'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 500));

  // Test 3A: verify playCyberAlarm triggered on mount when unmitigated
  let alarmCount = await page.evaluate(() => window.__alarmCount);
  console.log(`   Umbrella SOC mount -> playCyberAlarm count: ${alarmCount} (expected >= 1)`);
  assert(alarmCount >= 1, `Expected playCyberAlarm on unmitigated mount, got ${alarmCount}`);

  const alarmBeforeQueries = alarmCount;
  const clickBeforeQueries = await page.evaluate(() => window.__clickCount);

  // Test 3B: Click benign DNS queries (cisco.com, salesforce.cisco.com, etc.)
  await page.evaluate(() => {
    const queryRows = Array.from(document.querySelectorAll('.space-y-2 > div'));
    if (queryRows[0]) queryRows[0].click();
  });
  await new Promise(r => setTimeout(r, 150));

  const alarmAfterBenign = await page.evaluate(() => window.__alarmCount);
  const clickAfterBenign = await page.evaluate(() => window.__clickCount);
  console.log(`   After clicking benign DNS query -> alarmCount: ${alarmAfterBenign}, clickCount: ${clickAfterBenign}`);
  assert(alarmAfterBenign === alarmBeforeQueries, 'playCyberAlarm should NOT trigger on benign DNS click');
  assert(clickAfterBenign > clickBeforeQueries, 'playClick should trigger on benign DNS click');

  // Test 3C: Click malicious DNS query (trojan-c2.evil-crypto.net)
  await page.evaluate(() => {
    const queryRows = Array.from(document.querySelectorAll('.space-y-2 > div'));
    const mal = queryRows.find(r => r.textContent.includes('trojan-c2.evil-crypto.net'));
    if (mal) mal.click();
  });
  await new Promise(r => setTimeout(r, 200));

  const alarmAfterMalicious = await page.evaluate(() => window.__alarmCount);
  console.log(`   After clicking malicious C2 query -> alarmCount: ${alarmAfterMalicious} (expected +1)`);
  assert(alarmAfterMalicious === alarmBeforeQueries + 1, 'playCyberAlarm MUST trigger on malicious C2 threat click');

  // Test 3D: Stress test - Rapid multi-clicks on threat row
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => {
      const queryRows = Array.from(document.querySelectorAll('.space-y-2 > div'));
      const mal = queryRows.find(r => r.textContent.includes('trojan-c2.evil-crypto.net'));
      if (mal) mal.click();
    });
  }
  await new Promise(r => setTimeout(r, 300));
  const alarmAfterBurst = await page.evaluate(() => window.__alarmCount);
  console.log(`   After 5 rapid clicks on malicious query -> alarmCount: ${alarmAfterBurst}`);
  assert(alarmAfterBurst === alarmAfterMalicious + 5, 'Rapid clicks should trigger cleanly without errors');
  console.log('   ✅ PASS: Umbrella SOC threat alert properly triggers playCyberAlarm().');

  // Exit Umbrella SOC back to office
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes("Torna all'Ufficio"));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 600));

  // =================================================================
  // CHALLENGE 4: Isometric Walking Footsteps Cadence & Stop
  // =================================================================
  console.log('\n--- CHALLENGE 4: Isometric Walking Footsteps Cadence & Stop ---');

  // Install spy on playFootstep to track cadence, alternate foot, and timings
  await page.evaluate(async (audioUrl) => {
    const { sound } = await import(audioUrl);
    window.__footsteps = [];
    const orig = sound.playFootstep.bind(sound);
    sound.playFootstep = function (alt) {
      window.__footsteps.push({
        time: performance.now(),
        alternate: alt
      });
      orig(alt);
    };
  }, audioModuleUrl);

  // Test 4A: Standing still check
  console.log('   Verifying standing still (no movement for 600ms)...');
  await new Promise(r => setTimeout(r, 600));
  let footsteps = await page.evaluate(() => window.__footsteps);
  console.log(`   Footsteps while standing still: ${footsteps.length} (expected 0)`);
  assert(footsteps.length === 0, `Footsteps played while standing still! Count: ${footsteps.length}`);

  // Test 4B: Start walking towards a distant destination
  console.log('   Triggering walk to distant station (Bar & Pizza)...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('Bar & Pizza'));
    if (b) b.click();
  });

  // Sample footsteps during walking
  await new Promise(r => setTimeout(r, 800));
  footsteps = await page.evaluate(() => window.__footsteps);
  console.log(`   Footsteps during walking: ${footsteps.length} (expected >= 3)`);
  assert(footsteps.length >= 3, `Expected at least 3 footsteps during movement, got ${footsteps.length}`);

  // Verify footstep cadence alternation: alternate should alternate between true/false
  let alternationValid = true;
  for (let i = 1; i < footsteps.length; i++) {
    if (footsteps[i].alternate === footsteps[i - 1].alternate) {
      alternationValid = false;
      break;
    }
  }
  console.log(`   Footstep left/right alternation valid: ${alternationValid}`);
  assert(alternationValid, 'Footsteps did not alternate left/right foot cadence properly');

  // Verify rate-limiting: intervals between footsteps must be >= 130ms
  let rateLimitValid = true;
  let minInterval = Infinity;
  for (let i = 1; i < footsteps.length; i++) {
    const dt = footsteps[i].time - footsteps[i - 1].time;
    if (dt < minInterval) minInterval = dt;
    if (dt < 120) { // allow small 10ms frame jitter
      rateLimitValid = false;
    }
  }
  console.log(`   Min interval between footsteps: ${minInterval.toFixed(1)}ms (stride limit >= 130ms)`);
  assert(rateLimitValid, `Footsteps fired faster than rate limit: ${minInterval.toFixed(1)}ms`);

  // Test 4C: Wait for avatar to arrive at destination and stand still
  console.log('   Waiting for avatar to reach destination and stand still...');
  await new Promise(r => setTimeout(r, 1200));
  const countAtArrival = await page.evaluate(() => window.__footsteps.length);

  // Monitor for another 800ms while standing still
  await new Promise(r => setTimeout(r, 800));
  const countAfterResting = await page.evaluate(() => window.__footsteps.length);
  console.log(`   Footsteps after resting: arrived at ${countAtArrival}, after resting: ${countAfterResting}`);
  assert(countAfterResting === countAtArrival, `Footsteps continued playing while standing still! (${countAfterResting} vs ${countAtArrival})`);
  console.log('   ✅ PASS: Isometric footsteps cadence, alternation, and stop-on-still verified.');

  // =================================================================
  // CHALLENGE 5: Coffee Boost & Proximity Shadowing Empirical Test
  // =================================================================
  console.log('\n--- CHALLENGE 5: Coffee Boost & Proximity Shadowing Investigation ---');

  // Test 5A: Empirical Proximity Shadowing Check in UI
  const proximityFinding = await page.evaluate(async () => {
    const { getInteractiveSpots } = await import('/src/data/workstations.ts');
    const spots = getInteractiveSpots('office', false, false, false, false);
    const p = { x: 1.8, y: 5.8 }; // Player coordinate when at Bar & Pizza
    const selected = spots.find(s => Math.hypot(s.interactX - p.x, s.interactY - p.y) < 1.3);
    const distToMarco = Math.hypot(2.8 - p.x, 5.2 - p.y);
    const distToCoffee = Math.hypot(1.8 - p.x, 5.8 - p.y);

    const activeH3 = document.querySelector('h3')?.textContent || null;
    const buttonTexts = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim());
    const hasCoffeeAction = buttonTexts.some(t => t.includes('PRENDI ESPRESSO'));

    return {
      selectedId: selected ? selected.id : null,
      distToMarco,
      distToCoffee,
      activeH3,
      hasCoffeeAction,
      buttonTexts
    };
  });

  console.log('   Empirical Proximity Analysis at Bar & Pizza:', {
    distToCoffee: proximityFinding.distToCoffee,
    distToMarco: proximityFinding.distToMarco.toFixed(3),
    selectedBySpotsFind: proximityFinding.selectedId,
    activeH3: proximityFinding.activeH3,
    hasCoffeeActionButton: proximityFinding.hasCoffeeAction
  });

  // Document the empirical flaw:
  // When standing at Coffee (1.8, 5.8), Marco (2.8, 5.2) is 1.166 away (< 1.3).
  // Because spots.find() returns the first match in array order (Marco is index 3, Coffee is index 4),
  // Marco shadows Coffee, making the coffee button unreachable in the UI!
  const isCoffeeShadowedByMarco = proximityFinding.selectedId === 'marco' && !proximityFinding.hasCoffeeAction;
  console.log(`   ⚠️ PROXIMITY SHADOWING BUG DETECTED: ${isCoffeeShadowedByMarco}`);
  if (isCoffeeShadowedByMarco) {
    console.warn('   [BUG CONFIRMED]: spots.find() selects Marco (dist 1.166) instead of Coffee (dist 0.000)!');
    console.warn('   Action card renders "PARLA CON MARCO" instead of "PRENDI ESPRESSO & PIZZA"!');
  }

  // Test 5B: Direct SFX Synthesis & Double-Sound Verification of playCoffee()
  console.log('   Testing playCoffee() synthesis and double-sound behavior...');
  const sfxCoffeeResult = await page.evaluate(async (audioUrl) => {
    const { sound } = await import(audioUrl);
    let coffeeCount = 0;
    let clickCount = 0;
    const origCoffee = sound.playCoffee.bind(sound);
    sound.playCoffee = () => { coffeeCount++; origCoffee(); };
    const origClick = sound.playClick.bind(sound);
    sound.playClick = () => { clickCount++; origClick(); };

    // Invoke playCoffee directly (as called by handleCoffeeClick)
    sound.playCoffee();

    // Also stress test with 4 rapid triggers
    for (let i = 0; i < 4; i++) {
      sound.playCoffee();
    }

    return {
      coffeeCount,
      clickCount,
      ctxRunning: sound.getContext()?.state === 'running'
    };
  }, audioModuleUrl);

  console.log('   playCoffee SFX synthesis results:', sfxCoffeeResult);
  assert(sfxCoffeeResult.coffeeCount === 5, `Expected 5 playCoffee calls, got ${sfxCoffeeResult.coffeeCount}`);
  assert(sfxCoffeeResult.clickCount === 0, `Double sound detected! playClick called ${sfxCoffeeResult.clickCount} times`);
  assert(sfxCoffeeResult.ctxRunning === true, 'AudioContext faulted during coffee synthesis');
  console.log('   ✅ PASS: playCoffee() synthesizes cleanly with 0 double sound and 0 errors.');

  // =================================================================
  // CHALLENGE 6: Audio Concurrency & Digital Headroom Under Load
  // =================================================================
  console.log('\n--- CHALLENGE 6: High-Load Audio Concurrency Stress Test ---');
  const concurrencyResult = await page.evaluate(async (audioUrl, bgmUrl) => {
    const { sound } = await import(audioUrl);
    const { synthwaveBgm } = await import(bgmUrl);

    sound.startBgm();
    const errors = [];

    // Fire 20 keystrokes + 10 footsteps + 5 cyber alarms + 5 coffee sfx simultaneously
    for (let i = 0; i < 20; i++) {
      try {
        sound.playMechanicalKey();
      } catch (e) {
        errors.push(`MechanicalKey: ${e.message}`);
      }
    }
    for (let i = 0; i < 10; i++) {
      try {
        sound.playFootstep(i % 2 === 0);
      } catch (e) {
        errors.push(`Footstep: ${e.message}`);
      }
    }
    for (let i = 0; i < 5; i++) {
      try {
        sound.playCyberAlarm();
      } catch (e) {
        errors.push(`CyberAlarm: ${e.message}`);
      }
    }
    for (let i = 0; i < 5; i++) {
      try {
        sound.playCoffee();
      } catch (e) {
        errors.push(`Coffee: ${e.message}`);
      }
    }

    return {
      errors,
      ctxRunning: sound.getContext()?.state === 'running',
      bgmActive: synthwaveBgm.active
    };
  }, audioModuleUrl, bgmModuleUrl);

  console.log('   Concurrency stress result:', concurrencyResult);
  assert(concurrencyResult.errors.length === 0, `Audio concurrency produced errors: ${concurrencyResult.errors.join('; ')}`);
  assert(concurrencyResult.ctxRunning === true, 'AudioContext crashed or closed under load');
  assert(concurrencyResult.bgmActive === true, 'BGM stopped under load');
  console.log('   ✅ PASS: Web Audio engine remains pristine under concurrent load.');

  // =================================================================
  // FINAL VERIFICATION: Console Errors Check (Gate 5)
  // =================================================================
  console.log('\n--- GATE 5 VERIFICATION: Console Error Audit ---');
  console.log(`   Captured console errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.error('   Error log:', consoleErrors);
  }
  assert(consoleErrors.length === 0, `Gate 5 Violation: ${consoleErrors.length} console errors detected!`);
  console.log('   ✅ PASS: Zero console errors logged across all adversarial challenges.');

  await browser.close();

  console.log('\n================================================================');
  console.log('🏁 ADVERSARIAL VERIFICATION HARNESS COMPLETE');
  console.log(`   PROXIMITY BUG SHADOWING COFFEE: ${isCoffeeShadowedByMarco ? 'CONFIRMED' : 'NONE'}`);
  console.log('================================================================\n');

  return { isCoffeeShadowedByMarco };
}

runAdversarialSuite()
  .then(res => {
    if (res.isCoffeeShadowedByMarco) {
      console.log('RESULT: COMPONENT AUDIO SYNTHESIS IS PRISTINE, BUT UI PROXIMITY BUG SHADOWS COFFEE BOOST.');
      process.exit(2); // exit code 2 indicates empirical defect found
    } else {
      process.exit(0);
    }
  })
  .catch(err => {
    console.error('\n❌ ADVERSARIAL SUITE CRASHED:', err.message);
    process.exit(1);
  });
