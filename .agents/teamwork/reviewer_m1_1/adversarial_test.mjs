// .agents/teamwork/reviewer_m1_1/adversarial_test.mjs
// Adversarial stress-testing suite for Web Audio Synthwave BGM and Tactile SFX Suite
import puppeteer from 'puppeteer-core';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[ADVERSARIAL STRESS TEST FAILED] ${message}`);
  }
}

async function run() {
  console.log('=== STARTING ADVERSARIAL AUDIO STRESS TESTS ===');
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 800 }
  });

  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.toString()));
  page.on('console', msg => {
    if (msg.type() === 'error') pageErrors.push(msg.text());
  });

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });

  // -------------------------------------------------------------
  // Test 1: Rapid Mute Hammering (50 toggles in 250ms)
  // -------------------------------------------------------------
  console.log('[Stress 1] Rapid Mute Hammering (50 rapid toggles)...');
  const muteHammerResult = await page.evaluate(async () => {
    const { sound } = await import('/src/utils/audio.ts');
    sound.initCtx();
    const initialMute = sound.isMuted;
    
    // Rapidly toggle 50 times
    for (let i = 0; i < 50; i++) {
      sound.toggleMute();
    }
    
    // Wait 50ms for ramps to settle
    await new Promise(r => setTimeout(r, 60));
    
    const finalMute = sound.isMuted;
    const masterGainVal = sound.getMasterNode()?.gain.value;
    
    return {
      initialMute,
      finalMute,
      // 50 toggles from initialMute should return back to initialMute
      expectedMute: initialMute,
      matchesExpected: finalMute === initialMute,
      masterGainVal,
    };
  });
  console.log('   Mute hammer result:', muteHammerResult);
  assert(muteHammerResult.matchesExpected, `Mute state after 50 toggles did not match expected: ${JSON.stringify(muteHammerResult)}`);

  // -------------------------------------------------------------
  // Test 2: Concurrent High-Frequency SFX Burst (100 rapid calls)
  // -------------------------------------------------------------
  console.log('[Stress 2] High-Frequency Concurrent SFX Burst (100 concurrent triggers)...');
  const sfxBurstResult = await page.evaluate(async () => {
    const { sound } = await import('/src/utils/audio.ts');
    let footstepCalls = 0;
    
    try {
      for (let i = 0; i < 100; i++) {
        sound.playMechanicalKey();
        sound.playCyberAlarm();
        sound.playCoffee();
        sound.playFootstep(i % 2 === 0);
        footstepCalls++;
      }
      return { success: true, footstepCalls };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  console.log('   SFX burst result:', sfxBurstResult);
  assert(sfxBurstResult.success, `SFX burst threw error: ${sfxBurstResult.error}`);

  // -------------------------------------------------------------
  // Test 3: Footstep Stride Rate-Limiting Verification
  // -------------------------------------------------------------
  console.log('[Stress 3] Footstep 130ms Stride Rate-Limiting Invariant...');
  const footstepRateResult = await page.evaluate(async () => {
    const { sound } = await import('/src/utils/audio.ts');
    // Ensure sound is unmuted
    if (sound.isMuted) sound.toggleMute();
    
    // Call footstep immediately twice synchronously
    sound.playFootstep(false);
    const last1 = sound['lastFootstepTime'];
    
    // Call immediately synchronously (delta < 1ms, guaranteed < 130ms)
    sound.playFootstep(true);
    const last2 = sound['lastFootstepTime'];
    
    // Call 160ms later (guaranteed > 130ms)
    await new Promise(r => setTimeout(r, 160));
    sound.playFootstep(false);
    const last3 = sound['lastFootstepTime'];
    
    return {
      last1,
      last2,
      diff: last2 - last1,
      firstCallTime: last1,
      secondCallIgnored: last1 === last2,
      thirdCallAccepted: last3 > last2,
    };
  });
  console.log('   Footstep rate limit check:', footstepRateResult);
  assert(footstepRateResult.secondCallIgnored, 'Second footstep call within 130ms should have been ignored');
  assert(footstepRateResult.thirdCallAccepted, 'Third footstep call after 140ms should have been accepted');

  // -------------------------------------------------------------
  // Test 4: Clock Drift / Time Warp Simulation on BGM Sequencer
  // -------------------------------------------------------------
  console.log('[Stress 4] Clock Drift / 10s Time Warp Recovery on BGM Scheduler...');
  const driftResult = await page.evaluate(async () => {
    const { sound } = await import('/src/utils/audio.ts');
    const { synthwaveBgm } = await import('/src/utils/synthwaveBgm.ts');
    
    if (sound.isMuted) sound.toggleMute();
    sound.startBgm();
    
    const ctx = sound.getContext();
    if (!ctx) return { error: 'No audio context' };
    
    // Force nextStepTime to 10 seconds in the past to simulate suspended background tab
    synthwaveBgm['nextStepTime'] = ctx.currentTime - 10.0;
    
    // Trigger tick manually
    synthwaveBgm['scheduleTick']();
    
    // Check if nextStepTime was cleanly caught up without infinite loop
    const caughtUpTime = synthwaveBgm['nextStepTime'];
    const isCleanRecovery = caughtUpTime >= ctx.currentTime && caughtUpTime <= ctx.currentTime + 0.25;
    
    return {
      ctxCurrentTime: ctx.currentTime,
      caughtUpTime,
      isCleanRecovery,
    };
  });
  console.log('   Drift recovery result:', driftResult);
  assert(driftResult.isCleanRecovery, `Clock drift recovery failed: ${JSON.stringify(driftResult)}`);

  // -------------------------------------------------------------
  // Test 5: Double Start / Double Stop Lifecycle Invariants
  // -------------------------------------------------------------
  console.log('[Stress 5] Double Start / Double Stop Lifecycle Invariants...');
  const lifecycleResult = await page.evaluate(async () => {
    const { synthwaveBgm } = await import('/src/utils/synthwaveBgm.ts');
    
    // Stop first
    synthwaveBgm.stop();
    synthwaveBgm.stop(); // double stop
    const stoppedActive = synthwaveBgm.active;
    
    // Start twice
    synthwaveBgm.start();
    const firstTimerId = synthwaveBgm['timerId'];
    synthwaveBgm.start(); // double start
    const secondTimerId = synthwaveBgm['timerId'];
    
    const activeRunning = synthwaveBgm.active;
    
    // Stop cleanly
    synthwaveBgm.stop();
    const finalActive = synthwaveBgm.active;
    const finalTimerId = synthwaveBgm['timerId'];
    
    return {
      stoppedActive,
      activeRunning,
      timersIdentical: firstTimerId === secondTimerId,
      finalActive,
      finalTimerId,
    };
  });
  console.log('   Lifecycle invariant result:', lifecycleResult);
  assert(!lifecycleResult.stoppedActive, 'Should be inactive after stop');
  assert(lifecycleResult.activeRunning, 'Should be active after start');
  assert(lifecycleResult.timersIdentical, 'Double start must NOT create duplicate intervals');
  assert(!lifecycleResult.finalActive, 'Should be inactive after final stop');
  assert(lifecycleResult.finalTimerId === null, 'timerId must be cleared to null on stop');

  // -------------------------------------------------------------
  // Test 6: Fault-Tolerant Mute Subscription (Fault Injection)
  // -------------------------------------------------------------
  console.log('[Stress 6] Fault-Tolerant Mute Subscription with Throwing Listener...');
  const faultResult = await page.evaluate(async () => {
    const { sound } = await import('/src/utils/audio.ts');
    let secondListenerFired = false;
    
    // Register listener that throws
    const unsub1 = sound.subscribeMute(() => {
      throw new Error('Explosive subscriber error!');
    });
    
    // Register normal listener
    const unsub2 = sound.subscribeMute((val) => {
      secondListenerFired = true;
    });
    
    // Toggle mute: should not throw, second listener should fire
    let toggleThrew = false;
    try {
      sound.toggleMute();
    } catch {
      toggleThrew = true;
    }
    
    unsub1();
    unsub2();
    
    // Restore mute state
    if (sound.isMuted) sound.toggleMute();
    
    return {
      toggleThrew,
      secondListenerFired,
    };
  });
  console.log('   Fault injection result:', faultResult);
  assert(!faultResult.toggleThrew, 'toggleMute should NOT throw even if a listener throws');
  assert(faultResult.secondListenerFired, 'Subsequent listeners must execute despite earlier listener errors');

  await browser.close();
  const unexpectedErrors = pageErrors.filter(e => !e.includes('Explosive subscriber error'));
  assert(unexpectedErrors.length === 0, `Page errors detected during adversarial tests: ${JSON.stringify(unexpectedErrors)}`);
  console.log('=== ALL ADVERSARIAL STRESS TESTS PASSED 100%! ===\n');
}

run().catch(err => {
  console.error('[FATAL ADVERSARIAL FAILURE]', err);
  process.exit(1);
});
