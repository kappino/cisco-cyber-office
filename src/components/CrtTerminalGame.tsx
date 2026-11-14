import React, { useState, useEffect, useRef } from 'react';
import { sound } from '../utils/audio';
import { infraBridge } from '../utils/infraBridge';
import confetti from 'canvas-confetti';
import { ArrowLeft, CheckCircle2, RotateCcw, Terminal as TerminalIcon, Sparkles } from 'lucide-react';
import { TerminalHistoryItem } from '../types/game';

interface Props {
  onBack: () => void;
  onComplete: () => void;
  isCompleted: boolean;
}

type PromptMode = 'user' | 'privileged' | 'config' | 'config-if-gi01' | 'config-if-fa02';

export const CrtTerminalGame: React.FC<Props> = ({ onBack, onComplete, isCompleted: initialCompleted }) => {
  const [history, setHistory] = useState<TerminalHistoryItem[]>([
    { type: 'system', text: 'Cisco IOS Software, C9300 Software (C9300-UNIVERSALK9-M), Version 17.6.3' },
    { type: 'system', text: 'Copyright (c) 1986-2026 by Cisco Systems, Inc.' },
    { type: 'system', text: 'All rights reserved.' },
    { type: 'output', text: 'Premi <Tab> per autocompletare o scrivi "help" / "?" per la lista comandi.' },
    { type: 'output', text: 'ATTENZIONE: Interfaccia Gi0/1 spenta e porta Fa0/2 non configurata su VLAN 20.' },
  ]);

  const [inputVal, setInputVal] = useState<string>('');
  const [mode, setMode] = useState<PromptMode>('user');
  const [gi01Up, setGi01Up] = useState<boolean>(false);
  const [fa02Vlan20, setFa02Vlan20] = useState<boolean>(false);
  const [completed, setCompleted] = useState<boolean>(initialCompleted);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const getPromptString = () => {
    switch (mode) {
      case 'user': return 'Switch>';
      case 'privileged': return 'Switch#';
      case 'config': return 'Switch(config)#';
      case 'config-if-gi01': return 'Switch(config-if)#';
      case 'config-if-fa02': return 'Switch(config-if)#';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    sound.playMechanicalKey();

    if (e.key === 'Enter') {
      executeCommand(inputVal.trim());
      if (inputVal.trim()) {
        setCmdHistory(prev => [...prev, inputVal.trim()]);
        setHistoryIdx(-1);
      }
      setInputVal('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cmdHistory.length > 0) {
        const nextIdx = historyIdx === -1 ? cmdHistory.length - 1 : Math.max(0, historyIdx - 1);
        setHistoryIdx(nextIdx);
        setInputVal(cmdHistory[nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx !== -1) {
        const nextIdx = historyIdx + 1;
        if (nextIdx >= cmdHistory.length) {
          setHistoryIdx(-1);
          setInputVal('');
        } else {
          setHistoryIdx(nextIdx);
          setInputVal(cmdHistory[nextIdx]);
        }
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      autoComplete();
    }
  };

  const autoComplete = () => {
    const val = inputVal.toLowerCase();
    const suggestions: Record<string, string> = {
      'en': 'enable',
      'conf': 'configure terminal',
      'sh': 'show ip interface brief',
      'show ip': 'show ip interface brief',
      'show vlan': 'show vlan brief',
      'int gi': 'interface GigabitEthernet0/1',
      'int fa': 'interface FastEthernet0/2',
      'no sh': 'no shutdown',
      'sw acc': 'switchport access vlan 20',
      'switchport acc': 'switchport access vlan 20'
    };

    for (const [prefix, full] of Object.entries(suggestions)) {
      if (val.startsWith(prefix) && val !== full) {
        setInputVal(full);
        return;
      }
    }
  };

  const executeCommand = (cmd: string) => {
    const prompt = getPromptString();
    const newItems: TerminalHistoryItem[] = [{ type: 'input', text: `${prompt} ${cmd}` }];

    const lower = cmd.toLowerCase();

    if (!cmd) {
      setHistory(prev => [...prev, ...newItems]);
      return;
    }

    void infraBridge.execCommand('SW-ACC', cmd).then((res) => {
      if (res.source === 'live_cml') {
        setHistory(prev => [...prev, { type: 'system', text: res.output }]);
      }
    });

    // Common navigation / info commands
    if (lower === 'help' || lower === '?') {
      newItems.push({
        type: 'output',
        text: `Comandi disponibili:
  enable (en)               - Passa in modalità privilegiata
  configure terminal (conf t) - Entra in configurazione globale
  show ip interface brief   - Mostra lo stato delle porte
  show vlan brief           - Mostra lo stato delle VLAN
  interface <nome>          - Configura un'interfaccia (es. int gi0/1, int fa0/2)
  no shutdown (no shut)     - Accende l'interfaccia attiva
  switchport access vlan 20 - Assegna la VLAN 20
  exit / end                - Torna al livello precedente`
      });
    } else if (lower === 'enable' || lower === 'en') {
      if (mode === 'user') {
        setMode('privileged');
        newItems.push({ type: 'output', text: 'Password accettata. Modalità privilegiata attivata.' });
      } else {
        newItems.push({ type: 'output', text: 'Sei già in modalità privilegiata o superiore.' });
      }
    } else if (lower === 'configure terminal' || lower === 'conf t') {
      if (mode === 'privileged') {
        setMode('config');
        newItems.push({ type: 'output', text: 'Entering configuration mode terminal. End with CNTL/Z.' });
      } else if (mode === 'user') {
        newItems.push({ type: 'error', text: '% Accesso negato: esegui prima "enable".' });
      } else {
        newItems.push({ type: 'output', text: 'Sei già in configurazione.' });
      }
    } else if (lower === 'exit' || lower === 'end') {
      if (mode === 'config-if-gi01' || mode === 'config-if-fa02') {
        setMode('config');
        newItems.push({ type: 'output', text: 'Uscita dalla configurazione dell\'interfaccia.' });
      } else if (mode === 'config') {
        setMode('privileged');
        newItems.push({ type: 'output', text: 'Uscita dalla modalità di configurazione.' });
      } else if (mode === 'privileged') {
        setMode('user');
      }
    } else if (lower === 'show ip interface brief' || lower === 'sh ip int br' || lower === 'sh ip int brief') {
      newItems.push({
        type: 'output',
        text: `Interface              IP-Address      OK? Method Status                Protocol
GigabitEthernet0/1     unassigned      YES unset  ${gi01Up ? 'up                    up' : 'administratively down    down'}
FastEthernet0/1        192.168.10.1    YES NVRAM  up                    up
FastEthernet0/2        192.168.20.1    YES NVRAM  up                    up
Vlan1                  10.10.10.1      YES manual up                    up`
      });
    } else if (lower === 'show vlan brief' || lower === 'sh vlan brief' || lower === 'sh vlan') {
      newItems.push({
        type: 'output',
        text: `VLAN Name                             Status    Ports
---- -------------------------------- --------- -------------------------------
1    default                          active    Fa0/3, Fa0/4, Gi0/2 ${!fa02Vlan20 ? ', Fa0/2' : ''}
10   HR-Network                       active    Fa0/1
20   Dev-Network                      active    ${fa02Vlan20 ? 'Fa0/2' : ''}`
      });
    } else if (lower === 'interface gigabitethernet0/1' || lower === 'interface gigabitethernet 0/1' || lower === 'int gi0/1' || lower === 'int gi 0/1') {
      if (mode === 'config' || mode === 'config-if-gi01' || mode === 'config-if-fa02') {
        setMode('config-if-gi01');
        newItems.push({ type: 'output', text: 'Configuring Interface GigabitEthernet0/1...' });
      } else {
        newItems.push({ type: 'error', text: '% Comando invalido in questa modalità. Entra in "configure terminal".' });
      }
    } else if (lower === 'interface fastethernet0/2' || lower === 'interface fastethernet 0/2' || lower === 'int fa0/2' || lower === 'int fa 0/2') {
      if (mode === 'config' || mode === 'config-if-gi01' || mode === 'config-if-fa02') {
        setMode('config-if-fa02');
        newItems.push({ type: 'output', text: 'Configuring Interface FastEthernet0/2...' });
      } else {
        newItems.push({ type: 'error', text: '% Comando invalido in questa modalità. Entra in "configure terminal".' });
      }
    } else if (lower === 'no shutdown' || lower === 'no shut') {
      if (mode === 'config-if-gi01') {
        setGi01Up(true);
        newItems.push({
          type: 'success',
          text: `%LINK-3-UPDOWN: Interface GigabitEthernet0/1, changed state to up\n%LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet0/1, changed state to up`
        });
        checkWin(true, fa02Vlan20, newItems);
      } else if (mode === 'config-if-fa02') {
        newItems.push({ type: 'output', text: 'Interface FastEthernet0/2 era già accesa.' });
      } else {
        newItems.push({ type: 'error', text: '% Devi essere dentro la configurazione di un\'interfaccia.' });
      }
    } else if (lower === 'switchport access vlan 20' || lower === 'sw acc vlan 20') {
      if (mode === 'config-if-fa02') {
        setFa02Vlan20(true);
        newItems.push({
          type: 'success',
          text: `[OK] FastEthernet0/2 assegnata correttamente alla VLAN 20 (Dev-Network).`
        });
        checkWin(gi01Up, true, newItems);
      } else {
        newItems.push({ type: 'error', text: '% Comando valido solo su interfaccia di accesso (es. int fa0/2).' });
      }
    } else {
      sound.playError();
      newItems.push({
        type: 'error',
        text: `% Invalid input detected at '^' marker. Scrivi "help" per i comandi supportati.`
      });
    }

    setHistory(prev => [...prev, ...newItems]);
  };

  const checkWin = (isGiUp: boolean, isVlanAssigned: boolean, outQueue: TerminalHistoryItem[]) => {
    if (isGiUp && isVlanAssigned && !completed) {
      sound.playSuccess();
      setCompleted(true);
      outQueue.push({
        type: 'success',
        text: `\n======================================================
★ OBIETTIVO COMPLETATO! TICKET #9021 RISOLTO! ★
La porta Uplink Gi0/1 è UP e la VLAN 20 è configurata.
Tutti i pacchetti del dipartimento Dev ora transitano correttamente!
======================================================`
      });
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 }
      });
      onComplete();
    }
  };

  const handleVerifyNetAgent = async () => {
    sound.playClick();
    const playerCommands = history
      .filter((h) => h.type === 'input')
      .map((h) => h.text.replace(/^[^\s>#]+[>#]\s*/, '').trim())
      .filter(Boolean);
    setHistory(prev => [...prev, { type: 'system', text: '[netAgent] Confronto configurazione giocatore vs ideale...' }]);
    const res = await infraBridge.verifyMission('terminal', playerCommands);
    setHistory(prev => [
      ...prev,
      {
        type: res.passed ? 'success' : 'error',
        text: `[netAgent ${res.source}] Score: ${res.scorePct}% | OK: ${res.matched.length} | Mancanti: ${res.missing.join('; ') || 'Nessuno'}`,
      },
      ...(res.diffLines.length > 0
        ? [{ type: 'output' as const, text: `Diff ideale da applicare: ${res.diffLines.join(' | ')}` }]
        : []),
    ]);
  };

  const handleAskSecBot = async () => {
    sound.playClick();
    setHistory(prev => [...prev, { type: 'system', text: '[SecBot AI] Analisi del contesto CLI in corso...' }]);
    const res = await infraBridge.askMentorHint('terminal', `Mode=${mode}`);
    setHistory(prev => [
      ...prev,
      {
        type: 'success',
        text: `[SecBot ${res.source === 'live_ai' ? 'LIVE' : 'SIM'} - ${res.osiLayer}] ${res.hint} (Prova: ${res.suggestedCheck})`,
      },
    ]);
  };

  const handleReset = () => {
    sound.playClick();
    setMode('user');
    setGi01Up(false);
    setFa02Vlan20(false);
    setCompleted(false);
    setHistory([
      { type: 'system', text: 'Cisco IOS Software (Rebooted)...' },
      { type: 'output', text: 'Terminale riavviato. Scrivi "enable" per iniziare.' }
    ]);
  };

  return (
    <div className="min-h-[85vh] bg-slate-900/90 border-2 border-slate-700 rounded-xl p-4 sm:p-6 shadow-2xl relative flex flex-col justify-between">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { sound.playClick(); onBack(); }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-600 transition-colors text-sm font-semibold"
          >
            <ArrowLeft className="w-4 h-4" /> Torna all'Ufficio
          </button>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-emerald-400 flex items-center gap-2 font-mono">
              <TerminalIcon className="w-6 h-6 text-emerald-400" /> Postazione Admin: Cisco IOS CLI Emulator
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Risolvi l'outage di rete configurando lo switch via linea di comando Cisco IOS.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {completed && (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full text-xs font-semibold animate-pulse">
              <CheckCircle2 className="w-4 h-4" /> Switch Operativo al 100%!
            </span>
          )}
          <button
            onClick={handleVerifyNetAgent}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/50 transition-colors text-xs font-bold"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Verifica netAgent
          </button>
          <button
            onClick={handleAskSecBot}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/50 transition-colors text-xs font-bold"
          >
            <Sparkles className="w-3.5 h-3.5" /> Chiedi a SecBot (AI)
          </button>
          <button
            onClick={handleReset}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg border border-slate-700 transition"
            title="Reset Terminale"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main CRT Frame Container */}
      <div className="my-6 max-w-4xl mx-auto w-full grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Sticky Note Ticket Objective (on the bezel) */}
        <div className="lg:col-span-1 bg-amber-100 text-slate-900 p-4 rounded-md shadow-xl border-t-8 border-amber-400 transform -rotate-1 font-mono text-xs">
          <div className="font-bold text-sm text-red-700 border-b border-amber-300 pb-1 mb-2 flex items-center justify-between">
            <span>TICKET #9021</span>
            <span className="text-[10px] bg-red-200 px-1.5 py-0.5 rounded text-red-800 font-sans">CRITICO</span>
          </div>
          <p className="font-bold mb-2 text-slate-800">Guasto Switch Core:</p>
          <ul className="space-y-1.5 text-slate-700 leading-tight">
            <li className={gi01Up ? 'line-through text-emerald-700 font-bold' : ''}>
              1. <strong>Gi0/1 è spenta</strong>: dai <code>no shutdown</code> su <code>int gi0/1</code>.
            </li>
            <li className={fa02Vlan20 ? 'line-through text-emerald-700 font-bold' : ''}>
              2. <strong>Fa0/2 isolata</strong>: assegnala a <code>vlan 20</code> (Dev).
            </li>
          </ul>
          <div className="mt-3 pt-2 border-t border-amber-200 text-[11px] text-slate-600">
            <em>💡 Suggerimento:</em> Usa <code>en</code>, poi <code>conf t</code>, poi <code>int gi0/1</code> e <code>int fa0/2</code>!
          </div>
        </div>

        {/* CRT Curved Screen */}
        <div className="lg:col-span-3 bg-black border-8 border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl relative overflow-hidden crt-effect">
          {/* Scanline Animation Overlay */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent h-16 animate-crt-scan opacity-60"></div>

          {/* CRT Screen Bezel Info */}
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-emerald-950 font-retro text-sm text-emerald-600">
            <span>CISCO SYSTEM CONSOLE [VT100 EMULATION]</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span> 9600 8-N-1
            </span>
          </div>

          {/* Terminal Log Output */}
          <div className="h-80 overflow-y-auto font-retro text-base sm:text-lg text-emerald-400 space-y-1 pr-2">
            {history.map((item, idx) => (
              <div key={idx} className="leading-relaxed">
                {item.type === 'input' && (
                  <span className="text-emerald-300 font-bold">{item.text}</span>
                )}
                {item.type === 'output' && (
                  <span className="text-emerald-400 whitespace-pre-wrap">{item.text}</span>
                )}
                {item.type === 'system' && (
                  <span className="text-emerald-600 italic whitespace-pre-wrap">{item.text}</span>
                )}
                {item.type === 'error' && (
                  <span className="text-amber-400 font-semibold">{item.text}</span>
                )}
                {item.type === 'success' && (
                  <span className="text-emerald-200 font-bold whitespace-pre-wrap text-glow-green">{item.text}</span>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Interactive Command Line */}
          <div className="mt-3 pt-2 border-t border-emerald-900/50 flex items-center gap-2 font-retro text-lg text-emerald-300">
            <span className="select-none font-bold text-emerald-400">{getPromptString()}</span>
            <input
              ref={inputRef}
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent border-none outline-none font-retro text-lg sm:text-xl text-emerald-300 placeholder-emerald-900 caret-emerald-400"
              placeholder="Scrivi qui il comando Cisco (es. enable)..."
              autoFocus
              spellCheck={false}
            />
            <span className="w-2.5 h-5 bg-emerald-400 animate-blink"></span>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-slate-300">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>
            Supporto per i tasti <kbd className="px-1.5 py-0.5 bg-slate-700 rounded">Tab</kbd> (autocompletamento) e <kbd className="px-1.5 py-0.5 bg-slate-700 rounded">↑</kbd> <kbd className="px-1.5 py-0.5 bg-slate-700 rounded">↓</kbd> (cronologia comandi).
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
