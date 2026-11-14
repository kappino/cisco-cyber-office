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
export const CmlConsole: React.FC<{ roomId: string; node: string; height?: number; onNetChange?: () => void }> = ({
  roomId, node, height = 300, onNetChange,
}) => {
  const host = useRef<HTMLDivElement>(null);
  const onNetChangeRef = useRef(onNetChange);
  onNetChangeRef.current = onNetChange;
  const [state, setState] = useState<'connecting' | 'open' | 'closed'>('connecting');
  const [lock, setLock] = useState<string | null>(null);

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
    let disposed = false;
    // fit() puo' fallire se il renderer non e' pronto o il terminale e' gia' chiuso
    const safeFit = () => { if (!disposed) { try { fit.fit(); } catch { /* renderer non pronto */ } } };
    safeFit();
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
    // Blocco silenzioso (lettura dei LED): il terminale resta vivo con un'eco locale; i tasti
    // vengono messi da parte e inviati allo sblocco. `echoed` e' gia' sullo schermo (il backend lo
    // manda al dispositivo con l'eco nascosta), `raw` contiene i tasti da Tab/?/Invio/frecce in poi.
    let silentLock = false;
    let echoed = '';
    let raw = '';
    ws.onmessage = (ev) => {
      if (typeof ev.data === 'string' && ev.data.startsWith('{"type":')) {
        try {
          const msg = JSON.parse(ev.data) as { type: string; on?: boolean; reason?: string; silent?: boolean };
          if (msg.type === 'lock' && msg.silent) {
            silentLock = !!msg.on;
            if (!msg.on && (echoed || raw) && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'replay', echoed, raw }));
            }
            if (!msg.on) { echoed = ''; raw = ''; }
          } else if (msg.type === 'lock') {
            // blocco visibile (Verifica): avviso sopra il terminale, tastiera disattivata
            setLock(msg.on ? msg.reason || 'Operazione in corso' : null);
            term.options.disableStdin = !!msg.on;
            if (!msg.on) term.focus();
          } else if (msg.type === 'changed') {
            onNetChangeRef.current?.();  // comando di configurazione: i LED vanno riletti
          }
        } catch { /* non era un messaggio di controllo */ }
        return;
      }
      term.write(typeof ev.data === 'string' ? ev.data : new Uint8Array(ev.data as ArrayBuffer));
    };
    ws.onclose = () => {
      setState('closed');
      term.write('\r\n\x1b[33m[console chiusa]\x1b[0m\r\n');
    };
    const sub = term.onData((d) => {
      if (silentLock) {
        for (const ch of d) {
          const printable = ch >= ' ' && ch !== '\x7f' && ch !== '?';
          if (!raw && printable) {
            echoed += ch;
            term.write(ch);
          } else if (!raw && ch === '\x7f' && echoed) {
            echoed = echoed.slice(0, -1);
            term.write('\b \b');
          } else {
            raw += ch;
          }
        }
        return;
      }
      if (ws.readyState === WebSocket.OPEN) ws.send(d);
    });
    const ro = new ResizeObserver(() => {
      safeFit();
      sendSize();
    });
    ro.observe(host.current);
    return () => {
      disposed = true;
      ro.disconnect();
      sub.dispose();
      ws.close();
      // xterm 5.5 ha timer interni che scattano dopo dispose(): si chiude un attimo dopo
      setTimeout(() => term.dispose(), 200);
    };
  }, [roomId, node]);

  return (
    <div className="flex flex-col">
      <div className="text-[10px] text-slate-400 mb-1">
        {state === 'connecting' && `Collegamento alla console di ${node}…`}
        {state === 'open' && `Console di ${node} (CML) · Tab, ? e frecce funzionano come sul dispositivo vero`}
        {state === 'closed' && 'Console chiusa: riapri per riconnetterti.'}
      </div>
      <div className="relative">
        <div
          ref={host}
          style={{ height }}
          className={`rounded border bg-slate-950 p-1 ${lock ? 'border-amber-500/70 opacity-40' : 'border-emerald-700/50'}`}
          onClick={(e) => e.stopPropagation()}
        />
        {lock && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="px-3 py-2 rounded-lg bg-slate-900/95 border border-amber-500 text-amber-200 text-xs font-mono">
              {lock}: il terminale riprende appena finisce
            </div>
          </div>
        )}
      </div>
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
