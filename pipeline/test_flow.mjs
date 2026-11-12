import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--hide-scrollbars'],
    defaultViewport: { width: 412, height: 915 }
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });

  // 1. Initial Screen
  await page.screenshot({ path: '/tmp/test_1_initial.png' });
  console.log('Saved /tmp/test_1_initial.png');

  // 2. Click "HO CAPITO!"
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('HO CAPITO'));
    if (b) b.click();
  });

  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: '/tmp/test_2_free_roam.png' });
  console.log('Saved /tmp/test_2_free_roam.png');

  // 3. Click [Rack 9300] quick-jump button
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('Rack 9300'));
    if (b) b.click();
  });

  console.log('Clicked Rack 9300 quick navigation button, waiting for walk...');
  await new Promise(r => setTimeout(r, 1600));
  await page.screenshot({ path: '/tmp/test_3_near_rack.png' });
  console.log('Saved /tmp/test_3_near_rack.png');

  // 4. Click [ENTRA NELLA MISSIONE]
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('ENTRA NELLA MISSIONE'));
    if (b) b.click();
  });

  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: '/tmp/test_4_minigame_rack.png' });
  console.log('Saved /tmp/test_4_minigame_rack.png');

  await browser.close();
  console.log('ALL TESTS COMPLETED SUCCESSFULLY!');
}

run().catch(console.error);
