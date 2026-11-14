import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { X, Cable, AlertTriangle, Unplug } from 'lucide-react';
import { sound } from '../utils/audio';
import { infraBridge, RoomPorts, RoomTopology, RoomTopologyDevice, RoomInterface } from '../utils/infraBridge';
import { CmlConsole } from './CmlDevicePanel';

interface Props {
  roomId: string;
  rackId: string;
  topology: RoomTopology | null;
  onTopology: (t: RoomTopology) => void;
  onClose: () => void;
}

type PortRef = { node: string; iface: string };
const key = (p: PortRef) => `${p.node}|${p.iface}`;
const short = (iface: string) => iface.replace('Ethernet', 'Et').replace('Port-channel', 'Po');
const KIND_ORDER: Record<string, number> = { router: 0, switch: 1, server: 2 };
const KIND_NAME: Record<string, string> = { router: 'Router IOS', switch: 'Switch L2 gestito', server: 'Server 1U' };

/**
 * Armadio di rete della stanza, generato dal lab CML: patch panel con le prese dei PC,
 * ogni apparato con tutte le sue porte e i LED letti dagli apparati veri, cavi tra le porte,
 * cavo console da inserire nella porta CON del dispositivo che si vuole configurare.
 */
export const RackView: React.FC<Props> = ({ roomId, rackId, topology, onTopology, onClose }) => {
  const [ports, setPorts] = useState<RoomPorts | null>(null);
  const [selected, setSelected] = useState<PortRef | null>(null);
  const [holdingConsole, setHoldingConsole] = useState(false);
  const [consoleOn, setConsoleOn] = useState<string | null>(() => {
    try { return localStorage.getItem(`fr_console_${roomId}`); } catch { return null; }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paths, setPaths] = useState<{ id: string; d: string; color: string; dashed: boolean }[]>([]);
  const inner = useRef<HTMLDivElement>(null);
  const portEls = useRef(new Map<string, HTMLElement>());

  // LED reali: letti dagli apparati ogni 4 s mentre l'armadio e' aperto
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const p = await infraBridge.getRoomPorts(roomId);
      if (alive && p) setPorts(p);
    };
    void tick();
    const t = setInterval(tick, 4000);
    return () => { alive = false; clearInterval(t); };
  }, [roomId]);

  useEffect(() => {
    try {
      if (consoleOn) localStorage.setItem(`fr_console_${roomId}`, consoleOn);
      else localStorage.removeItem(`fr_console_${roomId}`);
    } catch { /* storage non disponibile */ }
  }, [consoleOn, roomId]);

  const devices = topology?.devices ?? [];
  const byLabel = useMemo(() => new Map(devices.map((d) => [d.label, d])), [devices]);
  const racks = topology?.racks ?? [];

  const findIface = (p: PortRef): RoomInterface | undefined =>
    byLabel.get(p.node)?.interfaces.find((i) => i.label === p.iface);

  // disegno dei cavi: centri delle porte, curve di Bezier
  const recompute = useCallback(() => {
    const box = inner.current?.getBoundingClientRect();
    if (!box || !topology) return;
    const center = (k: string) => {
      const el = portEls.current.get(k);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2 };
    };
    const out: typeof paths = [];
    for (const l of topology.links) {
      const a = center(key(l.a)), b = center(key(l.b));
      if (!a || !b) continue;
      const da = byLabel.get(l.a.node), db = byLabel.get(l.b.node);
      const infra = (d?: RoomTopologyDevice) => d?.kind === 'router' || d?.kind === 'switch';
      const color = infra(da) && infra(db) ? '#facc15' : da?.kind === 'server' || db?.kind === 'server' ? '#f87171' : '#38bdf8';
      const sag = Math.max(40, Math.abs(a.x - b.x) * 0.25);
      out.push({
        id: l.id,
        d: `M ${a.x} ${a.y} C ${a.x} ${a.y + sag}, ${b.x} ${b.y + sag}, ${b.x} ${b.y}`,
        color,
        dashed: l.state !== 'STARTED',
      });
    }
    if (consoleOn) {
      const a = center(`${consoleOn}|CON`);
      const b = center('LAPTOP|CON');
      if (a && b) out.push({ id: 'console', d: `M ${a.x} ${a.y} C ${a.x} ${a.y + 80}, ${b.x} ${b.y - 80}, ${b.x} ${b.y}`, color: '#7dd3fc', dashed: false });
    }
    setPaths(out);
  }, [topology, byLabel, consoleOn]);

  useLayoutEffect(() => { recompute(); }, [recompute, ports]);
  useEffect(() => {
    if (!inner.current) return;
    const ro = new ResizeObserver(() => recompute());
    ro.observe(inner.current);
    window.addEventListener('resize', recompute);
    return () => { ro.disconnect(); window.removeEventListener('resize', recompute); };
  }, [recompute]);

  const run = async (body: Parameters<typeof infraBridge.cable>[1]) => {
    setBusy(true);
    setError(null);
    const res = await infraBridge.cable(roomId, body);
    setBusy(false);
    if (res.ok && res.topology) {
      onTopology(res.topology);
      sound.playClick();
    } else setError(res.error ?? 'operazione non riuscita');
  };

  const onPortClick = (p: PortRef) => {
    if (busy) return;
    setError(null);
    if (holdingConsole) {
      setError('Il cavo console va nella porta CON (azzurra) di un apparato.');
      return;
    }
    const here = findIface(p);
    if (!selected) {
      setSelected(p);
      return;
    }
    if (key(selected) === key(p)) {
      setSelected(null);
      if (here?.connected) void run({ action: 'disconnect', node: p.node, iface: p.iface });
      return;
    }
    const sel = findIface(selected);
    if (here?.connected) {
      setError(`${p.node} ${p.iface} è già occupata: prima togli quel cavo.`);
      return;
    }
    setSelected(null);
    if (sel?.connected && sel.peer) {
      // il cavo di `selected` si sposta su `p`; l'altro capo resta dov'è
      void run({ action: 'move', node: sel.peer.node, iface: sel.peer.iface, to_node: p.node, to_iface: p.iface });
    } else {
      void run({ action: 'connect', node: selected.node, iface: selected.iface, to_node: p.node, to_iface: p.iface });
    }
  };

  const onConsolePort = (label: string) => {
    setError(null);
    setSelected(null);
    if (holdingConsole) {
      setConsoleOn(label);
      setHoldingConsole(false);
      sound.playClick();
    } else if (consoleOn === label) {
      setConsoleOn(null);
    } else {
      setError('Prendi il cavo console (in basso) e poi inseriscilo nella porta CON.');
    }
  };

  const ledOf = (d: RoomTopologyDevice, i: RoomInterface): 'green' | 'amber' | 'off' => {
    if (d.state !== 'BOOTED') return 'off';
    const real = ports?.ports?.[d.label]?.[i.label];
    if (real) return i.connected ? real.led : 'off';
    return i.connected && i.link_state === 'STARTED' ? 'green' : 'off';
  };
  const ledCls = (l: 'green' | 'amber' | 'off') =>
    l === 'green' ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : l === 'amber' ? 'bg-amber-400 animate-pulse shadow-[0_0_6px_#fbbf24]' : 'bg-slate-700';

  const portRef = (k: string) => (el: HTMLElement | null) => {
    if (el) portEls.current.set(k, el);
    else portEls.current.delete(k);
  };

  const renderPort = (d: RoomTopologyDevice, i: RoomInterface, caption?: string) => {
    const p = { node: d.label, iface: i.label };
    const led = ledOf(d, i);
    const info = ports?.ports?.[d.label]?.[i.label];
    const isSel = selected && key(selected) === key(p);
    return (
      <button
        key={i.label}
        onClick={() => onPortClick(p)}
        title={`${d.label} ${i.label}${i.peer ? ` → ${i.peer.node} ${i.peer.iface}` : ' (libera)'}${info ? ` · ${info.status}` : ''}`}
        className={`p-1.5 rounded border text-left transition-all min-w-[64px] ${
          isSel ? 'bg-cyan-500/20 border-cyan-400 ring-2 ring-cyan-400/50 scale-105'
            : i.connected ? 'bg-slate-950 border-emerald-600/50' : 'bg-slate-950/80 border-slate-700 hover:border-cyan-500/70'
        }`}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="font-mono text-[10px] font-bold text-white">{caption ?? short(i.label)}</span>
          <span className={`w-2 h-2 rounded-full ${ledCls(led)}`} />
        </div>
        <div className="text-[9px] font-mono text-slate-400 truncate">
          {info ? (info.vlan === 'trunk' ? 'trunk' : info.vlan) : i.connected ? '' : 'libera'}
        </div>
        <div ref={portRef(key(p))} className="mt-1 h-4 bg-black rounded-sm border border-slate-800 flex items-center justify-center">
          {i.connected ? <div className="w-4 h-2.5 rounded-[2px] bg-sky-400/80" /> : <div className="w-3 h-2 bg-slate-900 border border-slate-800 rounded-[1px]" />}
        </div>
      </button>
    );
  };

  const renderConsolePort = (d: RoomTopologyDevice) => (
    <button
      onClick={() => onConsolePort(d.label)}
      title="Porta console (RJ45 azzurra)"
      className={`p-1.5 rounded border min-w-[52px] ${consoleOn === d.label ? 'border-sky-300 bg-sky-500/20' : holdingConsole ? 'border-sky-400 animate-pulse bg-sky-900/30' : 'border-sky-800 bg-slate-950'}`}
    >
      <div className="font-mono text-[10px] font-bold text-sky-300">CON</div>
      <div ref={portRef(`${d.label}|CON`)} className="mt-1 h-4 bg-black rounded-sm border border-sky-900 flex items-center justify-center">
        {consoleOn === d.label ? <div className="w-4 h-2.5 rounded-[2px] bg-sky-300" /> : <div className="w-3 h-2 bg-slate-900 border border-sky-900 rounded-[1px]" />}
      </div>
    </button>
  );

  const consoleDev = consoleOn ? byLabel.get(consoleOn) : undefined;
  const consoleReady = topology?.status.phase === 'ready' && consoleDev?.state === 'BOOTED';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-stretch justify-center p-1 sm:p-4" onClick={onClose}>
      <div className="w-full max-w-6xl flex flex-col bg-slate-900 border-2 border-slate-700 rounded-xl shadow-2xl font-mono overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between px-3 py-2 border-b border-slate-700 shrink-0">
          <div className="min-w-0">
            <div className="text-sm font-bold text-white">Armadio di rete · {topology?.lab_title}</div>
            <div className="text-[10px] text-slate-400">
              Clicca una porta e poi un'altra per collegarle · clicca un cavo e poi una porta libera per spostarlo · clicca due volte la stessa porta per togliere il cavo
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-800" aria-label="Chiudi"><X className="w-4 h-4" /></button>
        </header>

        <div className="flex-1 overflow-auto">
          <div ref={inner} className="relative p-3 sm:p-4">
            {(error || busy) && (
              <div className={`mb-3 px-3 py-2 rounded border text-xs flex items-center gap-2 ${error ? 'bg-red-950/70 border-red-600 text-red-200' : 'bg-slate-800 border-slate-600 text-slate-200'}`}>
                {error ? <><AlertTriangle className="w-4 h-4" /> {error}</> : 'Aggiorno il lab su CML…'}
              </div>
            )}

            <div className="flex flex-wrap gap-4 items-start">
              {racks.map((r) => {
                const jacks = devices.filter((d) => d.jack?.rack === r.id);
                const mounted = devices.filter((d) => d.rack === r.id).sort((a, b) => (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9));
                return (
                  <div key={r.id} className={`flex-1 min-w-[300px] bg-slate-950 border-4 rounded-lg p-3 ${r.id === rackId ? 'border-slate-600' : 'border-slate-800'}`}>
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-3 flex justify-between">
                      <span>{r.label}</span><span>rack {r.id}</span>
                    </div>

                    {jacks.length > 0 && (
                      <div className="bg-slate-800 border-2 border-slate-600 rounded-md p-2 mb-4">
                        <div className="flex justify-between pb-1 mb-2 border-b border-slate-700 text-[10px]">
                          <span className="font-bold text-slate-300">PATCH PANEL · prese a muro</span>
                          <span className="text-slate-500">CAT6</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {jacks.map((h) => h.interfaces[0] && (
                            <div key={h.label} className="flex flex-col items-center">
                              {renderPort(h, h.interfaces[0], h.jack?.label)}
                              <span className="text-[9px] text-slate-400 mt-0.5">{h.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {mounted.map((d) => (
                      <div key={d.label} className={`rounded-md p-2 mb-4 border-2 ${d.kind === 'router' ? 'bg-slate-900 border-indigo-500/40' : d.kind === 'switch' ? 'bg-slate-900 border-cyan-500/40' : 'bg-slate-900 border-rose-500/40'}`}>
                        <div className="flex items-center justify-between pb-1 mb-2 border-b border-slate-800">
                          <div className="min-w-0">
                            <span className="text-xs font-black text-white">{d.label}</span>
                            <span className="ml-2 text-[10px] text-slate-400">{KIND_NAME[d.kind] ?? d.kind} · {d.display}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[9px] text-slate-400 shrink-0">
                            <span className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${d.state === 'BOOTED' ? 'bg-emerald-500 animate-pulse' : d.state === 'STARTED' || d.state === 'QUEUED' ? 'bg-amber-500' : 'bg-slate-700'}`} />SYS</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 items-end">
                          {renderConsolePort(d)}
                          {d.interfaces.map((i) => renderPort(d, i))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            {/* portatile del tecnico con il cavo console */}
            <div className="mt-2 flex flex-wrap items-center gap-3 bg-slate-800/70 border border-slate-700 rounded-lg p-2">
              <div className="flex flex-col items-center">
                <div className="text-[10px] text-slate-300 mb-1">Portatile del tecnico</div>
                <div ref={portRef('LAPTOP|CON')} className="w-6 h-4 bg-black rounded-sm border border-sky-800" />
              </div>
              <button
                onClick={() => { setSelected(null); setError(null); setHoldingConsole((v) => !v); }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded border text-xs ${holdingConsole ? 'border-sky-300 bg-sky-500/20 text-sky-100' : 'border-sky-700 text-sky-300 hover:bg-sky-900/40'}`}
              >
                <Cable className="w-4 h-4" /> {holdingConsole ? 'Ora clicca la porta CON di un apparato' : consoleOn ? `Sposta il cavo console (ora su ${consoleOn})` : 'Prendi il cavo console'}
              </button>
              {consoleOn && (
                <button onClick={() => setConsoleOn(null)} className="flex items-center gap-1 px-2 py-1.5 rounded border border-slate-600 text-xs text-slate-300 hover:bg-slate-700">
                  <Unplug className="w-3.5 h-3.5" /> Scollega console
                </button>
              )}
              <div className="text-[10px] text-slate-400 flex gap-3">
                <span><span className="inline-block w-3 h-1 bg-yellow-400 align-middle" /> tra apparati</span>
                <span><span className="inline-block w-3 h-1 bg-sky-400 align-middle" /> verso le prese</span>
                <span><span className="inline-block w-3 h-1 bg-red-400 align-middle" /> verso i server</span>
                <span><span className="inline-block w-2 h-2 rounded-full bg-amber-400 align-middle" /> errore o bloccata da STP</span>
              </div>
            </div>

            {consoleOn && (
              <div className="mt-3">
                {consoleReady ? <CmlConsole key={consoleOn} roomId={roomId} node={consoleOn} height={300} />
                  : <div className="text-amber-300 text-xs">{consoleOn} non è ancora avviato: la console risponde quando il LED SYS è verde.</div>}
              </div>
            )}

            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
              {paths.map((p) => (
                <path key={p.id} d={p.d} fill="none" stroke={p.color} strokeWidth={3} strokeOpacity={0.85}
                  strokeDasharray={p.dashed ? '6 5' : undefined} strokeLinecap="round" />
              ))}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};
