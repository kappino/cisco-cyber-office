// No activation or config commands. Optional CML_NODE opens a console and sends Enter.
const base = process.env.CML_API_URL || 'http://127.0.0.1:8000';
async function get(path) {
  const response = await fetch(`${base}/api/${path}`, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}
try {
  const rooms = await get('rooms');
  console.log('Backend raggiungibile. Stanza attiva:', rooms.active || 'nessuna');
  const room = process.env.CML_ROOM || rooms.active;
  if (!room) { console.log('Nessun lab attivo: la sonda non ne accende uno.'); process.exit(0); }
  const topology = await get(`room/${encodeURIComponent(room)}/topology`);
  console.log('Stato:', topology.status.phase, '·', topology.status.message);
  console.log('Nodi:', topology.devices.map(d => `${d.label} (${d.cml_def}, ${d.state}, console=${d.console})`).join(', '));
  console.log('Armadi:', topology.racks.map(r => r.label).join(', '));
  if (topology.status.phase !== 'ready') { console.log('Lab non pronto: prova console e collegamenti ancora da eseguire.'); process.exit(0); }
  const ports = await get(`room/${encodeURIComponent(room)}/ports`);
  for (const [node, values] of Object.entries(ports.ports || {})) {
    console.log(node, values._stale ? '(lettura obsoleta)' : '', Object.entries(values).filter(([,v]) => v && typeof v === 'object' && 'led' in v).map(([iface,v]) => `${iface}: ${v.led}, ${v.status}, VLAN ${v.vlan}`).join(' | '));
  }
  if (process.env.CML_NODE) {
    const node = topology.devices.find(d => d.label === process.env.CML_NODE && d.console);
    if (!node) throw new Error('CML_NODE non identifica un nodo con console nella stanza selezionata');
    const path = `/api/console-session/${encodeURIComponent(room)}/${encodeURIComponent(node.label)}`;
    let sessionId;
    try {
      const response = await fetch(base + path, { method: 'POST', signal: AbortSignal.timeout(30000) });
      const data = await response.json();
      if (!response.ok || !data.session_id) throw new Error(data.detail || 'Creazione sessione fallita');
      sessionId = data.session_id;
      const first = await get(`console-session/${encodeURIComponent(sessionId)}/read?wait=2`);
      console.log('Console aperta:', node.label, '· byte letti:', String(first.output || '').length);
      const sent = await fetch(`${base}/api/console-session/${encodeURIComponent(sessionId)}/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: '\r' }), signal: AbortSignal.timeout(10000),
      });
      if (!sent.ok) throw new Error(`Invio Invio: HTTP ${sent.status}`);
      const second = await get(`console-session/${encodeURIComponent(sessionId)}/read?wait=2`);
      console.log('Invio inoltrato. Risposta:', JSON.stringify(String(second.output || '').slice(-200)));
      if (!first.output && !second.output) throw new Error('Sessione aperta ma nessun output: prova console non confermata');
      console.log('PASS: creazione, lettura e invio sul nodo reale. Nessun comando di configurazione inviato.');
    } finally {
      if (sessionId) {
        const closed = await fetch(`${base}/api/console-session/${encodeURIComponent(sessionId)}`, { method: 'DELETE', signal: AbortSignal.timeout(10000) });
        if (!closed.ok) throw new Error(`Chiusura console: HTTP ${closed.status}`);
        console.log('Sessione console chiusa.');
      }
    }
  }
  console.log('Sonda completata. Le mutazioni dei cavi restano da provare separatamente.');
} catch (error) { console.error('Sonda non completata:', error.message); process.exitCode = 1; }
