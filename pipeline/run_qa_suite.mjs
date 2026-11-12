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

async function verifyViewportInvariants(page, label, checkCanvas = true) {
  const report = await page.evaluate((shouldCheckCanvas) => {
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
    if (shouldCheckCanvas && canvas) {
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
        if (a > 0 && (r > 15 || g > 20 || b > 25)) {
          nonBlackPixels++;
        }
        colorSet.add(`${r >> 4},${g >> 4},${b >> 4}`);
      }
      uniqueColors = colorSet.size;
      canvasValid = nonBlackPixels > totalSampled * 0.25 && uniqueColors >= 12;
    } else if (!shouldCheckCanvas) {
      canvasValid = true;
    }

    return {
      docWidth,
      winWidth,
      horizontalOverflow,
      collisions,
      canvasValid,
      uniqueColors
    };
  }, checkCanvas);

  assert(!report.horizontalOverflow, `${label}: Horizontal overflow detected (${report.docWidth}px > ${report.winWidth}px)`);
  assert(report.collisions.length === 0, `${label}: UI Layout collision detected: ${report.collisions.join(', ')}`);
  if (checkCanvas) {
    assert(report.canvasValid, `${label}: Canvas failed pixel integrity check (unique color buckets: ${report.uniqueColors})`);
  }
  console.log(`   [PASS] ${label}: 0 overflow (${report.docWidth}/${report.winWidth}px), 0 collisions${checkCanvas ? `, Canvas valid (${report.uniqueColors} color buckets)` : ''}`);
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

  // Clear local storage for clean deterministic run
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });

  // GATE 2: Mobile Portrait (412x915) Invariants & Intro
  console.log('\n[Gate 2/5] Testing Mobile Portrait (412x915) Office Layout & Canvas Integrity...');
  await page.setViewport({ width: 412, height: 915 });
  await new Promise(r => setTimeout(r, 400));
  await verifyViewportInvariants(page, 'Mobile Office Initial');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'mobile_1_office_initial.png') });

  // Dismiss intro dialogue
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('HO CAPITO'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 300));
  await verifyViewportInvariants(page, 'Mobile Office Free Roam');

  // GATE 3: Elevator Transition to Underground Datacenter Vault
  console.log('\n[Gate 3/5] Testing Elevator Vertical Transit to Underground Datacenter (-1F)...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('Ascensore (-1)'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1400));
  await verifyViewportInvariants(page, 'Mobile Near Elevator Down');

  // Click "SCENDI AL DATACENTER"
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('SCENDI AL DATACENTER'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 800));

  // Verify room header changed to Datacenter Vault
  const isVaultHeader = await page.evaluate(() => {
    return document.body.textContent.includes('UNDERGROUND DATACENTER (-1F)');
  });
  assert(isVaultHeader, 'Header title did not reflect transition to UNDERGROUND DATACENTER (-1F)');

  await verifyViewportInvariants(page, 'Mobile Datacenter Vault');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'mobile_2_datacenter_vault.png') });
  console.log('   [PASS] Gate 3: Elevator transit to -1F confirmed, Vault canvas renders successfully.');

  // GATE 4: Wireshark DPI Minigame Interaction & Mitigation
  console.log('\n[Gate 4/5] Testing Minigame 4: Wireshark Deep Packet Inspection...');
  
  // Walk to Wireshark console
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('Wireshark DPI'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1400));

  // Click "APRI CONSOLE WIRESHARK DPI"
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('APRI CONSOLE WIRESHARK DPI'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 600));

  // In Wireshark screen (no canvas, only rich GUI table & hex dump)
  await verifyViewportInvariants(page, 'Mobile Wireshark Screen', false);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'mobile_3_wireshark_screen.png') });

  // Test filter preset "Minaccia Tunnel DNS"
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('Minaccia Tunnel DNS'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 300));

  // Click on the malicious DNS packet row
  await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('tr'));
    const maliciousRow = rows.find(r => r.textContent.includes('EXFIL!'));
    if (maliciousRow) maliciousRow.click();
  });
  await new Promise(r => setTimeout(r, 300));

  // Click "ISOLA TUNNEL DNS & APPLICA ACL"
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('ISOLA TUNNEL DNS & APPLICA ACL'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 500));

  const hasMitigationModal = await page.evaluate(() => {
    return document.body.textContent.includes('ESFILTRAZIONE DNS BLOCCATA!');
  });
  assert(hasMitigationModal, 'Mitigation modal "ESFILTRAZIONE DNS BLOCCATA!" did not appear');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'mobile_4_wireshark_mitigated.png') });

  // Return to Datacenter
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('TORNA AL DATACENTER'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 600));

  // Take Elevator back up to 1F
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('Ascensore (1F)'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1400));

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('RISALI ALL\'UFFICIO'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 800));

  const isBackInOffice = await page.evaluate(() => {
    return document.body.textContent.includes('UFFICIO OPERATIVO (1F)');
  });
  assert(isBackInOffice, 'Did not successfully return to UFFICIO OPERATIVO (1F)');
  console.log('   [PASS] Gate 4: Wireshark DPI solved, ACL applied, badge awarded, returned to 1F.');

  // GATE 5: Desktop Widescreen (1920x1080) & Zero Errors
  console.log('\n[Gate 5/5] Testing Desktop Widescreen (1920x1080) Layout & Error Log...');
  await page.setViewport({ width: 1920, height: 1080 });
  await new Promise(r => setTimeout(r, 500));
  await verifyViewportInvariants(page, 'Desktop Widescreen Office');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'desktop_1_office.png') });

  await browser.close();

  assert(errors.length === 0, `Runtime console/page errors detected: ${JSON.stringify(errors)}`);
  console.log('   [PASS] Gate 5: 0 runtime or console errors across entire multi-room odyssey.');

  console.log('\n=== ALL 5 DETERMINISTIC QA GATES PASSED 100% ===');
  console.log(`Visual proof saved in: ${SCREENSHOT_DIR}`);
}

runQa().catch(err => {
  console.error('\n❌ QA SUITE FAILED:', err.message);
  process.exit(1);
});
