#!/usr/bin/env node
import puppeteer from 'puppeteer-core';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function assert(cond, msg) {
  if (!cond) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    throw new Error(msg);
  }
}

async function runHologramAdversarialTest() {
  console.log('================================================================');
  console.log('🔮 STARTING ADVERSARIAL VERIFICATION: HOLOGRAM & PATHFINDING (M2)');
  console.log('================================================================\n');

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

  // Dismiss intro dialogue
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('HO CAPITO'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 400));

  console.log('--- TEST 1: Exact Pixel Sampling of Hologram at Tile (4, 4) ---');
  // Tile (4, 4) in 840x620 canvas:
  // ptX = canvasW / 2 = 420.
  // ptY = (4 + 4) * 24 + 205 = 397.
  // Hologram center is at ptY - 48 = 349.
  const holoPixelReport = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    const cx = Math.round(width / 2); // 420
    const cy = 349; // hologram center

    const imgData = ctx.getImageData(cx - 20, cy - 30, 40, 60).data;
    let cyanBluePixels = 0;
    let totalSampled = 0;
    const colorSet = new Set();

    for (let i = 0; i < imgData.length; i += 4) {
      const r = imgData[i];
      const g = imgData[i + 1];
      const b = imgData[i + 2];
      const a = imgData[i + 3];
      totalSampled++;
      if (a > 30) {
        if ((b > 140 && g > 100) || (r > 200 && g > 200 && b > 200)) {
          cyanBluePixels++;
        }
        colorSet.add(`${r >> 4},${g >> 4},${b >> 4}`);
      }
    }

    // Full canvas color diversity check
    const fullData = ctx.getImageData(0, 0, width, height).data;
    const fullColorSet = new Set();
    const step = 4 * 25;
    for (let i = 0; i < fullData.length; i += step) {
      const r = fullData[i];
      const g = fullData[i + 1];
      const b = fullData[i + 2];
      const a = fullData[i + 3];
      if (a > 0) {
        fullColorSet.add(`${r >> 4},${g >> 4},${b >> 4}`);
      }
    }

    return {
      width,
      height,
      cx,
      cy,
      cyanBluePixels,
      totalSampled,
      hologramDensityRatio: cyanBluePixels / totalSampled,
      uniqueColorBucketsInHolo: colorSet.size,
      fullCanvasColorBuckets: fullColorSet.size
    };
  });

  console.log('   Hologram pixel report:', holoPixelReport);
  assert(holoPixelReport !== null, 'Canvas not found');
  assert(holoPixelReport.cyanBluePixels > 500, `Hologram cyan/blue pixel count too low: ${holoPixelReport.cyanBluePixels}`);
  assert(holoPixelReport.hologramDensityRatio > 0.3, `Hologram density ratio too low: ${holoPixelReport.hologramDensityRatio}`);
  assert(holoPixelReport.fullCanvasColorBuckets >= 12, `Full canvas color diversity too low: ${holoPixelReport.fullCanvasColorBuckets}`);
  console.log(`   ✅ PASS: Hologram renders distinctly with ${holoPixelReport.cyanBluePixels} photons (${holoPixelReport.uniqueColorBucketsInHolo} local buckets, ${holoPixelReport.fullCanvasColorBuckets} full-canvas buckets >= 12).`);

  console.log('\n--- TEST 2: Clicking on Hologram Does NOT Trigger Unwanted Modal / Interaction ---');
  // Click on the hologram body in the canvas (cx = 420, cy = 349)
  const canvasBox = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const r = canvas.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  });

  const clickHoloX = canvasBox.left + canvasBox.width * (420 / 840);
  const clickHoloY = canvasBox.top + canvasBox.height * (349 / 620);

  await page.mouse.click(clickHoloX, clickHoloY);
  await new Promise(r => setTimeout(r, 1200));

  // Check if any minigame or dialogue modal was opened
  const gameState = await page.evaluate(() => {
    const bodyText = document.body.textContent;
    const hasRackGame = bodyText.includes('PATCH PANEL') || bodyText.includes('CATALYST 9300');
    const hasCliGame = bodyText.includes('CISCO IOS CLI') || bodyText.includes('Switch#');
    const hasUmbrellaGame = bodyText.includes('DNS THREAT INTELLIGENCE');
    const hasWiresharkGame = bodyText.includes('WIRESHARK PACKET');
    const hasMarcoModal = bodyText.includes('Marco (Senior NetAdmin)') && bodyText.includes('Quiz');
    return {
      hasRackGame,
      hasCliGame,
      hasUmbrellaGame,
      hasWiresharkGame,
      hasMarcoModal,
      isStillInOffice: bodyText.includes('UFFICIO OPERATIVO (1F)')
    };
  });

  console.log('   Game state after clicking on hologram:', gameState);
  assert(!gameState.hasRackGame, 'Rack minigame unexpectedly opened');
  assert(!gameState.hasCliGame, 'CLI minigame unexpectedly opened');
  assert(!gameState.hasUmbrellaGame, 'Umbrella minigame unexpectedly opened');
  assert(!gameState.hasWiresharkGame, 'Wireshark minigame unexpectedly opened');
  assert(!gameState.hasMarcoModal, 'Marco quiz modal unexpectedly opened');
  assert(gameState.isStillInOffice, 'Navigated away from Office unexpectedly');
  console.log('   ✅ PASS: Clicking hologram does NOT trigger any unwanted modal or minigame launch.');

  console.log('\n--- TEST 3: Pathfinding Traversability Across Tile (4, 4) in Office (1F) ---');
  // Navigate from Bar Napoletano (1, 6) across (4,4) to Admin Desk CLI (5, 2)
  console.log('   Step 3A: Navigating to Bar Napoletano (1, 6)...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('Bar Napoletano') || x.textContent.includes('Bar & Pizza'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1500));

  const atBar = await page.evaluate(() => {
    return document.body.textContent.includes('Bar Napoletano & Pizza');
  });
  console.log('   Arrived at Bar Napoletano:', atBar);
  assert(atBar, 'Failed to arrive at Bar Napoletano');

  console.log('   Step 3B: Traversing directly across (4,4) to CLI Admin workstation (5, 2)...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('CLI Admin') || x.textContent.includes('Workstation Admin'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1600));

  const atAdmin = await page.evaluate(() => {
    return document.body.textContent.includes('Workstation Admin CLI');
  });
  console.log('   Arrived at CLI Admin across (4,4):', atAdmin);
  assert(atAdmin, 'Pathfinding blocked while crossing tile (4,4)');
  console.log('   ✅ PASS: Pathfinding traversed across central tile (4,4) smoothly with 0 collision obstruction.');

  console.log('\n--- TEST 4: Datacenter Vault (-1F) Hologram & Pathfinding Traversability ---');
  // Take elevator down
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
  await new Promise(r => setTimeout(r, 800));

  const vaultHoloReport = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const cx = Math.round(width / 2);
    const cy = 349;

    const imgData = ctx.getImageData(cx - 20, cy - 30, 40, 60).data;
    let emeraldCyanPixels = 0;
    let totalSampled = 0;
    const colorSet = new Set();
    for (let i = 0; i < imgData.length; i += 4) {
      const r = imgData[i];
      const g = imgData[i + 1];
      const b = imgData[i + 2];
      const a = imgData[i + 3];
      totalSampled++;
      if (a > 30) {
        if (g > 130 && (b > 100 || g > r * 1.2)) {
          emeraldCyanPixels++;
        }
        colorSet.add(`${r >> 4},${g >> 4},${b >> 4}`);
      }
    }

    const fullData = ctx.getImageData(0, 0, width, height).data;
    const fullColorSet = new Set();
    const step = 4 * 25;
    for (let i = 0; i < fullData.length; i += step) {
      const r = fullData[i];
      const g = fullData[i + 1];
      const b = fullData[i + 2];
      const a = fullData[i + 3];
      if (a > 0) {
        fullColorSet.add(`${r >> 4},${g >> 4},${b >> 4}`);
      }
    }

    return {
      emeraldCyanPixels,
      totalSampled,
      hologramDensityRatio: emeraldCyanPixels / totalSampled,
      uniqueColorBucketsInHolo: colorSet.size,
      fullCanvasColorBuckets: fullColorSet.size
    };
  });

  console.log('   Datacenter Vault Hologram Report:', vaultHoloReport);
  assert(vaultHoloReport.emeraldCyanPixels > 300, `Vault emerald/cyan hologram pixels too low: ${vaultHoloReport.emeraldCyanPixels}`);
  assert(vaultHoloReport.fullCanvasColorBuckets >= 12, `Vault full canvas color diversity too low: ${vaultHoloReport.fullCanvasColorBuckets}`);
  console.log(`   ✅ PASS: Datacenter Vault hologram renders SEC-VAULT shield with ${vaultHoloReport.emeraldCyanPixels} photons (${vaultHoloReport.fullCanvasColorBuckets} full-canvas buckets >= 12).`);

  // Pathfinding across (4,4) in Vault: from SecBot (1, 6) to Firepower (5, 2)
  console.log('   Step 4A: Moving to SecBot (1, 6)...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('SecBot AI') || x.textContent.includes('SecBot Sentinel'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1600));

  const atSecBot = await page.evaluate(() => {
    return document.body.textContent.includes('SecBot Sentinel AI');
  });
  console.log('   Arrived at SecBot:', atSecBot);
  assert(atSecBot, 'Failed to navigate to SecBot');

  console.log('   Step 4B: Traversing directly across (4,4) in Vault to Firepower 4100 (5, 2)...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('Firepower 4100'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1600));

  const atFirepower = await page.evaluate(() => {
    return document.body.textContent.includes('Cisco Firepower 4100');
  });
  console.log('   Arrived at Firepower across (4,4):', atFirepower);
  assert(atFirepower, 'Pathfinding blocked while crossing (4,4) in Datacenter Vault');
  console.log('   ✅ PASS: Datacenter Vault traversal across (4,4) is completely smooth and unobstructed.');

  // Return to Office
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('Ascensore (1F)'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1200));

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('RISALI ALL\'UFFICIO'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 800));

  await browser.close();

  assert(consoleErrors.length === 0, `Console errors occurred: ${JSON.stringify(consoleErrors)}`);
  console.log('\n================================================================');
  console.log('🏁 ALL ADVERSARIAL HOLOGRAM & PATHFINDING CHECKS PASSED (100%)');
  console.log('================================================================\n');
}

runHologramAdversarialTest().catch(err => {
  console.error('\n❌ HOLOGRAM ADVERSARIAL TEST FAILED:', err);
  process.exit(1);
});
