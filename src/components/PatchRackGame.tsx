import React, { useState } from 'react';
import { sound } from '../utils/audio';
import { infraBridge } from '../utils/infraBridge';
import confetti from 'canvas-confetti';
import { ArrowLeft, CheckCircle2, RotateCcw, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';

interface Props {
  onBack: () => void;
  onComplete: () => void;
  isCompleted: boolean;
}

interface PortDef {
  id: string;
  label: string;
  sublabel: string;
  expectedTarget: string;
  color: string;
}

const PATCH_PORTS: PortDef[] = [
  { id: 'pp-1', label: 'Port 01', sublabel: 'PC 1 (HR)', expectedTarget: 'sw-1', color: '#00bceb' },
  { id: 'pp-2', label: 'Port 02', sublabel: 'Dev Workstation', expectedTarget: 'sw-2', color: '#6cc04a' },
  { id: 'pp-3', label: 'Port 03', sublabel: 'Core Router (Uplink)', expectedTarget: 'sw-g1', color: '#fbab18' },
  { id: 'pp-4', label: 'Port 04', sublabel: 'VoIP Phone System', expectedTarget: 'sw-3', color: '#a855f7' },
];

const SWITCH_PORTS = [
  { id: 'sw-1', label: 'Fa0/1', vlan: 'VLAN 10 (HR)', type: 'FastEthernet' },
  { id: 'sw-2', label: 'Fa0/2', vlan: 'VLAN 20 (Dev)', type: 'FastEthernet' },
  { id: 'sw-3', label: 'Fa0/3', vlan: 'VLAN 30 (Voice)', type: 'FastEthernet' },
  { id: 'sw-4', label: 'Fa0/4', vlan: 'VLAN 99 (Mgmt)', type: 'FastEthernet' },
  { id: 'sw-g1', label: 'Gi0/1', vlan: 'TRUNK (802.1Q)', type: 'Gigabit' },
  { id: 'sw-g2', label: 'Gi0/2', vlan: 'TRUNK Backup', type: 'Gigabit' },
];

export const PatchRackGame: React.FC<Props> = ({ onBack, onComplete, isCompleted: initialCompleted }) => {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [connections, setConnections] = useState<Record<string, string>>({});
  const [completed, setCompleted] = useState<boolean>(initialCompleted);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cmlBadge, setCmlBadge] = useState<string>('[SIM MODE]');
  const [verifyBadge, setVerifyBadge] = useState<string | null>(null);

  const handleSourceClick = (portId: string) => {
    sound.playClick();
    setErrorMsg(null);
    if (selectedSource === portId) {
      setSelectedSource(null);
    } else {
      setSelectedSource(portId);
    }
  };

  const handleSwitchPortClick = (switchPortId: string) => {
    if (!selectedSource) {
      sound.playClick();
      setErrorMsg('Seleziona prima una porta dal Patch Panel in alto!');
      return;
    }

    const sourcePort = PATCH_PORTS.find(p => p.id === selectedSource);
    if (!sourcePort) return;

    if (sourcePort.expectedTarget === switchPortId) {
      sound.playCableSnap();
      const nextConnections = { ...connections, [selectedSource]: switchPortId };
      setConnections(nextConnections);
      setSelectedSource(null);
      setErrorMsg(null);
      void infraBridge.patchCable(switchPortId, selectedSource, true).then((res) => {
        setCmlBadge(res.mode === 'live_cml' ? `[CML LIVE: ${switchPortId} UP]` : '[SIM MODE]');
      });

      // Check if all 4 are connected
      if (Object.keys(nextConnections).length === PATCH_PORTS.length) {
        sound.playSuccess();
        setCompleted(true);
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
        onComplete();
      }
    } else {
      sound.playError();
      setErrorMsg(`Errore! ${sourcePort.label} (${sourcePort.sublabel}) non va collegata a questa porta dello switch.`);
    }
  };

  const handleVerifyRack = async () => {
    sound.playClick();
    const patchedPorts: Record<string, boolean> = {};
    Object.values(connections).forEach((swPort) => {
      patchedPorts[swPort] = true;
    });
    const res = await infraBridge.verifyMission('rack', [], { patched_ports: patchedPorts });
    setVerifyBadge(`netAgent: ${res.scorePct}% (${res.passed ? 'PASS' : `${res.missing.length} mancanti`})`);
  };

  const resetRack = () => {
    sound.playClick();
    Object.entries(connections).forEach(([srcId, swPort]) => {
      void infraBridge.patchCable(swPort, srcId, false);
    });
    setConnections({});
    setSelectedSource(null);
    setErrorMsg(null);
    setCompleted(false);
    setCmlBadge('[SIM MODE]');
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
            <h2 className="text-xl sm:text-2xl font-bold text-cisco-blue flex items-center gap-2 font-mono">
              <Zap className="w-6 h-6 text-cisco-gold" /> Datacenter Rack 01: Cablaggio Strutturato
              <span className={`text-[10px] px-2 py-0.5 rounded border ${cmlBadge.includes('LIVE') ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300' : 'bg-slate-800 border-slate-600 text-slate-400'}`}>
                {cmlBadge}
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Collega fisicamente le patch lead dal Patch Panel allo Switch Cisco Catalyst 9300.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {verifyBadge && (
            <span className="px-2.5 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs font-mono">
              {verifyBadge}
            </span>
          )}
          <button
            onClick={() => void handleVerifyRack()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/50 transition-colors text-xs font-bold"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Verifica netAgent
          </button>
          {completed && (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full text-xs font-semibold animate-pulse">
              <CheckCircle2 className="w-4 h-4" /> Rack Online & Connesso!
            </span>
          )}
          <button
            onClick={resetRack}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg border border-slate-700 transition"
            title="Reset Cablaggio"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Rack Simulation Chassis */}
      <div className="my-6 max-w-4xl mx-auto w-full bg-slate-950 border-4 border-slate-800 rounded-lg p-4 sm:p-6 shadow-inner relative">
        <div className="text-center font-mono text-xs uppercase tracking-widest text-slate-500 mb-4 flex items-center justify-between px-2">
          <span>Rack Unit 42U - Server Farm A</span>
          <span className="text-cisco-blue">Cisco Certified Cabling Simulation</span>
        </div>

        {/* 1. PATCH PANEL */}
        <div className="bg-slate-800 border-2 border-slate-600 rounded-md p-3 mb-8 shadow-md">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-700">
            <span className="text-xs font-mono font-bold text-slate-300">CAT6A PATCH PANEL 24P</span>
            <span className="text-[10px] text-slate-400 font-mono">TIA/EIA 568-B</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PATCH_PORTS.map((port) => {
              const isConnected = !!connections[port.id];
              const isSelected = selectedSource === port.id;

              return (
                <button
                  key={port.id}
                  onClick={() => handleSourceClick(port.id)}
                  disabled={isConnected}
                  className={`relative p-3 rounded-md border text-left transition-all ${
                    isConnected
                      ? 'bg-slate-900/80 border-emerald-500/60 opacity-90'
                      : isSelected
                      ? 'bg-cisco-blue/20 border-cisco-blue ring-2 ring-cisco-blue/50 scale-105'
                      : 'bg-slate-900 border-slate-700 hover:border-slate-500 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-bold text-slate-200">{port.label}</span>
                    <div
                      className={`w-3 h-3 rounded-full border border-slate-900 transition-all ${
                        isConnected
                          ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                          : isSelected
                          ? 'bg-cisco-blue shadow-[0_0_8px_#00bceb] animate-ping'
                          : 'bg-slate-700'
                      }`}
                    />
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono truncate">{port.sublabel}</div>
                  <div className="mt-2 flex items-center justify-center h-6 bg-black rounded border border-slate-800">
                    <div
                      className="w-4 h-3 rounded-sm border border-slate-700"
                      style={{ backgroundColor: isConnected ? port.color : '#1e293b' }}
                    />
                  </div>
                  {isConnected && (
                    <span className="text-[9px] text-emerald-400 font-mono block text-center mt-1">COLLEGATO</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Cable Connection Visualizer (Bézier curves) */}
        <div className="py-2 text-center">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 px-3 py-1 bg-slate-900 rounded-full border border-slate-800">
            <span className="w-2 h-2 rounded-full bg-cisco-blue animate-pulse"></span>
            {selectedSource
              ? `Clicca sulla porta corretta dello Switch per inserire il cavo RJ45...`
              : completed
              ? `Tutti i cavi collegati con successo!`
              : `Clicca su una porta del Patch Panel per iniziare il cablaggio.`}
          </div>
        </div>

        {/* 2. CISCO CATALYST 9300 SWITCH */}
        <div className="bg-slate-900 border-2 border-cisco-blue/40 rounded-md p-3 mt-6 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-widest text-white font-mono">CISCO</span>
              <span className="text-xs font-mono text-cisco-blue font-semibold">Catalyst 9300 Series (Managed)</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> SYS
              </div>
              <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
                <span className={`w-2 h-2 rounded-full ${completed ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span> STAT
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {SWITCH_PORTS.map((swPort) => {
              // Find if any source connected here
              const connectedSourceId = Object.keys(connections).find(srcId => connections[srcId] === swPort.id);
              const connectedSource = PATCH_PORTS.find(p => p.id === connectedSourceId);

              return (
                <button
                  key={swPort.id}
                  onClick={() => handleSwitchPortClick(swPort.id)}
                  className={`p-2.5 rounded border text-left transition-all ${
                    connectedSource
                      ? 'bg-slate-950 border-emerald-500/70 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                      : 'bg-slate-950/80 border-slate-700 hover:border-cisco-blue/80 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-bold text-white">{swPort.label}</span>
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        connectedSource ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-slate-800'
                      }`}
                    />
                  </div>
                  <div className="text-[10px] font-mono text-slate-300 font-semibold">{swPort.vlan}</div>
                  <div className="text-[9px] text-slate-500 font-mono mt-0.5">{swPort.type}</div>

                  {/* Physical RJ45 Port Socket */}
                  <div className="mt-2 h-6 bg-black rounded border border-slate-800 flex items-center justify-center">
                    {connectedSource ? (
                      <div
                        className="w-5 h-3.5 rounded-sm border border-black shadow-inner flex items-center justify-center text-[8px] font-mono text-white font-bold"
                        style={{ backgroundColor: connectedSource.color }}
                      >
                        RJ45
                      </div>
                    ) : (
                      <div className="w-3.5 h-3 bg-slate-900 border border-slate-800 rounded-sm"></div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Error notification banner */}
        {errorMsg && (
          <div className="mt-4 p-3 bg-red-950/80 border border-red-500/60 rounded-lg text-red-300 text-xs sm:text-sm flex items-center gap-2 animate-bounce">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Bottom Info Bar / Instructions */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-slate-300">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-cisco-blue shrink-0" />
          <span>
            <strong>Obiettivo Tecnico:</strong> Il router centrale richiede una porta <em>Trunk (802.1Q)</em> per trasportare tutte le VLAN; i PC e i telefoni vanno associati alle rispettive porte <em>Access (VLAN 10, 20, 30)</em>.
          </span>
        </div>
        {completed && (
          <button
            onClick={() => { sound.playClick(); onBack(); }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition shadow-lg shrink-0"
          >
            Prosegui Missione ➜
          </button>
        )}
      </div>
    </div>
  );
};
