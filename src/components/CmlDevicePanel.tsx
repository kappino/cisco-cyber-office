import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { RoomTopology } from '../utils/infraBridge';
export { StatefulConsole as CmlConsole } from './StatefulConsole';
import { StatefulConsole as CmlConsole } from './StatefulConsole';

interface Props {
  roomId: string;
  node: string;
  topology: RoomTopology | null;
  onClose: () => void;
}

/** Postazione (PC o stampante): ci si siede e si usa il suo terminale. */
export const CmlDevicePanel: React.FC<Props> = ({ roomId, node, topology, onClose }) => {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('keydown', escape); previous?.focus(); };
  }, [onClose]);
  const device = topology?.devices.find((d) => d.label === node);
  const ready = topology?.status.phase === 'ready' && device?.state === 'BOOTED';
  const nic = device?.interfaces[0];
  const plugged = nic?.connected && nic.link_state === 'STARTED';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label={`Console ${node}`} className="w-full max-w-3xl max-h-[92vh] flex flex-col bg-slate-900 border-2 border-cyan-600/70 rounded-xl shadow-2xl font-mono"
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
          <button ref={closeButton} onClick={onClose} className="p-1 rounded hover:bg-slate-800" aria-label="Chiudi"><X className="w-4 h-4" /></button>
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
