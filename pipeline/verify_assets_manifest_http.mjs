#!/usr/bin/env node
/**
 * pipeline/verify_assets_manifest_http.mjs
 * 
 * Adversarial Challenger M1-2 Asset Verification Harness
 * Tests loading every asset in public/assets/manifest.json via HTTP in Chromium:
 * 1. HTTP status === 200
 * 2. Content-Type is image/png (or application/json for manifest)
 * 3. naturalWidth > 0 and naturalHeight > 0
 * 4. Dimensional conformance against manifest specifications
 * 5. Canvas rendering and non-tainted pixel readout
 * 6. Adversarial negative testing on non-existent assets
 */

import puppeteer from 'puppeteer-core';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';

const CHROMIUM_PATH = '/usr/bin/chromium';
const PORT = 5173;
const BASE_URL = `http://localhost:${PORT}`;
const PROJECT_ROOT = path.resolve(process.cwd());

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function isServerRunning(url) {
  return new Promise(resolve => {
    const req = http.get(url, res => {
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensureServer() {
  const running = await isServerRunning(BASE_URL);
  if (running) {
    console.log(`[INFO] Server already running at ${BASE_URL}`);
    return null;
  }

  console.log(`[INFO] Spawning Vite preview server on port ${PORT}...`);
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: PROJECT_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false
  });

  server.stdout.on('data', d => {
    const out = d.toString();
    if (out.includes('Local:')) {
      console.log(`[Vite stdout] ${out.trim()}`);
    }
  });

  server.stderr.on('data', d => {
    console.error(`[Vite stderr] ${d.toString().trim()}`);
  });

  // Wait for server to start
  const startTime = Date.now();
  while (Date.now() - startTime < 15000) {
    if (await isServerRunning(BASE_URL)) {
      console.log(`[INFO] Vite preview server is ready at ${BASE_URL}`);
      return server;
    }
    await wait(300);
  }

  server.kill('SIGTERM');
  throw new Error(`Timeout waiting for Vite preview server at ${BASE_URL}`);
}

async function main() {
  console.log('===============================================================');
  console.log('   M1-2 ADVERSARIAL ASSET HTTP & CHROMIUM VERIFICATION SUITE   ');
  console.log('===============================================================');

  let serverProcess = null;
  let browser = null;

  try {
    serverProcess = await ensureServer();

    console.log(`[INFO] Launching Chromium from ${CHROMIUM_PATH}...`);
    browser = await puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--allow-insecure-localhost'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    // Collect network responses
    const responses = new Map();
    page.on('response', response => {
      responses.set(response.url(), {
        status: response.status(),
        contentType: response.headers()['content-type'] || '',
        contentLength: response.headers()['content-length'] || ''
      });
    });

    console.log(`[INFO] Navigating to ${BASE_URL}...`);
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });

    // Step 1: Verify Manifest JSON via HTTP
    console.log('\n--- STEP 1: Verifying public/assets/manifest.json via HTTP ---');
    const manifestHttpResult = await page.evaluate(async (url) => {
      try {
        const resp = await fetch(url);
        const text = await resp.text();
        const json = JSON.parse(text);
        return {
          ok: resp.ok,
          status: resp.status,
          contentType: resp.headers.get('content-type'),
          assetCount: json.assets ? json.assets.length : 0,
          paletteCount: json.palette ? json.palette.length : 0,
          charactersCount: json.characters ? Object.keys(json.characters).length : 0,
          portraitsCount: json.portraits ? Object.keys(json.portraits).length : 0,
          environmentCount: json.environment ? Object.keys(json.environment).length : 0,
          manifestJson: json
        };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    }, `${BASE_URL}/assets/manifest.json`);

    if (!manifestHttpResult.ok) {
      throw new Error(`Failed to load manifest.json via HTTP: status ${manifestHttpResult.status}, error: ${manifestHttpResult.error}`);
    }

    console.log(`✔ manifest.json HTTP Status: ${manifestHttpResult.status}`);
    console.log(`✔ manifest.json Content-Type: ${manifestHttpResult.contentType}`);
    if (!manifestHttpResult.contentType.includes('application/json')) {
      throw new Error(`manifest.json Content-Type expected 'application/json', got '${manifestHttpResult.contentType}'`);
    }

    const manifestData = manifestHttpResult.manifestJson;
    console.log(`✔ Assets catalogued in manifest: ${manifestHttpResult.assetCount}`);
    console.log(`✔ Characters catalogued: ${manifestHttpResult.charactersCount}`);
    console.log(`✔ Portrait character groups: ${manifestHttpResult.portraitsCount}`);
    console.log(`✔ Environment entries: ${manifestHttpResult.environmentCount}`);

    // Step 2: Verify Every Asset via HTTP and in Chromium DOM
    console.log('\n--- STEP 2: Testing Every Asset via HTTP in Chromium ---');
    const assetsToTest = manifestData.assets;
    if (!assetsToTest || assetsToTest.length === 0) {
      throw new Error('No assets found in manifest.assets array');
    }

    let passedAssets = 0;
    let failedAssets = [];

    for (const asset of assetsToTest) {
      const fullUrl = `${BASE_URL}${asset.url}`;

      // In Chromium DOM: fetch HTTP headers AND load HTMLImageElement
      const testResult = await page.evaluate(async (url, expectedWidth, expectedHeight) => {
        try {
          // 1. HTTP fetch test
          const resp = await fetch(url);
          const status = resp.status;
          const contentType = resp.headers.get('content-type') || '';
          const blob = await resp.blob();
          const byteSize = blob.size;

          if (status !== 200) {
            return { ok: false, status, contentType, error: `HTTP status was ${status}` };
          }

          if (!contentType.includes('image/png')) {
            return { ok: false, status, contentType, error: `Content-Type was '${contentType}', expected 'image/png'` };
          }

          if (byteSize === 0) {
            return { ok: false, status, contentType, error: 'Asset blob size is 0 bytes' };
          }

          // 2. DOM Image element test
          const imgLoadResult = await new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              // Canvas draw test to confirm valid pixel bitmap
              try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const pixelData = ctx.getImageData(0, 0, Math.min(img.naturalWidth, 10), Math.min(img.naturalHeight, 10));
                
                resolve({
                  loaded: true,
                  naturalWidth: img.naturalWidth,
                  naturalHeight: img.naturalHeight,
                  canvasWritable: pixelData.data.length > 0
                });
              } catch (drawErr) {
                resolve({
                  loaded: true,
                  naturalWidth: img.naturalWidth,
                  naturalHeight: img.naturalHeight,
                  canvasWritable: false,
                  canvasError: drawErr.message
                });
              }
            };
            img.onerror = () => {
              resolve({
                loaded: false,
                naturalWidth: img.naturalWidth,
                naturalHeight: img.naturalHeight,
                error: 'HTMLImageElement onerror fired'
              });
            };
            img.src = url;
          });

          if (!imgLoadResult.loaded) {
            return { ok: false, status, contentType, error: imgLoadResult.error };
          }

          if (imgLoadResult.naturalWidth <= 0 || imgLoadResult.naturalHeight <= 0) {
            return { ok: false, status, contentType, error: `Invalid natural dimensions: ${imgLoadResult.naturalWidth}x${imgLoadResult.naturalHeight}` };
          }

          if (expectedWidth && imgLoadResult.naturalWidth !== expectedWidth) {
            return { ok: false, status, contentType, error: `Width mismatch: got ${imgLoadResult.naturalWidth}, expected ${expectedWidth}` };
          }

          if (expectedHeight && imgLoadResult.naturalHeight !== expectedHeight) {
            return { ok: false, status, contentType, error: `Height mismatch: got ${imgLoadResult.naturalHeight}, expected ${expectedHeight}` };
          }

          return {
            ok: true,
            status,
            contentType,
            byteSize,
            naturalWidth: imgLoadResult.naturalWidth,
            naturalHeight: imgLoadResult.naturalHeight,
            canvasWritable: imgLoadResult.canvasWritable
          };
        } catch (err) {
          return { ok: false, error: err.message };
        }
      }, fullUrl, asset.width, asset.height);

      if (testResult.ok) {
        passedAssets++;
        console.log(`[PASS] ${asset.key.padEnd(30)} [${testResult.status}] Content-Type: ${testResult.contentType.padEnd(10)} ${testResult.naturalWidth}x${testResult.naturalHeight}px (${testResult.byteSize} bytes)`);
      } else {
        failedAssets.push({ asset: asset.key, url: asset.url, ...testResult });
        console.error(`[FAIL] ${asset.key.padEnd(30)} URL: ${asset.url} -> Error: ${testResult.error}`);
      }
    }

    // Step 3: Adversarial Negative Tests
    console.log('\n--- STEP 3: Adversarial Negative Tests (Corrupted / Non-Existent Assets) ---');
    const negativeTestResult = await page.evaluate(async (fakeUrl) => {
      // 1. Fetch fake URL
      const resp = await fetch(fakeUrl);
      const is404orHtml = resp.status === 404 || (resp.headers.get('content-type') || '').includes('text/html');

      // 2. Try loading in Image
      const imgResult = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ loaded: true, naturalWidth: img.naturalWidth });
        img.onerror = () => resolve({ loaded: false, naturalWidth: img.naturalWidth });
        img.src = fakeUrl;
      });

      return {
        fetchStatus: resp.status,
        is404orHtml,
        imgLoaded: imgResult.loaded,
        naturalWidth: imgResult.naturalWidth
      };
    }, `${BASE_URL}/assets/characters/non_existent_fake_character.png`);

    console.log(`✔ Fake asset fetch status: ${negativeTestResult.fetchStatus} (HTML fallback or 404 handled: ${negativeTestResult.is404orHtml})`);
    console.log(`✔ Fake asset Image element load failed as expected: imgLoaded=${negativeTestResult.imgLoaded}, naturalWidth=${negativeTestResult.naturalWidth}`);

    if (negativeTestResult.imgLoaded && negativeTestResult.naturalWidth > 0) {
      throw new Error('Adversarial check failed: Non-existent asset somehow decoded with naturalWidth > 0!');
    }

    // Step 4: Summary & Assertion
    console.log('\n===============================================================');
    console.log(`Total Manifest Assets Tested: ${assetsToTest.length}`);
    console.log(`Passed: ${passedAssets} / ${assetsToTest.length}`);
    console.log(`Failed: ${failedAssets.length} / ${assetsToTest.length}`);
    console.log('===============================================================');

    if (failedAssets.length > 0) {
      console.error('\nFAILURES SUMMARY:');
      for (const f of failedAssets) {
        console.error(` - ${f.asset} (${f.url}): ${f.error}`);
      }
      process.exit(1);
    }

    console.log('\n✔ ALL ASSET INTEGRITY AND HTTP CHECKS PASSED EMPIRICALLY!');
    process.exit(0);

  } catch (err) {
    console.error('\n[FATAL ERROR]', err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    if (serverProcess) {
      console.log('[INFO] Shutting down spawned Vite preview server...');
      serverProcess.kill('SIGTERM');
    }
  }
}

main();
