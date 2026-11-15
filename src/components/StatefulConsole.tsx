import { consoleKey } from '../utils/consoleKeys';
import { useEffect, useRef, useState } from 'react';

async function consoleApi(path: string, method = 'GET', data?: string) {
  const response = await fetch(`/api/console-session/${path}`, {
    method, headers: { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify({ data }), signal: AbortSignal.timeout(15000),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.detail || 'Console non disponibile');
  return value;
}

/** A single session owns its reader and closes even when creation finishes after unmount. */
export function StatefulConsole({ roomId, node, height = 300, onNetChange }: {
  roomId: string; node: string; height?: number; onNetChange?: () => void;
}) {
  const [session, setSession] = useState('');
  const [output, setOutput] = useState('');
  const [command, setCommand] = useState('');
  const [error, setError] = useState('');
  const [raw, setRaw] = useState(false);
  const currentSession = useRef('');
  const sendQueue = useRef(Promise.resolve());
  const [sending, setSending] = useState(false);
  const screen = useRef<HTMLPreElement>(null);
  useEffect(() => {
    let alive = true;
    let id = '';
    setSession(''); setOutput(''); setError('');
    void (async () => {
      try {
        const created = await consoleApi(`${encodeURIComponent(roomId)}/${encodeURIComponent(node)}`, 'POST');
        id = created.session_id;
        if (!alive) { await consoleApi(id, 'DELETE'); return; }
        currentSession.current = id;
        setSession(id);
        while (alive) {
          const read = await consoleApi(`${id}/read?wait=2`);
          if (alive) setOutput(o => (o + read.output).slice(-60000));
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (e) { if (alive) { currentSession.current = ''; setError(String(e)); setSession(''); } }
    })();
    return () => { alive = false; currentSession.current = ''; if (id) void consoleApi(id, 'DELETE').catch(() => {}); };
  }, [roomId, node]);
  useEffect(() => { if (screen.current) screen.current.scrollTop = screen.current.scrollHeight; }, [output]);
  async function send(data: string) {
    if (!session || sending) return;
    setSending(true); setError('');
    try { await consoleApi(`${session}/send`, 'POST', data); onNetChange?.(); }
    catch (e) { setError(String(e)); }
    finally { setSending(false); }
  }
  function sendRaw(data: string) {
    const id = currentSession.current;
    if (!id) return;
    sendQueue.current = sendQueue.current.then(async () => {
      if (currentSession.current !== id) return;
      try { await consoleApi(`${id}/send`, 'POST', data); }
      catch (e) { if (currentSession.current === id) setError(String(e)); }
    });
  }
  return <div className="space-y-2">
    <p className="text-xs text-cyan-300">{node} · {session ? 'Console collegata' : 'Connessione…'} · sessione persistente IOS / Windows / Alpine</p>
    <div className="flex flex-wrap gap-2">{['show ip interface brief', 'show vlan brief', 'ipconfig /all', 'ip addr', 'ping ', 'tracert ', 'traceroute ', 'copy running-config startup-config'].map(c => <button type="button" className="rounded bg-slate-800 px-2 py-1 text-xs" key={c} onClick={() => { if (raw) sendRaw(c); else setCommand(c); }}>{c}</button>)}</div>
    <p className="text-xs text-slate-400">Completa ping e traceroute con la destinazione. Usa comandi compatibili con il sistema del nodo.</p>
    <pre ref={screen} style={{ height }} className="overflow-auto whitespace-pre-wrap bg-black p-3 text-emerald-300 text-xs">{output || 'In attesa del prompt reale…'}</pre>
    <label className="flex gap-2 text-xs"><input type="checkbox" checked={raw} onChange={e => setRaw(e.target.checked)} />Tastiera diretta · tasti inviati alla console reale</label>
    {raw && <div tabIndex={0} role="textbox" aria-label="Tastiera console diretta" aria-multiline="true" className="rounded border border-cyan-600 p-3 text-xs" onKeyDown={e => {
      const data = consoleKey(e.key, e.ctrlKey, e.altKey, e.metaKey);
      if (data !== null) { e.preventDefault(); e.stopPropagation(); sendRaw(data); }
    }} onPaste={e => { e.preventDefault(); sendRaw(e.clipboardData.getData('text').replace(/\r?\n/g, '\r')); }}>Clicca qui e digita. Tab sposta il focus; il pulsante Tab sotto invia l’autocompletamento. Ctrl+C interrompe il comando.</div>}
    {!raw && <form className="flex gap-2" onSubmit={e => { e.preventDefault(); void send(command + '\r'); setCommand(''); }}>
      <input aria-label="Comando console" className="min-w-0 flex-1 bg-slate-800 rounded p-2" value={command} onChange={e => setCommand(e.target.value)} />
      <button disabled={!session || sending}>Invia</button>
    </form>}
    <div className="flex gap-3">{[['Invio', '\r'], ['Ctrl+C', '\x03'], ['Tab', '\t'], ['?', '?']].map(([label, data]) => <button key={label} disabled={!session || sending} onClick={() => { if (raw) sendRaw(data); else void send(data); }}>{label}</button>)}</div>
    {error && <p role="alert" className="text-amber-300">{error} · Chiudi e riapri per riconnettere.</p>}
  </div>;
}
