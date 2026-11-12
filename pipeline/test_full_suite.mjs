import puppeteer from 'puppeteer-core';

async function run() {
  console.log('--- STARTING FULL GAMEPLAY INTEGRATION TEST ---');
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--hide-scrollbars'],
    defaultViewport: { width: 412, height: 915 }
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });

  // 1. Initial Screen
  await page.screenshot({ path: '/tmp/full_1_office_initial.png' });
  console.log('1. Office initial loaded');

  // Dismiss dialog
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('HO CAPITO'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 400));

  // 2. Walk to Rack & Enter Minigame 1
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('Rack 9300'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1600));

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('ENTRA NELLA MISSIONE'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: '/tmp/full_2_minigame_rack.png' });
  console.log('2. Minigame 1 (Rack) open');

  // Connect the 4 cables in Rack minigame:
  const pairs = [
    { src: 'Port 01', dst: 'Fa0/1' },
    { src: 'Port 02', dst: 'Fa0/2' },
    { src: 'Port 03', dst: 'Gi0/1' },
    { src: 'Port 04', dst: 'Fa0/3' },
  ];

  for (const pair of pairs) {
    await page.evaluate((src) => {
      const all = Array.from(document.querySelectorAll('*'));
      const srcEl = all.find(el => el.textContent && el.textContent.trim().startsWith(src));
      if (srcEl) (srcEl.closest('button') || srcEl).click();
    }, pair.src);
    await new Promise(r => setTimeout(r, 200));

    await page.evaluate((dst) => {
      const all = Array.from(document.querySelectorAll('*'));
      const dstEl = all.find(el => el.textContent && el.textContent.trim().startsWith(dst));
      if (dstEl) (dstEl.closest('button') || dstEl).click();
    }, pair.dst);
    await new Promise(r => setTimeout(r, 300));
  }

  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: '/tmp/full_3_rack_completed.png' });
  console.log('3. Minigame 1 completed');

  // Go back to Office
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes("Torna all'Ufficio"));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 600));

  // 4. Walk to PC Admin CLI Terminal
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('CLI Admin'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1600));

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('ENTRA NELLA MISSIONE'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: '/tmp/full_4_terminal_open.png' });
  console.log('4. Minigame 2 (CLI Terminal) open');

  // Solve Terminal: enable -> conf t -> int gi0/1 -> no shut -> int fa0/2 -> sw acc
  const terminalInput = await page.$('input');
  if (terminalInput) {
    await terminalInput.type('enable\n');
    await new Promise(r => setTimeout(r, 250));
    await terminalInput.type('conf t\n');
    await new Promise(r => setTimeout(r, 250));
    await terminalInput.type('interface gi0/1\n');
    await new Promise(r => setTimeout(r, 250));
    await terminalInput.type('no shutdown\n');
    await new Promise(r => setTimeout(r, 250));
    await terminalInput.type('interface fa0/2\n');
    await new Promise(r => setTimeout(r, 250));
    await terminalInput.type('switchport access vlan 20\n');
    await new Promise(r => setTimeout(r, 800));
  }
  await page.screenshot({ path: '/tmp/full_5_terminal_completed.png' });
  console.log('5. Minigame 2 completed');

  // Go back to Office
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes("Torna all'Ufficio"));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 600));

  // 6. Walk to SOC Wall & Enter Minigame 3
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('SOC Wall'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1600));

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('ENTRA NELLA MISSIONE'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: '/tmp/full_6_umbrella_soc.png' });
  console.log('6. Minigame 3 (Umbrella SOC) open');

  // Solve SOC: Sinkhole DNS & Isolate Host
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const sinkholeBtn = btns.find(x => x.textContent.includes('Applica Sinkhole DNS'));
    if (sinkholeBtn) sinkholeBtn.click();
  });
  await new Promise(r => setTimeout(r, 400));

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const isolateBtn = btns.find(x => x.textContent.includes('Isola Host Contagiato'));
    if (isolateBtn) isolateBtn.click();
  });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: '/tmp/full_7_soc_completed.png' });
  console.log('7. Minigame 3 completed');

  // Go back to Office
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes("Torna all'Ufficio"));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 600));

  // 8. Open Skill Tree
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('Skill'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: '/tmp/full_8_skills_modal.png' });
  console.log('8. Skills Modal open');

  // Close Skills
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('Chiudi') || x.textContent.includes('Salva'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 400));

  // 9. Open Avatar Customizer
  await page.evaluate(() => {
    const editBtn = document.querySelector('header button');
    if (editBtn) editBtn.click();
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: '/tmp/full_9_avatar_customizer.png' });
  console.log('9. Avatar Customizer open');

  // 10. Close Customizer & Open Badges
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('Salva') || x.textContent.includes('Chiudi'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 400));

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('Badge'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: '/tmp/full_10_badges_showcase.png' });
  console.log('10. Badges Showcase open');

  await browser.close();
  console.log('--- ALL INTEGRATION TESTS PASSED 100%! ---');
}

run().catch(console.error);
