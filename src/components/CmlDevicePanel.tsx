import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { X, Cable, TerminalSquare, Plug, Unplug, MoveRight } from 'lucide-react';
import { infraBridge, RoomTopology, RoomTopologyDevice } from '../utils/infraBridge';

interface Props {
  roomId: string;
  node: string;
  topology: RoomTopology | null;
  onTopology: (t: RoomTopology) => void;
  onClose: () => void;
}

/** Console vera del nodo CML (termserv via WebSocket) dentro xterm.js. */
const CmlConsole: React.FC<{ roomId: string; node: string }> = ({ roomId, node }) => {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'connecting' | 'open' | 'closed'>('connecting');

  useEffect(() => {
    if (!host.current) return;
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'VT323, ui-monospace, monospace',
      fontSize: 16,
      theme: { background: '#020617', foreground: '#86efac', cursor: '#86efac' },
      scrollback: 2000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host.current);
    fit.fit();
    const ws = new WebSocket(infraBridge.consoleUrl(roomId, node));
    ws.binaryType = 'arraybuffer';
    const sendSize = () => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
    };
    ws.onopen = () => {
      setState('open');
      sendSize();
      term.focus();
    };
    ws.onmessage = (ev) => {
      term.write(typeof ev.data === 'string' ? ev.data : new Uint8Array(ev.data as ArrayBuffer));
    };
    ws.onclose = () => {
      setState('closed');
      term.write('\r\n\x1b[33m[console chiusa]\x1b[0m\r\n');
    };
    const sub = term.onData((d) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(d);
    });
    const onResize = () => {
      fit.fit();
      sendSize();
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      sub.dispose();
      ws.close();
      term.dispose();
    };
  }, [roomId, node]);

  return (
    <div className="flex flex-col h-full">
      <div className="text-[10px] text-slate-400 mb-1">
        {state === 'connecting' && 'Collegamento alla console del dispositivo…'}
        {state === 'open' && `Console seriale di ${node} (CML). Tab, ? e cronologia funzionano come sul dispositivo vero.`}
        {state === 'closed' && 'Console chiusa: chiudi e riapri il pannello per riconnetterti.'}
      </div>
      <div ref={host} className="flex-1 min-h-[280px] rounded border border-emerald-700/50 bg-slate-950 p-1" />
    </div>
  );
};

