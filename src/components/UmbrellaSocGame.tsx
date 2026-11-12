import React, { useState } from 'react';
import { sound } from '../utils/audio';
import confetti from 'canvas-confetti';
import { ArrowLeft, CheckCircle2, ShieldAlert, ShieldCheck, Activity, Globe, Lock, Eye, Zap } from 'lucide-react';

interface Props {
  onBack: () => void;
  onComplete: () => void;
  isCompleted: boolean;
}

interface DnsQuery {
  id: number;
  time: string;
  source: string;
  domain: string;
  type: 'A' | 'AAAA' | 'TXT';
  status: 'CLEAN' | 'MALICIOUS_C2' | 'PHISHING';
}

const INITIAL_QUERIES: DnsQuery[] = [
  { id: 1, time: '18:42:01', source: '10.0.1.12 (HR-PC)', domain: 'office.com', type: 'A', status: 'CLEAN' },
  { id: 2, time: '18:42:04', source: '10.0.2.45 (Dev-Linux)', domain: 'github.com', type: 'A', status: 'CLEAN' },
  { id: 3, time: '18:42:09', source: '10.0.4.15 (Accounting-PC)', domain: 'trojan-c2.evil-crypto.net', type: 'A', status: 'MALICIOUS_C2' },
  { id: 4, time: '18:42:11', source: '10.0.1.88 (Sales-Mac)', domain: 'cisco.com', type: 'A', status: 'CLEAN' },
  { id: 5, time: '18:42:14', source: '10.0.4.15 (Accounting-PC)', domain: 'trojan-c2.evil-crypto.net', type: 'TXT', status: 'MALICIOUS_C2' },
];

