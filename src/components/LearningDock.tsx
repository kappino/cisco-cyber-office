import { StatefulConsole } from './StatefulConsole';
import { useEffect, useState } from 'react';
import { EventBus } from '../game/EventBus';

type Data = Record<string, unknown>;
const labels: Record<string, string> = { devices: 'Dispositivi', checks: 'Controlli funzionali', missing: 'Configurazione mancante', extra: 'Configurazione in eccesso', node: 'Nodo', from: 'Origine', label: 'Controllo', detail: 'Dettaglio', hint: 'Indizio', hints: 'Indizi', device: 'Dispositivo', section: 'Sezione', line: 'Comando', ok: 'Esito', error: 'Errore', summary: 'Riepilogo', signature: 'Segnalazione', severity: 'Gravità', status: 'Stato', title: 'Titolo', acl_ok: 'Ordine ACL', persistence_ok: 'Persistenza startup-config', ssh_telnet_ok: 'Accesso remoto', took_s: 'Durata (secondi)', startup_missing: 'Comandi non salvati', startup_extra: 'Comandi salvati in eccesso' };

async function api(path: string, method = 'GET', body?: unknown): Promise<Data> {
  const response = await fetch(`/api/${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(path === 'rooms' ? 5000 : 90000) });
  const data = await response.json();
  if (!response.ok) throw new Error(String(data.detail || response.statusText));
  return data;
}
function Evidence({ value }: { value: unknown }) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value) && !value.length) return <span className="text-slate-400">Nessuna voce</span>;
  if (Array.isArray(value)) return <ul className="space-y-2">{value.map((v, i) => <li key={i} className="border-l-2 border-cyan-700 pl-2"><Evidence value={v} /></li>)}</ul>;
  if (typeof value === 'object') return <dl>{Object.entries(value).map(([k, v]) => <div key={k}><dt className="text-cyan-300 inline">{labels[k] || k}: </dt><dd className="inline"><Evidence value={v} /></dd></div>)}</dl>;
  return <span className="whitespace-pre-wrap break-words">{typeof value === 'boolean' ? value ? 'Superato' : 'Da sistemare' : String(value)}</span>;
}
export function LearningDock({ roomId }: { roomId: string }) {
  const [nodes, setNodes] = useState<string[]>([]);
  const [node, setNode] = useState('');
  const [session, setSession] = useState('');
  
  
  const [result, setResult] = useState<Data | null>(null);
  const [soc, setSoc] = useState<Data | null>(null);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [level, setLevel] = useState(1);
  const [colleague, setColleague] = useState('Alessia');
  useEffect(() => () => { EventBus.emit('SET_INPUT_ENABLED', true); }, []);
  useEffect(() => {
    const select = (name: string) => setColleague(name);
    EventBus.on('LEARNING_COLLEAGUE', select);
    return () => { EventBus.off('LEARNING_COLLEAGUE', select); };
  }, []);
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const rooms = await api('rooms');
        if (!alive) return;
        const room = (rooms.rooms as { room_id: string; nodes: string[] }[]).find(r => r.room_id === roomId);
        setNodes(room?.nodes || []); setOffline(false);
      } catch { if (alive) setOffline(true); }
      try { const alerts = await api('soc/alerts'); if (alive) setSoc(alerts); } catch { /* independent SOC availability */ }
    };
    setNode(''); setResult(null); setLevel(1);
    void poll(); const timer = setInterval(() => void poll(), 15000);
    return () => { alive = false; clearInterval(timer); };
  }, [roomId]);
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await action(); } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };
  const roomAction = (action: string, method = 'GET') => run(async () => {
    const data = await api(`room/${roomId}/${action}`, method, method === 'POST' ? {} : undefined);
    setResult(data);
    if (action === 'verify' && data.ok === true) EventBus.emit('TRIGGER_CELEBRATION');
    if (action === 'reload') { setSession(''); setLevel(1); }
  });
  const speech: Record<string, string> = {
    Alessia: 'Benvenuto! Qui si impara una porta alla volta. Scegli un nodo del laboratorio: i comandi agiscono sulla rete vera.',
    Luca: 'Prima osserva, poi cambia una cosa alla volta. Access assegna una VLAN; trunk trasporta più VLAN con tag 802.1Q. Il caffè purtroppo non risolve il tagging.',
    Gaia: 'Il ping è un inizio! Controlliamo anche configurazione, ordine ACL e salvataggio: copy running-config startup-config conserva il lavoro al riavvio. Leggi ogni esito prima di riprovare.',
    Davide: 'Ho uno scherzo da laboratorio: un guasto vero, recuperabile. Allenamento opzionale: osserva porte, VLAN e rotte prima di cambiare comandi.',
  };
  return <section onFocusCapture={() => EventBus.emit('SET_INPUT_ENABLED', false)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget)) EventBus.emit('SET_INPUT_ENABLED', true); }} className="learning-dock rounded-xl border border-cyan-800 bg-slate-900 p-4 space-y-3 text-sm" aria-label="Laboratorio didattico">
    <div><strong className="text-cyan-300">Cosa stai imparando oggi</strong><p>{roomId === 'office' ? 'VLAN & Access Port · CLI Windows vs Cisco IOS' : roomId === 'corridor' ? 'Trunk 802.1Q · VLAN & stato delle porte' : 'Routing & ACL · Traceroute & persistenza'}</p></div>
    {offline && <p role="status" className="text-amber-300">Backend non raggiungibile. Puoi esplorare l’ufficio; il laboratorio riprova automaticamente.</p>}
    <div className="flex flex-wrap gap-2">{Object.keys(speech).map(name => <button className="rounded bg-slate-700 px-3 py-2" key={name} onClick={() => setColleague(name)}>{name} · {({ Alessia: 'Reception', Luca: 'Network Mentor', Gaia: 'QA/Collaudi', Davide: 'Red Team' } as Record<string, string>)[name]} {name === 'Luca' ? '?' : '!'}</button>)}</div>
    <p aria-live="polite"><strong>{colleague} — </strong>{speech[colleague]}</p>
    <div className="flex flex-wrap gap-2">
      <button disabled={busy} onClick={() => void run(async () => { setResult(await api(`room/${roomId}/hint?level=${level}`)); setLevel(Math.min(3, level + 1)); })}>Chiedi un indizio · {level} ({['concetto', 'interfaccia', 'comando'][level - 1]})</button>
      <button disabled={busy} onClick={() => void roomAction('verify')}>Gaia: collaudo reale</button>
      <button disabled={busy} onClick={() => { if (window.confirm('Ripristinare da zero la stanza CML? La running-config verrà ricaricata dalla startup-config salvata.')) void roomAction('reload', 'POST'); }}>Ricomincia stanza da zero</button>
      <button disabled={busy} onClick={() => void roomAction('inject-fault', 'POST')}>Allenamento: scherzo di Davide</button>
    </div>
    {busy && <p role="status">Il laboratorio sta lavorando…</p>}{error && <p role="alert" className="text-amber-300">{error}</p>}
    {result && <div aria-live="polite" className="p-3 bg-slate-950 rounded max-h-80 overflow-auto">{result.ok === true && <p className="text-emerald-300 font-bold">Missione superata! Hai confrontato stato reale e obiettivo: diagnosi, correzione, verifica e persistenza rendono una rete affidabile.</p>}{Array.isArray(result.hints) && result.hints.length === 0 && <p>Nessun indizio disponibile: attendi che la stanza sia pronta o chiedi a Gaia un collaudo.</p>}<Evidence value={result} /><p className="mt-2 text-cyan-200">Perché funziona: confrontare VLAN, interfacce e rotte con il percorso atteso permette di isolare il livello del guasto. Le ACL sono valutate in ordine: la prima corrispondenza decide.</p></div>}
    <details><summary className="cursor-pointer text-cyan-300">Laptop · console stateful IOS / Windows / Alpine</summary>
      <div className="flex flex-wrap gap-2 my-2"><select aria-label="Nodo della stanza" className="bg-slate-800 p-2" value={node} onChange={e => { setSession(''); setNode(e.target.value); }}><option value="">Scegli nodo</option>{nodes.map(n => <option key={n}>{n}</option>)}</select>
      <button disabled={!node || busy || !!session} onClick={() => void run(async () => { setSession(node); })}>Connetti</button><button onClick={() => setSession('')}>Chiudi sessione</button></div>
      {session && <StatefulConsole roomId={roomId} node={node} />}
    </details>
    <details><summary>Notifiche SOC aziendali · {String(soc?.mode || 'in attesa')}</summary><Evidence value={soc?.alerts || 'Nessun dato SOC disponibile'} /></details>
  </section>;
}
