// /tmp/stress_audio_adversarial.mjs
import puppeteer from 'puppeteer-core';

async function runAdversarialStressTest() {
  console.log('=== STARTING ADVERSARIAL AUDIO STRESS TESTS ===');
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
    defaultViewport: { width: 1280, height: 800 }
  });

  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.toString()));
  page.on('console', msg => {
    if (msg.type() === 'error') pageErrors.push(msg.text());
  });

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });

  // Dismiss greeting
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('HO CAPITO'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 500));

  // --- STRESS TEST 1: Rapid Toggle of HUD Mute Button ---
  console.log('[Stress 1] Rapid HUD Mute Toggle (50 rapid toggles)...');
  const rapidToggleResult = await page.evaluate(async () => {
    const { sound } = await import('/src/utils/audio.ts');
    let listenerCount = 0;
    const unsub = sound.subscribeMute(() => { listenerCount++; });

    const toggleResults = [];
    for (let i = 0; i < 50; i++) {
      const state = sound.toggleMute();
      toggleResults.push(state);
      // microscopic delay to simulate chaotic clicks
      if (i % 5 === 0) {
        await new Promise(r => setTimeout(r, 10));
      }
    }
    unsub();

    // Settle for 100ms
    await new Promise(r => setTimeout(r, 100));

    const masterNode = sound.getMasterNode();
    const finalMasterGain = masterNode ? masterNode.gain.value : null;

    return {
      finalMuted: sound.isMuted,
      finalMasterGain,
      listenerCount,
      bgmActive: sound.getBgmEngine().active
    };
  });
  console.log('   Rapid toggle result:', rapidToggleResult);

  // If final state is muted, masterGain should ramp to ~0 and BGM stopped
  // If unmuted, masterGain should ramp to ~0.85 and BGM active
  if (rapidToggleResult.finalMuted) {
    if (rapidToggleResult.finalMasterGain > 0.05) {
      console.warn('   WARNING: Rapid toggle left masterGain non-zero when muted:', rapidToggleResult.finalMasterGain);
    }
    if (rapidToggleResult.bgmActive) {
      console.warn('   WARNING: BGM still active when muted!');
    }
  }

  // --- STRESS TEST 2: Multiple AudioContext Suspensions and Resumptions ---
  console.log('[Stress 2] AudioContext repeated suspend/resume cycle...');
  const suspendResumeResult = await page.evaluate(async () => {
    const { sound } = await import('/src/utils/audio.ts');
    const ctx = sound.getContext();
    if (!ctx) return { error: 'No ctx' };

    const states = [];
    for (let i = 0; i < 10; i++) {
      try {
        await ctx.suspend();
        states.push(ctx.state);
        await sound.resumeContext();
        states.push(ctx.state);
      } catch (e) {
        states.push('ERR: ' + e.message);
      }
    }
    return { states, finalState: ctx.state };
  });
  console.log('   Suspend/resume states count:', suspendResumeResult.states.length, 'Final state:', suspendResumeResult.finalState);

  // --- STRESS TEST 3: High-frequency Concurrent SFX Burst (Typing Storm) ---
  console.log('[Stress 3] High-frequency concurrent SFX burst (100 keystrokes in 200ms)...');
  const sfxStormResult = await page.evaluate(async () => {
    const { sound } = await import('/src/utils/audio.ts');
    if (sound.isMuted) sound.toggleMute(); // ensure unmuted

    const start = performance.now();
    let thrown = 0;
    for (let i = 0; i < 100; i++) {
      try {
        sound.playMechanicalKey();
        if (i % 10 === 0) sound.playFootstep(i % 2 === 0);
        if (i % 25 === 0) sound.playCyberAlarm();
      } catch (e) {
        thrown++;
      }
      if (i % 5 === 0) {
        await new Promise(r => setTimeout(r, 5));
      }
    }
    return {
      durationMs: performance.now() - start,
      exceptions: thrown
    };
  });
  console.log('   SFX storm result:', sfxStormResult);

  // --- STRESS TEST 4: Long BGM Playback & Memory / Clock Drift check ---
  console.log('[Stress 4] Multi-bar BGM playback (5 seconds) & clock drift check...');
  const bgmDriftCheck = await page.evaluate(async () => {
    const { sound } = await import('/src/utils/audio.ts');
    const { synthwaveBgm } = await import('/src/utils/synthwaveBgm.ts');
    if (sound.isMuted) sound.toggleMute();
    sound.startBgm();

    const ctx = sound.getContext();
    const t0 = ctx.currentTime;
    await new Promise(r => setTimeout(r, 3000));
    const t1 = ctx.currentTime;

    return {
      active: synthwaveBgm.active,
      elapsedAudioClock: t1 - t0,
      ctxRunning: ctx.state === 'running'
    };
  });
  console.log('   BGM playback check:', bgmDriftCheck);

  // --- STRESS TEST 5: Heap / Memory Stability Check ---
  console.log('[Stress 5] Performance memory check...');
  const memoryCheck = await page.evaluate(() => {
    if (window.performance && window.performance.memory) {
      return {
        usedJSHeapSize: window.performance.memory.usedJSHeapSize,
        totalJSHeapSize: window.performance.memory.totalJSHeapSize
      };
    }
    return { unsupported: true };
  });
  console.log('   Memory stats:', memoryCheck);

  await browser.close();

  console.log('   Page Errors captured during stress tests:', pageErrors);
  console.log('=== ADVERSARIAL STRESS TEST COMPLETE ===');
  return { pageErrors, rapidToggleResult, sfxStormResult, bgmDriftCheck };
}

runAdversarialStressTest()
  .then(res => {
    if (res.pageErrors.length > 0) {
      console.error('FAILED with page errors:', res.pageErrors);
      process.exit(1);
    }
    console.log('ALL ADVERSARIAL STRESS TESTS COMPLETED SUCCESSFULLY.');
    process.exit(0);
  })
  .catch(err => {
    console.error('FATAL in stress test:', err);
    process.exit(1);
  });
