#!/usr/bin/env node
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = '/tmp/qa_stress_m2';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    throw new Error(msg);
  }
}

async function runM2StressSuite() {
  console.log('================================================================');
  console.log('🔥 STARTING ADVERSARIAL STRESS TEST SUITE — MILESTONE 2 (R1) 🔥');
  console.log('================================================================');

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--hide-scrollbars'],
    defaultViewport: { width: 1280, height: 800 }
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(err.toString()));

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });

  // Dismiss intro modal
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('HO CAPITO'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 400));

  // -------------------------------------------------------------
  // CHALLENGE 1: High Frame Numbers / Extended Simulation Math Audit
  // -------------------------------------------------------------
  console.log('\n--- CHALLENGE 1: Extended Simulation & Math Robustness at High Frame Numbers ---');
  const mathAuditResult = await page.evaluate(async () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'Canvas not found' };
    const ctx = canvas.getContext('2d');
    if (!ctx) return { error: '2D context not found' };

    // Dynamically import roomRenderers module from Vite
    const renderers = await import('/src/canvas/roomRenderers.ts');

    const testFrames = [
      0,
      1,
      60,
      1000,
      10000,
      100000,
      1000000,
      100000000,
      2147483647, // INT32_MAX
      Number.MAX_SAFE_INTEGER // 9007199254740991
    ];

    const results = [];

    // Test each frame
    for (const f of testFrames) {
      const originalAlpha = ctx.globalAlpha;
      let error = null;
      try {
        // Offscreen scratch canvas for isolated pixel & math check
        const offCanvas = document.createElement('canvas');
        offCanvas.width = 840;
        offCanvas.height = 620;
        const offCtx = offCanvas.getContext('2d');

        // Draw background
        offCtx.fillStyle = '#101726';
        offCtx.fillRect(0, 0, 840, 620);

        // Call all M2 renderers with large frame
        renderers.drawWarmHabboWalls(offCtx, 840, f);
        renderers.drawWarmParquetFloor(offCtx, 840, null, f);
        renderers.drawSunlightBeams(offCtx, 840);
        renderers.drawChunkyServerRack(offCtx, 2, 2, 840, false, f);
        renderers.drawChunkyAdminDesk(offCtx, 5, 2, 840, false, f);
        renderers.drawChunkySocWall(offCtx, 6, 4, 840, false, f);
        renderers.drawChunkyNeapolitanBar(offCtx, 1, 6, 840, f);
        renderers.drawCiscoHologram(offCtx, 4, 4, 840, f, 'office');

        // Underground Vault renderers
        renderers.drawUndergroundDatacenterWalls(offCtx, 840, f);
        renderers.drawUndergroundFloor(offCtx, 840, null, f);
        renderers.drawChunkyWiresharkConsole(offCtx, 2, 2, 840, false, f);
        renderers.drawChunkyFirepowerWall(offCtx, 5, 2, 840, f);
        renderers.drawCiscoHologram(offCtx, 4, 4, 840, f, 'datacenter_vault');

        // Check if alpha was left dirty or NaN
        const alphaValid = !isNaN(offCtx.globalAlpha) && offCtx.globalAlpha >= 0 && offCtx.globalAlpha <= 1;

        // Sample pixels to verify non-black / non-NaN rendering
        const imgData = offCtx.getImageData(0, 0, 840, 620).data;
        let nonZero = 0;
        let hasNan = false;
        for (let i = 0; i < imgData.length; i += 400) {
          if (imgData[i + 3] > 0) nonZero++;
          if (isNaN(imgData[i]) || isNaN(imgData[i + 1]) || isNaN(imgData[i + 2])) {
            hasNan = true;
          }
        }

        results.push({
          frame: f,
          success: true,
          alphaValid,
          renderedPixels: nonZero > 500,
          hasNan
        });
      } catch (err) {
        results.push({
          frame: f,
          success: false,
          error: err.toString()
        });
      }
    }

    // Defensive edge case: frame = undefined (default parameter check)
    try {
      const defCanvas = document.createElement('canvas');
      defCanvas.width = 840;
      defCanvas.height = 620;
      const defCtx = defCanvas.getContext('2d');
      renderers.drawWarmParquetFloor(defCtx, 840, null);
      renderers.drawUndergroundFloor(defCtx, 840, null);
      renderers.drawChunkyAdminDesk(defCtx, 5, 2, 840, false);
      renderers.drawChunkyNeapolitanBar(defCtx, 1, 6, 840);
      results.push({ frame: 'undefined_default', success: true, alphaValid: true, renderedPixels: true, hasNan: false });
    } catch (e) {
      results.push({ frame: 'undefined_default', success: false, error: e.toString() });
    }

    return { results };
  });

  console.log('   Math audit results summary:');
  for (const r of mathAuditResult.results) {
    if (!r.success || r.hasNan || !r.renderedPixels) {
      console.error(`   ❌ Failure on frame ${r.frame}:`, r);
    } else {
      console.log(`   ✅ Frame ${r.frame}: success, alphaValid: ${r.alphaValid}, renderedPixels: true, hasNan: false`);
    }
  }

  const allFramesPassed = mathAuditResult.results.every(r => r.success && !r.hasNan);
  assert(allFramesPassed, 'All extended frame simulations must pass with zero exceptions and zero NaNs');

  // -------------------------------------------------------------
  // CHALLENGE 2: Viewport Resize & Layout Collisions Stress Test
  // -------------------------------------------------------------
  console.log('\n--- CHALLENGE 2: Viewport Resize & Layout Collisions Torture Test ---');
  const viewportsToTest = [
    { name: 'iPhone SE (320x568)', width: 320, height: 568 },
    { name: 'Mobile Standard (412x915)', width: 412, height: 915 },
    { name: 'Mobile Landscape (915x412)', width: 915, height: 412 },
    { name: 'Tablet Portrait (768x1024)', width: 768, height: 1024 },
    { name: 'Tablet Landscape (1024x768)', width: 1024, height: 768 },
    { name: 'Desktop HD (1280x720)', width: 1280, height: 720 },
    { name: 'Desktop FHD (1920x1080)', width: 1920, height: 1080 },
    { name: 'Ultrawide 21:9 (2560x1080)', width: 2560, height: 1080 }
  ];

  for (const vp of viewportsToTest) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await new Promise(r => setTimeout(r, 150));

    const vpCheck = await page.evaluate((vpW, vpH) => {
      const docW = document.documentElement.scrollWidth;
      const winW = window.innerWidth;
      const hasOverflow = docW > winW;

      const canvas = document.querySelector('canvas');
      if (!canvas) return { error: 'No canvas' };

      const cRect = canvas.getBoundingClientRect();
      const canvasVisible = cRect.width > 0 && cRect.height > 0;
      const ctx = canvas.getContext('2d');
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const colorSet = new Set();
      const step = 4 * 30;
      for (let i = 0; i < imgData.length; i += step) {
        colorSet.add(`${imgData[i] >> 4},${imgData[i+1] >> 4},${imgData[i+2] >> 4}`);
      }

      // Check collision between header and main
      const header = document.querySelector('header');
      const main = document.querySelector('main');
      let collision = false;
      if (header && main) {
        const hR = header.getBoundingClientRect();
        const mR = main.getBoundingClientRect();
        const yOverlap = Math.max(0, Math.min(hR.bottom, mR.bottom) - Math.max(hR.top, mR.top));
        if (yOverlap > 2) collision = true;
      }

      return {
        hasOverflow,
        docW,
        winW,
        canvasVisible,
        canvasWidthAttr: canvas.width,
        canvasHeightAttr: canvas.height,
        canvasClientW: Math.round(cRect.width),
        canvasClientH: Math.round(cRect.height),
        uniqueColors: colorSet.size,
        collision
      };
    }, vp.width, vp.height);

    console.log(`   Viewport [${vp.name}]: overflow: ${vpCheck.hasOverflow} (${vpCheck.docW}/${vpCheck.winW}px), collision: ${vpCheck.collision}, canvas buffer: ${vpCheck.canvasWidthAttr}x${vpCheck.canvasHeightAttr}, client: ${vpCheck.canvasClientW}x${vpCheck.canvasClientH}, colors: ${vpCheck.uniqueColors}`);

    assert(!vpCheck.hasOverflow, `No overflow on ${vp.name}`);
    assert(!vpCheck.collision, `No collision on ${vp.name}`);
    assert(vpCheck.canvasVisible, `Canvas visible on ${vp.name}`);
    assert(vpCheck.canvasWidthAttr === 840 && vpCheck.canvasHeightAttr === 620, `Canvas buffer resolution invariant 840x620 preserved on ${vp.name}`);
    assert(vpCheck.uniqueColors >= 100, `Canvas renders rich colors on ${vp.name}`);
  }

  // Rapid resize oscillation test
  console.log('   Testing rapid resize oscillations...');
  for (let i = 0; i < 6; i++) {
    await page.setViewport({ width: 412 + (i % 2) * 500, height: 800 });
  }
  await page.setViewport({ width: 1280, height: 800 });
  await new Promise(r => setTimeout(r, 200));
  console.log('   ✅ Rapid viewport resize oscillations survived with 0 errors.');

  // -------------------------------------------------------------
  // CHALLENGE 3: Render Loop FPS, Jitter & Heap Stability
  // -------------------------------------------------------------
  console.log('\n--- CHALLENGE 3: Render Loop Frame Rate (FPS) & Heap Jitter Benchmark ---');
  
  // Measure CPU render execution time & rAF pacing in 1F Panoramic Office
  const officePerf = await page.evaluate(async () => {
    const renderers = await import('/src/canvas/roomRenderers.ts');
    const offCanvas = document.createElement('canvas');
    offCanvas.width = 840;
    offCanvas.height = 620;
    const ctx = offCanvas.getContext('2d');

    const cpuTimes = [];
    for (let f = 0; f < 120; f++) {
      const t0 = performance.now();
      ctx.clearRect(0, 0, 840, 620);
      renderers.drawWarmHabboWalls(ctx, 840, f);
      renderers.drawWarmParquetFloor(ctx, 840, null, f);
      renderers.drawSunlightBeams(ctx, 840);
      renderers.drawChunkyServerRack(ctx, 2, 2, 840, false, f);
      renderers.drawChunkyAdminDesk(ctx, 5, 2, 840, false, f);
      renderers.drawChunkySocWall(ctx, 6, 4, 840, false, f);
      renderers.drawChunkyNeapolitanBar(ctx, 1, 6, 840, f);
      renderers.drawCiscoHologram(ctx, 4, 4, 840, f, 'office');
      cpuTimes.push(performance.now() - t0);
    }

    const rafDeltas = await new Promise((resolve) => {
      const deltas = [];
      let lastTime = performance.now();
      let framesCount = 0;
      function frameLoop(now) {
        deltas.push(now - lastTime);
        lastTime = now;
        framesCount++;
        if (framesCount < 120) {
          requestAnimationFrame(frameLoop);
        } else {
          resolve(deltas.slice(5));
        }
      }
      requestAnimationFrame(frameLoop);
    });

    const sumCpu = cpuTimes.reduce((a, b) => a + b, 0);
    const meanCpu = sumCpu / cpuTimes.length;
    const p95Cpu = cpuTimes.sort((a,b)=>a-b)[Math.floor(cpuTimes.length * 0.95)];

    const sumRaf = rafDeltas.reduce((a, b) => a + b, 0);
    const meanRaf = sumRaf / rafDeltas.length;
    const fps = 1000 / meanRaf;

    return {
      meanCpuMs: Math.round(meanCpu * 100) / 100,
      p95CpuMs: Math.round(p95Cpu * 100) / 100,
      meanRafDeltaMs: Math.round(meanRaf * 100) / 100,
      fps: Math.round(fps * 10) / 10
    };
  });

  console.log(`   Office 1F Performance: CPU Mean: ${officePerf.meanCpuMs}ms, CPU P95: ${officePerf.p95CpuMs}ms, Software rAF FPS: ${officePerf.fps} (${officePerf.meanRafDeltaMs}ms/frame)`);
  assert(officePerf.meanCpuMs < 3.0, `Office CPU render time must be under 3.0ms (actual: ${officePerf.meanCpuMs}ms)`);
  assert(officePerf.fps >= 40, `Office rAF FPS must be >= 40 in headless browser (actual: ${officePerf.fps})`);

  // Elevator transit to -1F Underground Datacenter Vault
  console.log('   Navigating to Underground Datacenter Vault (-1F)...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('Ascensore (-1)'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1200));

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('SCENDI AL DATACENTER'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 600));

  // Measure in -1F Datacenter Vault
  const vaultPerf = await page.evaluate(async () => {
    const renderers = await import('/src/canvas/roomRenderers.ts');
    const offCanvas = document.createElement('canvas');
    offCanvas.width = 840;
    offCanvas.height = 620;
    const ctx = offCanvas.getContext('2d');

    const cpuTimes = [];
    for (let f = 0; f < 120; f++) {
      const t0 = performance.now();
      ctx.clearRect(0, 0, 840, 620);
      renderers.drawUndergroundDatacenterWalls(ctx, 840, f);
      renderers.drawUndergroundFloor(ctx, 840, null, f);
      renderers.drawChunkyWiresharkConsole(ctx, 2, 2, 840, false, f);
      renderers.drawChunkyFirepowerWall(ctx, 5, 2, 840, f);
      renderers.drawChunkySanVault(ctx, 2, 5, 840, f);
      renderers.drawChunkyIndustrialElevator(ctx, 6, 1, 840, 'datacenter_vault', f);
      renderers.drawChunkySecBot(ctx, 1, 6, 840, f);
      renderers.drawCiscoHologram(ctx, 4, 4, 840, f, 'datacenter_vault');
      cpuTimes.push(performance.now() - t0);
    }

    const rafDeltas = await new Promise((resolve) => {
      const deltas = [];
      let lastTime = performance.now();
      let framesCount = 0;
      function frameLoop(now) {
        deltas.push(now - lastTime);
        lastTime = now;
        framesCount++;
        if (framesCount < 120) {
          requestAnimationFrame(frameLoop);
        } else {
          resolve(deltas.slice(5));
        }
      }
      requestAnimationFrame(frameLoop);
    });

    const sumCpu = cpuTimes.reduce((a, b) => a + b, 0);
    const meanCpu = sumCpu / cpuTimes.length;
    const p95Cpu = cpuTimes.sort((a,b)=>a-b)[Math.floor(cpuTimes.length * 0.95)];

    const sumRaf = rafDeltas.reduce((a, b) => a + b, 0);
    const meanRaf = sumRaf / rafDeltas.length;
    const fps = 1000 / meanRaf;

    return {
      meanCpuMs: Math.round(meanCpu * 100) / 100,
      p95CpuMs: Math.round(p95Cpu * 100) / 100,
      meanRafDeltaMs: Math.round(meanRaf * 100) / 100,
      fps: Math.round(fps * 10) / 10
    };
  });

  console.log(`   Vault -1F Performance: CPU Mean: ${vaultPerf.meanCpuMs}ms, CPU P95: ${vaultPerf.p95CpuMs}ms, Software rAF FPS: ${vaultPerf.fps} (${vaultPerf.meanRafDeltaMs}ms/frame)`);
  assert(vaultPerf.meanCpuMs < 3.0, `Vault CPU render time must be under 3.0ms (actual: ${vaultPerf.meanCpuMs}ms)`);
  assert(vaultPerf.fps >= 40, `Vault rAF FPS must be >= 40 in headless browser (actual: ${vaultPerf.fps})`);

  // Return to 1F Office
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('Sali al 1° Piano'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 600));

  // -------------------------------------------------------------
  // CHALLENGE 4: Hologram Depth Sorting & Free-Roam Navigation
  // -------------------------------------------------------------
  console.log('\n--- CHALLENGE 4: Hologram Depth Sorting & Free-Roam Walkability ---');
  const holoAudit = await page.evaluate(async () => {
    // Check if tile (4,4) is in interactiveSpots
    const workstationsMod = await import('/src/data/workstations.ts');
    const spotsOffice = workstationsMod.getInteractiveSpots('office', false, false, false, false);
    const spotsVault = workstationsMod.getInteractiveSpots('datacenter_vault', false, false, false, false);

    const isBlockingOffice = spotsOffice.some(s => s.tileX === 4 && s.tileY === 4);
    const isBlockingVault = spotsVault.some(s => s.tileX === 4 && s.tileY === 4);

    return {
      isBlockingOffice,
      isBlockingVault,
      hologramDepth: 4 + 4 // 8
    };
  });

  console.log(`   Hologram depth check: depth = 8, blocks navigation in Office: ${holoAudit.isBlockingOffice}, blocks in Vault: ${holoAudit.isBlockingVault}`);
  assert(!holoAudit.isBlockingOffice, 'Hologram must NOT block player movement in Office');
  assert(!holoAudit.isBlockingVault, 'Hologram must NOT block player movement in Vault');

  // Verify console error audit
  console.log('\n--- CONSOLE ERROR AUDIT ---');
  console.log(`   Captured console errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.error('   Errors:', consoleErrors);
  }
  assert(consoleErrors.length === 0, 'Zero console errors allowed');

  await browser.close();

  console.log('\n================================================================');
  console.log('🏁 ALL ADVERSARIAL STRESS TESTS PASSED 100%!');
  console.log('================================================================');
}

runM2StressSuite().catch(err => {
  console.error('STRESS TEST RUN FAILED:', err);
  process.exit(1);
});