/** Cavi del dispositivo: stato reale dei collegamenti CML, stacca/ricollega/sposta. */
const CmlCables: React.FC<{
  roomId: string;
  device: RoomTopologyDevice;
  topology: RoomTopology;
  onTopology: (t: RoomTopology) => void;
}> = ({ roomId, device, topology, onTopology }) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moveFrom, setMoveFrom] = useState<string | null>(null);

  // porte libere degli switch/router della stanza, possibili destinazioni di uno spostamento
  const freePorts = useMemo(() => topology.devices
    .filter((d) => d.kind === 'switch' || d.kind === 'router')
    .flatMap((d) => d.interfaces.filter((i) => !i.connected).map((i) => ({ node: d.label, iface: i.label }))),
  [topology]);

  const run = async (key: string, body: Parameters<typeof infraBridge.cable>[1]) => {
    setBusy(key);
    setError(null);
    const res = await infraBridge.cable(roomId, body);
    setBusy(null);
    if (res.ok && res.topology) onTopology(res.topology);
    else setError(res.error ?? 'operazione non riuscita');
  };

  return (
    <div className="space-y-1 text-xs">
      {error && <div className="text-red-300 bg-red-950/60 border border-red-700 rounded px-2 py-1">{error}</div>}
      {device.interfaces.map((i) => {
        const up = i.connected && i.link_state === 'STARTED';
        const key = `${device.label}:${i.label}`;
        return (
          <div key={i.label} className="flex items-center gap-2 bg-slate-900/80 border border-slate-700 rounded px-2 py-1">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${!i.connected ? 'bg-slate-600' : up ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
            <span className="font-bold text-slate-100 w-24 shrink-0">{i.label}</span>
            <span className="flex-1 text-slate-300 truncate">
              {i.peer ? <>→ {i.peer.node} <span className="text-slate-500">{i.peer.iface}</span>{!up && <span className="text-amber-300"> (staccato)</span>}</> : <span className="text-slate-500">libera</span>}
            </span>
            {i.connected && (
              <>
                <button
                  disabled={!!busy}
                  onClick={() => run(key, { action: up ? 'unplug' : 'plug', node: device.label, iface: i.label })}
                  className="flex items-center gap-1 px-2 py-0.5 rounded border border-slate-600 hover:border-cyan-400 disabled:opacity-40"
                  title={up ? 'Stacca il cavo (il collegamento si spegne in CML)' : 'Ricollega il cavo'}
                >
                  {up ? <Unplug className="w-3 h-3" /> : <Plug className="w-3 h-3" />}
                  {busy === key ? '…' : up ? 'Stacca' : 'Collega'}
                </button>
                <button
                  disabled={!!busy || freePorts.length === 0}
                  onClick={() => setMoveFrom(moveFrom === key ? null : key)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded border border-slate-600 hover:border-cyan-400 disabled:opacity-40"
                  title="Sposta questo capo del cavo su un'altra porta libera"
                >
                  <MoveRight className="w-3 h-3" /> Sposta
                </button>
              </>
            )}
            {moveFrom === key && (
              <select
                autoFocus
                className="bg-slate-950 border border-cyan-500 rounded px-1 py-0.5"
                defaultValue=""
                onChange={(e) => {
                  const [toNode, toIface] = e.target.value.split('|');
                  setMoveFrom(null);
                  if (!i.peer) return;
                  // il capo che si sposta e' quello lato apparato di rete (presa sul pannello),
                  // il dispositivo di questa riga resta collegato all'altro capo
                  const fromIsInfra = device.kind === 'switch' || device.kind === 'router';
                  void run(key, fromIsInfra
                    ? { action: 'move', node: i.peer.node, iface: i.peer.iface, to_node: toNode, to_iface: toIface }
                    : { action: 'move', node: device.label, iface: i.label, to_node: toNode, to_iface: toIface });
                }}
              >
                <option value="" disabled>porta di destinazione…</option>
                {freePorts.map((p) => (
                  <option key={`${p.node}|${p.iface}`} value={`${p.node}|${p.iface}`}>{p.node} {p.iface}</option>
                ))}
              </select>
            )}
          </div>
        );
      })}
    </div>
  );
};

export const CmlDevicePanel: React.FC<Props> = ({ roomId, node, topology, onTopology, onClose }) => {
  const [tab, setTab] = useState<'console' | 'cables'>('console');
  const device = topology?.devices.find((d) => d.label === node);
  const ready = topology?.status.phase === 'ready' && device?.state === 'BOOTED';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[92vh] flex flex-col bg-slate-900 border-2 border-cyan-600/70 rounded-xl shadow-2xl font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">{device?.display ?? node}</div>
            <div className="text-[10px] text-cyan-300">
              {node} · {device?.cml_def} · stato CML: {device?.state ?? 'sconosciuto'} · lab {topology?.lab_title}
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-800" aria-label="Chiudi"><X className="w-4 h-4" /></button>
        </header>
        <nav className="flex gap-1 px-3 pt-2">
          <button onClick={() => setTab('console')} className={`flex items-center gap-1 px-3 py-1 rounded-t text-xs ${tab === 'console' ? 'bg-slate-800 text-emerald-300' : 'text-slate-400'}`}>
            <TerminalSquare className="w-3.5 h-3.5" /> Console
          </button>
          <button onClick={() => setTab('cables')} className={`flex items-center gap-1 px-3 py-1 rounded-t text-xs ${tab === 'cables' ? 'bg-slate-800 text-cyan-300' : 'text-slate-400'}`}>
            <Cable className="w-3.5 h-3.5" /> Cavi
          </button>
        </nav>
        <div className="flex-1 overflow-auto bg-slate-800/60 mx-3 mb-3 rounded-b rounded-tr p-2 min-h-[320px] flex flex-col">
          {!topology || !device ? (
            <div className="text-slate-300 text-xs">Leggo il lab della stanza…</div>
          ) : tab === 'console' ? (
            ready ? <CmlConsole roomId={roomId} node={node} /> : (
              <div className="text-amber-300 text-xs">
                La rete della stanza si sta accendendo ({topology.status.message || topology.status.phase}).
                La console si apre quando il dispositivo è avviato.
              </div>
            )
          ) : (
            <CmlCables roomId={roomId} device={device} topology={topology} onTopology={onTopology} />
          )}
        </div>
      </div>
    </div>
  );
};
