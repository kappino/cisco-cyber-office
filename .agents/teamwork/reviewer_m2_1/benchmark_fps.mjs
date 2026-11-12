import puppeteer from 'puppeteer-core';

async function benchmark() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 800 }
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });

  // Dismiss intro modal
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('HO CAPITO'));
    if (b) b.click();
  });

  await new Promise(r => setTimeout(r, 500));

  // Measure 300 frames (5 seconds at 60 FPS) in Office room
  const officeMetrics = await page.evaluate(async () => {
    return new Promise((resolve) => {
      const frameTimes = [];
      let count = 0;
      let lastTime = performance.now();

      function onFrame(now) {
        frameTimes.push(now - lastTime);
        lastTime = now;
        count++;
        if (count < 300) {
          requestAnimationFrame(onFrame);
        } else {
          const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
          const max = Math.max(...frameTimes);
          const stutters = frameTimes.filter(t => t > 25).length; // >25ms = frame drop (<40fps)
          resolve({ avg, max, stutters, count });
        }
      }
      requestAnimationFrame(onFrame);
    });
  });

  console.log('Office 300-Frame Benchmark:', JSON.stringify(officeMetrics, null, 2));

  // Transit to Datacenter Vault
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
  await new Promise(r => setTimeout(r, 1000));

  // Measure 300 frames in Datacenter Vault room
  const vaultMetrics = await page.evaluate(async () => {
    return new Promise((resolve) => {
      const frameTimes = [];
      let count = 0;
      let lastTime = performance.now();

      function onFrame(now) {
        frameTimes.push(now - lastTime);
        lastTime = now;
        count++;
        if (count < 300) {
          requestAnimationFrame(onFrame);
        } else {
          const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
          const max = Math.max(...frameTimes);
          const stutters = frameTimes.filter(t => t > 25).length;
          resolve({ avg, max, stutters, count });
        }
      }
      requestAnimationFrame(onFrame);
    });
  });

  console.log('Datacenter Vault 300-Frame Benchmark:', JSON.stringify(vaultMetrics, null, 2));

  await browser.close();
}

benchmark().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
