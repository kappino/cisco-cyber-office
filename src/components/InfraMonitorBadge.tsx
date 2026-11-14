import React, { useEffect, useState } from 'react';
import { Activity, Cpu, Network, RefreshCw, Server, X } from 'lucide-react';
import { infraBridge, InfraHealth, InfraLogEntry } from '../utils/infraBridge';
import { MissionArchitectModal } from './MissionArchitectModal';

export const InfraMonitorBadge: React.FC = () => {
  const [health, setHealth] = useState<InfraHealth>({
    cmlOnline: false,
    cmlIp: '192.168.122.110',
    cmlLabFound: false,
    cmlNodesActive: 0,
    aiOnline: false,
    aiModel: 'gemma4:12b',
  });
  const [logs, setLogs] = useState<InfraLogEntry[]>(infraBridge.getLogs());
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [architectOpen, setArchitectOpen] = useState(false);

  const refreshHealth = async () => {
    const h = await infraBridge.getHealth();
    setHealth(h);
  };

  useEffect(() => {
    void refreshHealth();
    const timer = setInterval(() => {
      void refreshHealth();
    }, 10000);
    const unsub = infraBridge.subscribe(() => {
      setLogs(infraBridge.getLogs());
    });
    return () => {
      clearInterval(timer);
      unsub();
    };
  }, []);

  const handleBootstrap = async () => {
    setSyncing(true);
    await infraBridge.bootstrapDemoLab();
    await refreshHealth();
    setSyncing(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-[11px] font-mono transition-colors"
        title="Live Infrastructure Monitor"
      >
        <span
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${
            health.cmlOnline ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'
          }`}
        >
          <Server className="w-3 h-3" />
          CML {health.cmlIp}: {health.cmlOnline ? 'LIVE' : 'SIM'}
        </span>
        <span
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${
            health.aiOnline ? 'bg-cyan-950/90 text-cyan-300 border border-cyan-500/40' : 'bg-slate-800 text-slate-400'
          }`}
        >
          <Cpu className="w-3 h-3" />
          AI {health.aiModel}: {health.aiOnline ? 'LIVE' : 'SIM'}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-950/95 border border-slate-700 rounded-xl shadow-2xl p-3 z-50 text-xs font-mono text-slate-200">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <span className="font-bold text-cisco-blue flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> Live Infrastructure Monitor
            </span>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="text-[11px] text-slate-400">
              Lab: <span className="text-slate-200">{health.cmlLabFound ? 'FuoriRete_Office (OK)' : 'Non trovato / SIM'}</span>
              {health.cmlOnline && <span className="ml-2 text-emerald-400">Nodi: {health.cmlNodesActive}</span>}
            </div>
            <button
              type="button"
              onClick={handleBootstrap}
              disabled={syncing}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-cisco-blue hover:bg-blue-500 text-white font-semibold disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
              Sync / Bootstrap CML Lab
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setArchitectOpen(true);
            }}
            className="w-full mb-3 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 font-bold text-[11px] transition"
          >
            <Network className="w-3.5 h-3.5" />
            Genera Topologia & Missione (netAgent + Ollama)
          </button>

          <div className="text-[10px] text-slate-400 uppercase mb-1">Ultime chiamate (CML / Ollama)</div>
          <div className="max-h-40 overflow-y-auto space-y-1 bg-slate-900/80 rounded p-2 border border-slate-800">
            {logs.length === 0 ? (
              <div className="text-slate-500 italic">Nessuna chiamata registrata ancora.</div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="truncate text-slate-300">
                    <span className={log.mode === 'fallback_sim' ? 'text-amber-400' : 'text-emerald-400'}>
                      [{log.mode === 'fallback_sim' ? 'SIM' : 'LIVE'}]
                    </span>{' '}
                    {log.summary}
                  </span>
                  <span className="text-slate-500 shrink-0">{log.latencyMs}ms</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <MissionArchitectModal open={architectOpen} onClose={() => setArchitectOpen(false)} />
    </div>
  );
};
