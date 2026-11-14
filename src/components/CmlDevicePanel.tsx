import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { X } from 'lucide-react';
import { infraBridge, RoomTopology } from '../utils/infraBridge';

/**
 * Console vera di un nodo CML dentro xterm.js: WebSocket verso il backend, che la collega
 * al console server di CML. Ogni tasto parte subito, l'output arriva appena il nodo lo scrive.
 */
export const CmlConsole: React.FC<{ roomId: string; node: string; height?: number }> = ({ roomId, node, height = 300 }) => {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'connecting' | 'open' | 'closed'>('connecting');

  useEffect(() => {
    if (!host.current) return;
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 14,
      theme: { background: '#020617', foreground: '#86efac', cursor: '#86efac' },
      scrollback: 3000,
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
    const ro = new ResizeObserver(() => {
      fit.fit();
      sendSize();
    });
    ro.observe(host.current);
    return () => {
      ro.disconnect();
      sub.dispose();
      ws.close();
      term.dispose();
    };
  }, [roomId, node]);

  return (
    <div className="flex flex-col">
      <div className="text-[10px] text-slate-400 mb-1">
        {state === 'connecting' && `Collegamento alla console di ${node}…`}
        {state === 'open' && `Console di ${node} (CML) · Tab, ? e frecce funzionano come sul dispositivo vero`}
        {state === 'closed' && 'Console chiusa: riapri per riconnetterti.'}
      </div>
      <div
        ref={host}
        style={{ height }}
        className="rounded border border-emerald-700/50 bg-slate-950 p-1"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
};

interface Props {
  roomId: string;
  node: string;
  topology: RoomTopology | null;
  onClose: () => void;
}

/** Postazione (PC o stampante): ci si siede e si usa il suo terminale. */
export const CmlDevicePanel: React.FC<Props> = ({ roomId, node, topology, onClose }) => {
  const device = topology?.devices.find((d) => d.label === node);
  const ready = topology?.status.phase === 'ready' && device?.state === 'BOOTED';
  const nic = device?.interfaces[0];
  const plugged = nic?.connected && nic.link_state === 'STARTED';

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
              {node} · cavo di rete: {!nic?.connected ? 'assente' : plugged ? `collegato a ${nic.peer?.node} ${nic.peer?.iface}` : 'staccato'}
              {device?.jack ? ` · presa a muro ${device.jack.label}` : ''}
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-800" aria-label="Chiudi"><X className="w-4 h-4" /></button>
        </header>
        <div className="p-3">
          {!topology || !device ? (
            <div className="text-slate-300 text-xs">Leggo il lab della stanza…</div>
          ) : ready ? (
            <CmlConsole roomId={roomId} node={node} height={380} />
          ) : (
            <div className="text-amber-300 text-xs">
              La postazione si sta accendendo ({topology.status.message || topology.status.phase}).
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