export const UmbrellaSocGame: React.FC<Props> = ({ onBack, onComplete, isCompleted: initialCompleted }) => {
  const [selectedThreat, setSelectedThreat] = useState<boolean>(false);
  const [dnsBlocked, setDnsBlocked] = useState<boolean>(initialCompleted);
  const [endpointIsolated, setEndpointIsolated] = useState<boolean>(initialCompleted);
  const [completed, setCompleted] = useState<boolean>(initialCompleted);

  const handleEnforceDnsBlock = () => {
    sound.playCableSnap();
    setDnsBlocked(true);
    checkSuccess(true, endpointIsolated);
  };

  const handleEnforceIsolate = () => {
    sound.playCableSnap();
    setEndpointIsolated(true);
    checkSuccess(dnsBlocked, true);
  };

  const checkSuccess = (blocked: boolean, isolated: boolean) => {
    if (blocked && isolated && !completed) {
      sound.playSuccess();
      setCompleted(true);
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 }
      });
      onComplete();
    }
  };

  return (
    <div className="min-h-[85vh] bg-slate-900/90 border-2 border-slate-700 rounded-xl p-4 sm:p-6 shadow-2xl relative flex flex-col justify-between">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { sound.playClick(); onBack(); }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-600 transition-colors text-sm font-semibold"
          >
            <ArrowLeft className="w-4 h-4" /> Torna all'Ufficio
          </button>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-sky-400 flex items-center gap-2 font-mono">
              <ShieldAlert className="w-6 h-6 text-red-500 animate-pulse" /> Cisco Umbrella: SOC Incident Response
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Isola la minaccia ransomware che tenta di stabilire un canale di Command & Control via DNS.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {completed && (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full text-xs font-semibold animate-pulse">
              <CheckCircle2 className="w-4 h-4" /> Minaccia Neutralizzata!
            </span>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="my-6 max-w-5xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Live DNS Query Stream */}
        <div className="lg:col-span-2 bg-slate-950 border-2 border-slate-800 rounded-xl p-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-2">
              <Activity className="w-4 h-4 text-cisco-blue animate-spin" /> LIVE DNS TRAFFIC MONITOR (GATEWAY 10.0.0.1)
            </span>
            <span className="text-[10px] bg-sky-950 text-sky-400 border border-sky-800 px-2 py-0.5 rounded font-mono">
              CISCO TALOS FEED: ACTIVE
            </span>
          </div>

          <div className="space-y-2 overflow-y-auto max-h-72 pr-1 font-mono text-xs">
            {INITIAL_QUERIES.map((q) => {
              const isMalicious = q.status === 'MALICIOUS_C2';
              return (
                <div
                  key={q.id}
                  onClick={() => {
                    sound.playClick();
                    if (isMalicious) setSelectedThreat(true);
                  }}
                  className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                    isMalicious
                      ? dnsBlocked
                        ? 'bg-emerald-950/40 border-emerald-500/40 opacity-70'
                        : 'bg-red-950/60 border-red-500/80 shadow-[0_0_12px_rgba(239,68,68,0.25)] ring-1 ring-red-500/50 hover:scale-[1.01]'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[10px]">{q.time}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                        isMalicious
                          ? dnsBlocked
                            ? 'bg-emerald-900 text-emerald-300'
                            : 'bg-red-600 text-white animate-bounce'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {isMalicious ? (dnsBlocked ? 'SINKHOLED / BLOCKED' : 'THREAT DETECTED') : 'SAFE'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-bold text-white">{q.domain}</span>
                    <span className="text-slate-400 text-[11px]">{q.source}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 text-center text-[11px] font-mono text-slate-400">
            {selectedThreat ? (
              <span className="text-sky-300">✓ Minaccia selezionata. Applica le contromisure nel pannello a destra.</span>
            ) : (
              <span className="text-amber-400">⚠️ Clicca sulla riga rossa sospetta per analizzarla!</span>
            )}
          </div>
        </div>

        {/* Right Column: Cisco Umbrella Policy Enforcement */}
        <div className="bg-slate-950 border-2 border-slate-800 rounded-xl p-4 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800 mb-4 text-xs font-mono font-bold text-slate-200">
              <Lock className="w-4 h-4 text-cisco-blue" /> UMBRELLA SECURITY ENFORCEMENT
            </div>

            {selectedThreat || completed ? (
              <div className="space-y-4">
                <div className="bg-red-950/30 border border-red-500/40 rounded-lg p-3 text-xs font-mono">
                  <div className="text-red-400 font-bold mb-1 flex items-center gap-1.5">
                    <Eye className="w-4 h-4" /> Talos Threat Intelligence:
                  </div>
                  <div className="text-slate-300 text-[11px] space-y-1">
                    <p><strong>Minaccia:</strong> Cryptolocker C2 Beacon</p>
                    <p><strong>Host Infetto:</strong> 10.0.4.15 (Accounting)</p>
                    <p><strong>Rischio:</strong> Cifratura file di rete imminente.</p>
                  </div>
                </div>

                {/* Countermeasure 1: DNS Block */}
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-white flex items-center gap-1.5">
                      <Globe className="w-4 h-4 text-cisco-blue" /> 1. DNS Sinkhole
                    </span>
                    {dnsBlocked && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400 mb-3 font-mono">
                    Reindirizza le richieste per il dominio malevolo verso il server sicuro di Cisco Umbrella (146.112.61.107).
                  </p>
                  <button
                    onClick={handleEnforceDnsBlock}
                    disabled={dnsBlocked}
                    className={`w-full py-2 px-3 rounded-md font-mono text-xs font-bold transition ${
                      dnsBlocked
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/50 cursor-default'
                        : 'bg-cisco-blue hover:bg-sky-400 text-slate-950 shadow-md'
                    }`}
                  >
                    {dnsBlocked ? '✓ Regola DNS Attiva' : 'Blocca Dominio Malevolo'}
                  </button>
                </div>

                {/* Countermeasure 2: Endpoint Isolation */}
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-white flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-amber-400" /> 2. Isola Host (Cisco Secure)
                    </span>
                    {endpointIsolated && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400 mb-3 font-mono">
                    Disconnetti la scheda di rete del PC contagiato per impedire il movimento laterale sulla rete aziendale.
                  </p>
                  <button
                    onClick={handleEnforceIsolate}
                    disabled={endpointIsolated}
                    className={`w-full py-2 px-3 rounded-md font-mono text-xs font-bold transition ${
                      endpointIsolated
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/50 cursor-default'
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md'
                    }`}
                  >
                    {endpointIsolated ? '✓ Host Isolato dalla LAN' : 'Isola Endpoint 10.0.4.15'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-xs font-mono text-slate-500">
                Seleziona una minaccia attiva dalla lista dei log DNS a sinistra per abilitare le azioni di contenimento.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-slate-300">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-sky-400 shrink-0" />
          <span>
            <strong>Concetto Cisco Umbrella:</strong> Il blocco al livello DNS previene la connessione prima ancora che il payload malevolo venga scaricato o che la chiave di cifratura sia scambiata.
          </span>
        </div>
        {completed && (
          <button
            onClick={() => { sound.playClick(); onBack(); }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition shadow-lg shrink-0"
          >
            Torna alla Sala Operativa ➜
          </button>
        )}
      </div>
    </div>
  );
};
