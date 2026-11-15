import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const baseUrl = process.env.COZY_URL || 'http://127.0.0.1:5173';
try {
  const response = await fetch(baseUrl, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
} catch {
  console.error(`Frontend non raggiungibile su ${baseUrl}.`);
  console.error('Avvia in un altro terminale: npm run dev -- --host 127.0.0.1 --port 5173 --strictPort');
  console.error('Lascia quel terminale aperto e rilancia questo test. Se Vite usa un altro indirizzo, imposta COZY_URL. Non serve riavviare il backend.');
  process.exit(1);
}
const candidates = ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', 'firefox'];
let executablePath = process.env.BROWSER_PATH;
if (!executablePath) {
  for (const name of candidates) {
    try {
      const found = execFileSync('which', [name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (found && existsSync(found)) { executablePath = found; break; }
    } catch { /* Try the next installed browser. */ }
  }
}
if (!executablePath || !existsSync(executablePath)) {
  console.error(executablePath
    ? `Browser non trovato: ${executablePath}. BROWSER_PATH deve indicare un eseguibile reale. Prova senza BROWSER_PATH per il rilevamento automatico.`
    : 'Nessun browser trovato. Installa Chromium, Chrome o Firefox, oppure indica il suo eseguibile reale con BROWSER_PATH.');
  process.exit(1);
}
const browserType = process.env.BROWSER_TYPE || (/firefox/i.test(executablePath) ? 'firefox' : 'chrome');
console.log(`Browser: ${executablePath} (${browserType}) · sito: ${baseUrl}`);
let browser;
try {
  browser = await puppeteer.launch({ executablePath, browser: browserType, headless: true });
} catch (error) {
  console.error(`Impossibile avviare ${executablePath}: ${error.message}`);
  process.exit(1);
}
const page = await browser.newPage();
const errors = [];
const apiRequests = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url()); });
async function clickText(text) {
  const button = await page.evaluateHandle(value => [...document.querySelectorAll('button')].find(b => b.textContent.includes(value)), text);
  assert.ok(button.asElement(), `Pulsante: ${text}`);
  await button.asElement().click();
  await button.dispose();
}
try {
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto(baseUrl, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.removeItem('cozy-onboarding-v2-step'));
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('canvas');
  await fs.mkdir('/tmp/cozy-browser', { recursive: true });
  await page.screenshot({ path: '/tmp/cozy-browser/desktop.png', fullPage: true });
  for (const [label, filename] of [['Studio di rete', 'network-studio'], ['Sala collaudi', 'qa-room'], ['Reception', 'reception']]) {
    await clickText(label);
    await new Promise(resolve => setTimeout(resolve, 500));
    await page.screenshot({ path: `/tmp/cozy-browser/${filename}.png`, fullPage: true });
  }
  for (const width of [412, 768, 1920]) {
    await page.setViewport({ width, height: width === 412 ? 915 : 1080 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Overflow ${width}`);
  }
  for (const [index, answer] of [1, 1, 0, 2, 2, 1].entries()) {
    assert.equal(await page.$eval('fieldset', e => e.disabled), true);
    const talk = await page.$('.cozy-mission-card .cozy-inspect');
    await talk.click();
    await clickText('Esamina la postazione');
    await page.waitForFunction(() => !document.querySelector('fieldset').disabled);
    const choices = await page.$$('.cozy-choice');
    await choices[(answer + 1) % 3].click();
    assert.ok(await page.$('.cozy-feedback:not(.is-correct)'));
    await choices[answer].click();
    await page.waitForSelector('.cozy-feedback.is-correct');
    await clickText(index === 5 ? 'Consegna il collaudo' : 'Prossimo incarico');
    await page.waitForFunction(expected => Number(localStorage.getItem('cozy-onboarding-v2-step')) === expected, {}, index + 1);
  }
  await page.waitForSelector('.cozy-finale');
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('.cozy-finale');
  await page.setViewport({ width: 412, height: 915 });
  await page.screenshot({ path: '/tmp/cozy-browser/mobile-complete.png', fullPage: true });
  await clickText('Rigioca la storia');
  await page.waitForSelector('.cozy-choice');
  await clickText('Configurazioni di esempio');
  assert.ok((await page.$eval('.cozy-config pre', e => e.textContent)).includes('\n'));
  await page.$eval('.cozy-practice', element => { element.open = true; });
  await page.type('#practice-command', 'show vlan brief');
  await page.$eval('.cozy-practice form', form => form.requestSubmit());
  await page.waitForFunction(() => document.querySelector('.cozy-practice pre').textContent.includes('Laboratorio'));
  await page.$eval('#practice-command', input => input.focus());
  assert.equal(await page.$eval('#practice-command', input => input === document.activeElement), true);
  assert.deepEqual(apiRequests, [], 'La storia deve restare indipendente da CML');
  assert.deepEqual(errors, [], 'Nessun errore runtime');
  if (process.env.LIVE_TASK_TEST === '1') {
    const { testLiveTasks } = await import('./cozy_live_fixture_test.mjs');
    await testLiveTasks(page);
  }
  console.log('PASS: desktop/mobile, sopralluoghi, errori e correzioni, 6 missioni, salvataggio, replay e isolamento API.');
} finally {
  await browser.close();
}
