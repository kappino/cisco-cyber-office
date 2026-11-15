import assert from 'node:assert/strict';

/** Contract fixtures only: intercepts every /api call, never touches the real backend. */
export async function testLiveTasks(page) {
  await page.setViewport({ width: 1920, height: 1080 });
  await page.evaluate(() => localStorage.removeItem('fr_console_office'));
  await page.evaluate(() => localStorage.setItem('cozy-onboarding-v2-step', '4'));
  await page.reload({ waitUntil: 'networkidle0' });
  const calls = [];
  let output = 'SW1#';
  let verified = false;
  const iface = label => ({ label, slot: 0, connected: false, link_state: null, peer: null });
  const topology = { room_id: 'office', lab_title: 'TEST FIXTURE', lab_id: 'fixture', status: { room_id: 'office', phase: 'ready', message: '', ready_nodes: 2, total_nodes: 2 }, racks: [{ id: 'r1', label: 'Armadio test', gx: 1.3, gy: 1.3 }], devices: [
    { label: 'SW1', display: 'Switch test', kind: 'switch', cml_def: 'iosvl2', state: 'BOOTED', rack: 'r1', jack: null, game: null, console: true, interfaces: [iface('Ethernet0/0'), iface('Ethernet0/1')] },
    { label: 'PC1', display: 'PC test', kind: 'pc', cml_def: 'alpine', state: 'BOOTED', rack: null, jack: { rack: 'r1', label: 'P01' }, game: { gx: 4, gy: 1 }, console: true, interfaces: [iface('eth0')] },
  ], links: [] };
  await page.setRequestInterception(true);
  const handler = async request => {
    const path = new URL(request.url()).pathname;
    if (!path.startsWith('/api/')) { await request.continue(); return; }
    const payload = request.method() === 'POST' ? await request.fetchPostData() : undefined;
    const body = payload ? JSON.parse(payload) : null;
    calls.push({ path, method: request.method(), body });
    let result = {};
    let status = 200;
    if (path.endsWith('/room-sync')) result = { mode: 'live_cml' };
    else if (path.endsWith('/topology')) result = topology;
    else if (path.endsWith('/ports')) result = { room_id: 'office', ready: true, read_at: Date.now()/1000, ports: { SW1: { _syst: 'green', 'Ethernet0/0': { led: 'amber', status: 'blocking', vlan: '10' }, 'Ethernet0/1': { led: 'green', status: 'connected', vlan: '20' } } } };
    else if (path.endsWith('/cable')) {
      assert.equal(body.action, 'connect');
      assert.ok(body.node && body.iface && body.to_node && body.to_iface);
      const left = topology.devices.find(d => d.label === body.node)?.interfaces.find(i => i.label === body.iface);
      const right = topology.devices.find(d => d.label === body.to_node)?.interfaces.find(i => i.label === body.to_iface);
      assert.ok(left && right);
      Object.assign(left, { connected: true, link_state: 'STARTED', peer: { node: body.to_node, iface: body.to_iface } });
      Object.assign(right, { connected: true, link_state: 'STARTED', peer: { node: body.node, iface: body.iface } });
      topology.links.push({ id: 'fixture-link', state: 'STARTED', a: { node: body.node, iface: body.iface }, b: { node: body.to_node, iface: body.to_iface } });
      result = topology;
    }
    else if (path === '/api/console-session/office/SW1') result = { session_id: 'test-session', room_id: 'office', node: 'SW1' };
    else if (path.endsWith('/test-session/send')) { output += body.data; result = { bytes_written: body.data.length }; }
    else if (path.endsWith('/test-session/read')) { await new Promise(resolve => setTimeout(resolve, 150)); result = { output }; output = ''; }
    else if (path.endsWith('/test-session') && request.method() === 'DELETE') result = { status: 'closed' };
    else if (path.endsWith('/verify')) { result = { room_id: 'office', ok: verified, devices: [{ node: 'SW1', kind: 'switch', ok: verified, missing: [], extra: [], error: null, persistence_ok: verified }], checks: [], took_s: 1 }; verified = true; }
    else { status = 404; result = { detail: `Unexpected fixture request: ${path}` }; }
    await request.respond({ status, contentType: 'application/json', body: JSON.stringify(result) });
  };
  page.on('request', handler);
  const click = async text => {
    const element = await page.evaluateHandle(value => [...document.querySelectorAll('button')].find(b => b.textContent.includes(value)), text);
    assert.ok(element.asElement(), text); await element.asElement().click(); await element.dispose();
  };
  try {
    await click('Reception');
    await click('Apri armadio');
    await page.waitForFunction(() => { const buttons = [...document.querySelectorAll('.live-task-grid button')]; return buttons.length === 4 && buttons.every(b => !b.disabled); });
    await click('Armadio di rete');
    await page.waitForSelector('button[title^="SW1 Ethernet0/0"]');
    await page.click('button[title^="SW1 Ethernet0/0"]');
    await page.click('button[title^="PC1 eth0"]');
    await page.waitForFunction(() => document.querySelector('button[title^="PC1 eth0"]')?.title.includes('SW1'));
    assert.ok(calls.some(c => c.path.endsWith('/cable') && c.body.action === 'connect' && c.body.node === 'SW1' && c.body.to_node === 'PC1'));
    await page.screenshot({ path: '/tmp/cozy-browser/live-patch.png', fullPage: true });
    await page.click('.rack-terminal button');
    await page.click('button[title="Porta console (RJ45 azzurra)"]');
    await page.waitForSelector('.rack-terminal input[aria-label="Comando console"]');
    const bounds = await page.evaluate(() => {
      const rack = document.querySelector('.rack-equipment').getBoundingClientRect();
      const terminal = document.querySelector('.rack-terminal').getBoundingClientRect();
      return { rackRight: rack.right, terminalLeft: terminal.left, overflow: document.documentElement.scrollHeight > innerHeight + 2 };
    });
    assert.ok(bounds.terminalLeft >= bounds.rackRight, 'Console affiancata al rack');
    assert.equal(bounds.overflow, false, 'La pagina non deve scorrere nel banco di rete');
    await page.screenshot({ path: '/tmp/cozy-browser/live-rack-console.png', fullPage: true });
    await page.click('button[aria-label="Chiudi armadio"]');
    await click('Stato delle porte'); await page.waitForSelector('.port-task-grid .led-amber');
    await page.click('.port-task-grid button'); await page.waitForSelector('.port-task-explanation');
    await page.screenshot({ path: '/tmp/cozy-browser/live-diagnosis.png', fullPage: true });
    await click('Terminale'); await page.select('select[aria-label="Nodo CML"]', 'SW1');
    await page.waitForFunction(() => document.querySelector('.live-tasks').textContent.includes('Console collegata'));
    await page.type('input[aria-label="Comando console"]', 'show vlan brief');
    await page.$eval('.live-tasks form', form => form.requestSubmit());
    await page.waitForFunction(() => document.querySelector('.live-tasks pre').textContent.includes('show vlan brief'));
    await page.click('.live-tasks input[type="checkbox"]');
    await page.click('[aria-label="Tastiera console diretta"]');
    await page.keyboard.type('show');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.down('Control'); await page.keyboard.press('c'); await page.keyboard.up('Control');
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline && !calls.filter(c => c.path.endsWith('/send')).map(c => c.body.data).join('').includes('show\x1b[A\x03')) await new Promise(resolve => setTimeout(resolve, 50));
    const rawSent = calls.filter(c => c.path.endsWith('/send')).map(c => c.body.data).join('');
    assert.ok(rawSent.includes('show\x1b[A\x03'), 'Ordine tasti e controlli terminale');
    await page.screenshot({ path: '/tmp/cozy-browser/live-console.png', fullPage: true });
    await click('Collaudo');
    await page.waitForFunction(() => document.querySelector('.live-verification')?.textContent.includes('Qualcosa manca'));
    await click('Collaudo');
    await page.waitForFunction(() => document.querySelector('.live-verification')?.textContent.includes('collaudo superato'));
    await page.click('button[aria-label="Chiudi laboratorio"]');
    assert.ok(calls.some(c => c.path.endsWith('/test-session') && c.method === 'DELETE'));
    assert.ok(calls.some(c => c.path.endsWith('/send') && c.body.data === 'show vlan brief\r'));
    await page.screenshot({ path: '/tmp/cozy-browser/live-fixture-complete.png', fullPage: true });
    console.log('PASS fixture API: attivazione, LED ambra, sessione/send/read/DELETE, verifica negativa e positiva. Non è un test CML reale.');
  } finally { page.off('request', handler); await page.setRequestInterception(false); }
}
