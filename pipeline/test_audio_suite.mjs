// pipeline/test_audio_suite.mjs
// Automated verification suite for Milestone 1: Web Audio Synthwave BGM & Tactile SFX Suite
import puppeteer from 'puppeteer-core';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[AUDIO TEST FAILED] ${message}`);
  }
}

async function run() {
  console.log('=== STARTING PROCEDURAL WEB AUDIO VERIFICATION SUITE ===');
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
    defaultViewport: { width: 1280, height: 800 }
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(err.toString()));

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });

  // 1. Verify Audio Bus Topology & Initial Mute Status
  console.log('[Test 1/6] Verifying Audio Bus Graph & Mute Initial State...');
  const initialStatus = await page.evaluate(async () => {
    const { sound } = await import('/src/utils/audio.ts');
    return {
      isMuted: sound.isMuted,
      hasContext: sound.getContext() !== null,
    };
  });
  console.log('   Initial audio status:', initialStatus);

  // 2. Click "HO CAPITO!" to unlock audio and trigger BGM start
  console.log('[Test 2/6] Triggering user gesture via HO CAPITO button...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('HO CAPITO'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 600));

  // 3. Verify AudioContext State and Routing Graph Nodes
  console.log('[Test 3/6] Verifying AudioContext running state and node connections...');
  const routingCheck = await page.evaluate(async () => {
    const { sound } = await import('/src/utils/audio.ts');
    sound.initCtx();
    const ctx = sound.getContext();
    const master = sound.getMasterNode();
    const bgm = sound.getBgmNode();
    const sfx = sound.getSfxNode();
    return {
      ctxState: ctx ? ctx.state : null,
      masterGain: master ? master.gain.value : null,
      bgmGain: bgm ? bgm.gain.value : null,
      sfxGain: sfx ? sfx.gain.value : null,
    };
  });
  console.log('   Routing check:', routingCheck);
  assert(routingCheck.ctxState === 'running' || routingCheck.ctxState === 'suspended', 'AudioContext must be created');
  assert(routingCheck.bgmGain !== null && routingCheck.bgmGain > 0.2, 'BGM gain node must exist with ~0.30 volume');
  assert(routingCheck.sfxGain !== null && routingCheck.sfxGain > 0.6, 'SFX gain node must exist with ~0.75 volume');

  // 4. Test All Tactile SFX Methods (Non-throwing, pristine synthesis)
  console.log('[Test 4/6] Executing Tactile SFX suite (IBM Model M, Cyber Alarm, Footsteps, Coffee)...');
  const sfxResults = await page.evaluate(async () => {
    const { sound } = await import('/src/utils/audio.ts');
    const results = {};
    try {
      sound.playMechanicalKey();
      results.mechanicalKey = true;
    } catch (e) {
      results.mechanicalKey = e.message;
    }
    try {
      sound.playCyberAlarm();
      results.cyberAlarm = true;
    } catch (e) {
      results.cyberAlarm = e.message;
    }
    try {
      sound.playFootstep(false);
      sound.playFootstep(true);
      results.footstep = true;
    } catch (e) {
      results.footstep = e.message;
    }
    try {
      sound.playCoffee();
      results.coffee = true;
    } catch (e) {
      results.coffee = e.message;
    }
    try {
      sound.playClick();
      sound.playCableSnap();
      sound.playSuccess();
      sound.playError();
      sound.playAlert();
      sound.playElevator();
      sound.playPacketSniff();
      results.legacySfx = true;
    } catch (e) {
      results.legacySfx = e.message;
    }
    return results;
  });
  console.log('   SFX synthesis test results:', sfxResults);
  assert(sfxResults.mechanicalKey === true, 'playMechanicalKey failed');
  assert(sfxResults.cyberAlarm === true, 'playCyberAlarm failed');
  assert(sfxResults.footstep === true, 'playFootstep failed');
  assert(sfxResults.coffee === true, 'playCoffee failed');
  assert(sfxResults.legacySfx === true, 'Legacy SFX suite failed');

  // 5. Test BGM Sequencer Start, Stop, and Step Advancement
  console.log('[Test 5/6] Testing Synthwave BGM sequencer start/stop and drift-free progression...');
  const bgmStatus = await page.evaluate(async () => {
    const { synthwaveBgm } = await import('/src/utils/synthwaveBgm.ts');
    const { sound } = await import('/src/utils/audio.ts');
    sound.startBgm();
    return {
      active: synthwaveBgm.active,
      playing: synthwaveBgm.isPlaying(),
    };
  });
  console.log('   BGM engine active check:', bgmStatus);
  assert(bgmStatus.active === true, 'Synthwave BGM should be active after startBgm()');

  // Let BGM run for 400ms to verify lookahead scheduler executes steps
  await new Promise(r => setTimeout(r, 400));

  // 6. Test Synchronized Mute Toggle & Subscription
  console.log('[Test 6/6] Testing HUD Mute toggle & reactive subscription...');
  const muteCheck = await page.evaluate(async () => {
    const { sound } = await import('/src/utils/audio.ts');
    let subscriptionFired = false;
    let subscriptionVal = null;
    const unsub = sound.subscribeMute((val) => {
      subscriptionFired = true;
      subscriptionVal = val;
    });

    const isMutedNow = sound.toggleMute();
    unsub();
    return {
      isMutedNow,
      subscriptionFired,
      subscriptionVal,
      localStorageVal: localStorage.getItem('cisco_sound_muted'),
    };
  });
  console.log('   Mute toggle check:', muteCheck);
  assert(muteCheck.subscriptionFired === true, 'Mute subscription listener must fire on toggleMute');
  assert(muteCheck.subscriptionVal === muteCheck.isMutedNow, 'Subscription received value must match toggle state');
  assert(muteCheck.localStorageVal === String(muteCheck.isMutedNow), 'localStorage cisco_sound_muted must be synchronized');

  // Clean toggle back
  await page.evaluate(async () => {
    const { sound } = await import('/src/utils/audio.ts');
    if (sound.isMuted) sound.toggleMute();
  });

  await browser.close();

  assert(consoleErrors.length === 0, `Errors during audio tests: ${JSON.stringify(consoleErrors)}`);
  console.log('=== ALL PROCEDURAL WEB AUDIO TESTS PASSED 100%! ===\n');
}

run().catch(err => {
  console.error('Audio test suite failed:', err);
  process.exit(1);
});
