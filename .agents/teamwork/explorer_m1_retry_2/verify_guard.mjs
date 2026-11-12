// /root/.gemini/antigravity-cli/scratch/cisco-cyber-office/.agents/teamwork/explorer_m1_retry_2/verify_guard.mjs
// Independent verification script for the Audio Mute Race Condition Guard
import puppeteer from 'puppeteer-core';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[VERIFY GUARD FAILED] ${message}`);
  }
}

async function run() {
  console.log('=== AUDIO MUTE RACE CONDITION VERIFICATION ===');
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required']
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });

  // Test 1: Rapid 3-Toggle (Mute -> Unmute -> Mute)
  console.log('[Test 1] Testing 3 rapid toggles (M-U-M, ends in MUTED)...');
  const res3 = await page.evaluate(async () => {
    const { sound } = await import('/src/utils/audio.ts');
    sound.initCtx();
    if (sound.isMuted) sound.toggleMute(); // ensure unmuted

    sound.toggleMute(); // 1: Mute
    sound.toggleMute(); // 2: Unmute (in-flight promise launched)
    sound.toggleMute(); // 3: Mute immediately (<20ms)

    // Wait 250ms for any in-flight promises to resolve
    await new Promise(r => setTimeout(r, 250));

    const master = sound.getMasterNode();
    return {
      isMuted: sound.isMuted,
      masterGain: master ? master.gain.value : null,
      bgmActive: sound.getBgmEngine().active
    };
  });
  console.log('   Test 1 Result:', res3);
  assert(res3.isMuted === true, 'Sound engine must be muted');
  assert(res3.masterGain !== null && res3.masterGain <= 0.001, `Master gain must be 0.0 when muted, got: ${res3.masterGain}`);
  assert(res3.bgmActive === false, 'BGM engine must not be active when muted');
  console.log('   [PASS] Master gain is 0.0 when muted after rapid toggle.');

  // Test 2: Rapid 4-Toggle (Mute -> Unmute -> Mute -> Unmute)
  console.log('[Test 2] Testing 4 rapid toggles (M-U-M-U, ends in UNMUTED)...');
  const res4 = await page.evaluate(async () => {
    const { sound } = await import('/src/utils/audio.ts');
    sound.initCtx();
    if (sound.isMuted) sound.toggleMute();

    let clickCalls = 0;
    const origPlayClick = sound.playClick.bind(sound);
    sound.playClick = () => {
      clickCalls++;
      origPlayClick();
    };

    sound.toggleMute(); // 1: Mute
    sound.toggleMute(); // 2: Unmute
    sound.toggleMute(); // 3: Mute
    sound.toggleMute(); // 4: Unmute

    await new Promise(r => setTimeout(r, 250));

    const master = sound.getMasterNode();
    return {
      isMuted: sound.isMuted,
      masterGain: master ? master.gain.value : null,
      bgmActive: sound.getBgmEngine().active,
      clickCalls
    };
  });
  console.log('   Test 2 Result:', res4);
  assert(res4.isMuted === false, 'Sound engine must be unmuted');
  assert(res4.masterGain !== null && res4.masterGain > 0.8, `Master gain must be ~0.85 when unmuted, got: ${res4.masterGain}`);
  assert(res4.bgmActive === true, 'BGM engine must be active when unmuted');
  assert(res4.clickCalls === 1, `Expected exactly 1 click call on net unmute, got: ${res4.clickCalls}`);
  console.log('   [PASS] Exactly 1 click called and master gain is 0.85.');

  await browser.close();
  console.log('=== ALL RACE CONDITION TESTS PASSED ===');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
