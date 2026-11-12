#!/usr/bin/env node
import puppeteer from 'puppeteer-core';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = '/tmp/qa_reports';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[QA ASSERTION FAILED] ${message}`);
  }
}

async function verifyViewportInvariants(page, label) {
  const report = await page.evaluate(() => {
    const docWidth = document.documentElement.scrollWidth;
    const winWidth = window.innerWidth;
    const horizontalOverflow = docWidth > winWidth;

    // Check major layout sections for bounding-box overlap
    const selectors = ['header', 'main', 'section', 'footer'];
    const boxes = selectors
      .map(sel => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { sel, top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
      })
      .filter(Boolean);

    const collisions = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        // Allow 1px subpixel rounding tolerance
        const xOverlap = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const yOverlap = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        if (xOverlap > 1 && yOverlap > 1) {
          collisions.push(`${a.sel} overlaps ${b.sel} by ${Math.round(xOverlap)}x${Math.round(yOverlap)}px`);
        }
      }
    }

    // Check Canvas Pixel Integrity (non-black / non-empty)
    const canvas = document.querySelector('canvas');
    let canvasValid = false;
    let uniqueColors = 0;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const colorSet = new Set();
      let nonBlackPixels = 0;
      const step = 4 * 25; // sample every 25th pixel for speed
      const totalSampled = Math.floor(imgData.length / step);
      for (let i = 0; i < imgData.length; i += step) {
        const r = imgData[i];
        const g = imgData[i + 1];
        const b = imgData[i + 2];
        const a = imgData[i + 3];
        if (a > 0 && (r > 20 || g > 25 || b > 35)) {
          nonBlackPixels++;
        }
        colorSet.add(`${r >> 4},${g >> 4},${b >> 4}`);
      }
      uniqueColors = colorSet.size;
      canvasValid = nonBlackPixels > totalSampled * 0.25 && uniqueColors >= 12;
    }

    return {
      docWidth,
      winWidth,
      horizontalOverflow,
      collisions,
      canvasValid,
      uniqueColors
    };
  });

  assert(!report.horizontalOverflow, `${label}: Horizontal overflow detected (${report.docWidth}px > ${report.winWidth}px)`);
  assert(report.collisions.length === 0, `${label}: UI Layout collision detected: ${report.collisions.join(', ')}`);
  assert(report.canvasValid, `${label}: Canvas failed pixel integrity check (unique color buckets: ${report.uniqueColors})`);
  console.log(`   [PASS] ${label}: 0 overflow (${report.docWidth}/${report.winWidth}px), 0 collisions, Canvas valid (${report.uniqueColors} color buckets)`);
}

async function runQa() {
  console.log('=== STARTING 5-GATE DETERMINISTIC MULTI-AGENT QA SUITE ===');

  // GATE 1: TypeScript & Production Build
  console.log('\n[Gate 1/5] Running TypeScript & Vite Production Build (tsc -b && vite build)...');
  execSync('npm run build', { stdio: 'pipe' });
  console.log('   [PASS] Gate 1: Zero TypeScript or bundler errors.');

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--hide-scrollbars'],
    defaultViewport: { width: 412, height: 915 }
  });

  const page = await browser.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.toString()));

  // GATE 2 & 3: Mobile Portrait (412x915) Invariants & E2E Flow
  console.log('\n[Gate 2/5] Testing Mobile Portrait (412x915) Layout & Canvas Integrity...');
  await page.setViewport({ width: 412, height: 915 });
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 300));
  await verifyViewportInvariants(page, 'Mobile Initial');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'mobile_1_initial.png') });

  // Dismiss intro dialogue
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('HO CAPITO'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 400));
  await verifyViewportInvariants(page, 'Mobile Free Roam');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'mobile_2_free_roam.png') });

  // GATE 3: Interactive Station Walk & Mission Trigger
  console.log('\n[Gate 3/5] Testing Autonomous Avatar Pathfinding & Station Interaction...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('Rack 9300'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1600));
  await verifyViewportInvariants(page, 'Mobile Near Rack');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'mobile_3_rack_arrival.png') });

  const missionBtnExists = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).some(x => x.textContent.includes('ENTRA NELLA MISSIONE'));
  });
  assert(missionBtnExists, 'Station action button "ENTRA NELLA MISSIONE" did not appear after walking to Rack 9300');
  console.log('   [PASS] Gate 3: Avatar walked to Rack 9300 and triggered contextual action card.');

  // GATE 4: Desktop Widescreen (1920x1080) Invariants
  console.log('\n[Gate 4/5] Testing Desktop Widescreen (1920x1080) Layout & Canvas Integrity...');
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 500));
  await verifyViewportInvariants(page, 'Desktop Widescreen');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'desktop_1_initial.png') });

  await browser.close();

  // GATE 5: Zero Console/Runtime Errors
  console.log('\n[Gate 5/5] Verifying Console & Runtime Error Log...');
  assert(errors.length === 0, `Runtime console/page errors detected: ${JSON.stringify(errors)}`);
  console.log('   [PASS] Gate 5: 0 runtime or console errors.');

  console.log('\n=== ALL 5 DETERMINISTIC QA GATES PASSED 100% ===');
  console.log(`Visual proof saved in: ${SCREENSHOT_DIR}`);
}

runQa().catch(err => {
  console.error('\n❌ QA SUITE FAILED:', err.message);
  process.exit(1);
});
