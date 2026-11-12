import React, { useState, useEffect } from 'react';
import { sound } from '../utils/audio';
import { GameScreen, AvatarConfig, PlayerStats, RoomId } from '../types/game';
import { IsometricOfficeCanvas, InteractiveSpot } from './IsometricOfficeCanvas';
import { 
  Trophy, 
  Volume2, 
  VolumeX, 
  X,
  Compass,
  RotateCcw,
  User,
  Award,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Coffee,
  Shield,
  Terminal,
  Server,
  MessageSquare,
  Bot,
  Database,
  ArrowDownUp,
  Radar
} from 'lucide-react';

interface Props {
  avatar: AvatarConfig;
  stats: PlayerStats;
  currentRoom: RoomId;
  onRoomChange: (room: RoomId) => void;
  level1Done: boolean;
  level2Done: boolean;
  level3Done: boolean;
  level4Done: boolean;
  onNavigate: (screen: GameScreen) => void;
  onOpenCustomizer: () => void;
  onOpenSkills: () => void;
  onReset: () => void;
  onCoffeeBoost: () => void;
}

export const HabboOffice: React.FC<Props> = ({
  avatar,
  stats,
  currentRoom,
  onRoomChange,
  level1Done,
  level2Done,
  level3Done,
  level4Done,
  onNavigate,
  onOpenCustomizer,
  onOpenSkills,
  onReset,
  onCoffeeBoost
}) => {
  const [muted, setMuted] = useState<boolean>(() => sound.isMuted);
  const [activeSpot, setActiveSpot] = useState<InteractiveSpot | null>(null);
  const [targetSpotId, setTargetSpotId] = useState<string | null>(null);
  const [coffeeBoostTrigger, setCoffeeBoostTrigger] = useState<number>(0);

  useEffect(() => {
    const unsubscribe = sound.subscribeMute((isMuted) => {
      setMuted(isMuted);
    });
    return unsubscribe;
  }, []);

  const completedCount = [level1Done, level2Done, level3Done, level4Done].filter(Boolean).length;
  const progressPct = Math.round((completedCount / 4) * 100);

  const [npcDialogue, setNpcDialogue] = useState<string | null>(() => {
    if (completedCount === 0) {
      return `Ciao ${avatar.name}! Sono Marco, il Senior NetAdmin. Abbiamo un disastro in corso: il cablaggio è saltato, lo switch è in loop e c'è un ransomware attivo. Cammina verso le postazioni per intervenire!`;
    }
    return null;
  });

  const toggleSound = () => {
    const isNowMuted = sound.toggleMute();
    setMuted(isNowMuted);
  };

  const handleNpcClick = () => {
    sound.playClick();
    if (completedCount === 4) {
      setNpcDialogue(`INCREDIBILE ${avatar.name}! Hai completato tutte e 4 le missioni compreso il Deep Packet Inspection! Sei un Cisco Elite Ninja. La giuria di Consorzio Clara sarà entusiasta!`);
    } else if (!level1Done) {
      setNpcDialogue("Consiglio da collega: inizia dal Rack Datacenter in alto a sinistra. Dobbiamo rimettere i cavi RJ45 tra il patch panel e lo switch prima che i telefoni e i PC smettano di funzionare!");
    } else if (!level2Done) {
      setNpcDialogue("I cavi ci sono, ma la console dà errore! Siediti alla postazione PC Admin. Devi entrare in 'enable', poi 'conf t' e accendere l'interfaccia Gi0/1 con 'no shutdown'!");
    } else if (!level3Done) {
      setNpcDialogue("Guarda il monitor SOC in fondo. Cisco Umbrella ha intercettato un malware che fa beaconing via DNS. Isola l'endpoint prima che infetti il server file!");
    } else {
      setNpcDialogue("Ottimo lavoro ai piani alti! Ora prendi l'ascensore industriale a destra e scendi nel Datacenter Sotterraneo (-1F). C'è un'esfiltrazione dati segreta da analizzare con Wireshark!");
    }
  };

  const handleCoffeeClick = () => {
    sound.playCoffee();
    onCoffeeBoost();
    setCoffeeBoostTrigger(k => k + 1);
    setActiveSpot(null);
    setNpcDialogue("Pausa Napoletana: Ti sei gustato una tazza di espresso bollente e una fetta di pizza margherita! +40 XP guadagnati e velocità aumentata!");
  };

  const handleSecBotClick = () => {
    sound.playClick();
    setNpcDialogue("SecBot Sentinel AI: 'Temperatura rack 19.5°C nel corridoio freddo. Telemetria SPAN attiva su porta Gi0/48. Traffico anomalo ad alta entropia rilevato sulla console Wireshark DPI!'");
  };

  const handleElevatorClick = (spot: InteractiveSpot) => {
    sound.playElevator();
    const dest = spot.targetRoom || (currentRoom === 'office' ? 'datacenter_vault' : 'office');
    onRoomChange(dest);
    setActiveSpot(null);
  };

  const handleTriggerSpot = (spot: InteractiveSpot) => {
    if (spot.isElevator) {
      handleElevatorClick(spot);
    } else if (spot.isCoffee) {
      handleCoffeeClick();
    } else {
      sound.playClick();
      if (spot.screen) {
        onNavigate(spot.screen);
      } else if (spot.isNpc) {
        handleNpcClick();
      } else if (spot.isBot) {
        handleSecBotClick();
      } else if (spot.id === 'firepower') {
        setNpcDialogue("Cisco Firepower 4100 NGFW: Throughput 35 Gbps operativo. Regole Snort 3 attive. Motore euristico a protezione delle subnet critiche.");
      } else if (spot.id === 'san_storage') {
        setNpcDialogue("Array Cisco UCS SAN: 24 dischi NVMe in RAID 60. Volumi di backup NetCorp integri e crittografati con AES-256.");
      }
    }
  };

  const handleQuickWalk = (spotId: string) => {
    sound.playClick();
    setNpcDialogue(null);
    setTargetSpotId(spotId);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 border-0 sm:border-4 border-slate-800 rounded-none sm:rounded-2xl shadow-2xl relative overflow-x-hidden select-none font-mono">
      {/* Top Retro HUD Bar */}
      <header className="bg-slate-900/95 backdrop-blur border-b-2 border-slate-700/80 px-3 sm:px-4 py-2 flex items-center justify-between gap-2 z-20 sticky top-0">
        {/* Left: Player Profile & Quick Customizer */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { sound.playClick(); onOpenCustomizer(); }}
            className="group relative w-10 h-10 rounded-xl border-2 border-cisco-blue/80 bg-slate-950 hover:border-cyan-400 transition flex flex-col items-center justify-center shadow hover:scale-105 shrink-0"
            title="Personalizza Avatar"
          >
            <User className="w-5 h-5 text-cisco-blue group-hover:text-cyan-300 transition" />
            <span className="text-[7.5px] font-black text-cisco-blue group-hover:text-cyan-300 uppercase leading-none mt-0.5">EDIT</span>
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs sm:text-sm font-bold text-white tracking-wide truncate">{avatar.name}</span>
              <span className="text-[9.5px] bg-cisco-blue/20 text-cisco-blue border border-cisco-blue/50 px-1.5 py-0.2 rounded font-black shrink-0">
                Lv.{stats.level}
              </span>
            </div>
            {/* XP progress bar */}
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-16 sm:w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.round((stats.xp / stats.xpNextLevel) * 100))}%` }}
                />
              </div>
              <span className="text-[8.5px] sm:text-[9px] text-amber-400 font-bold shrink-0">
                {stats.xp}/{stats.xpNextLevel} XP
              </span>
            </div>
          </div>
        </div>

        {/* Right: RPG Controls & Progress */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Skill Tree Button */}
          <button
            onClick={() => { sound.playClick(); onOpenSkills(); }}
            className="flex items-center gap-1 px-2 py-1.5 bg-indigo-950/80 text-indigo-300 border border-indigo-500/50 rounded-lg text-xs font-bold hover:bg-indigo-900 transition shadow"
            title="Albero Abilità RPG"
          >
            <Award className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="hidden xs:inline">Skill</span>
            {stats.skillPoints > 0 && (
              <span className="min-w-4 h-4 px-1 rounded-full bg-amber-400 text-slate-950 font-black text-[9px] flex items-center justify-center animate-bounce">
                {stats.skillPoints}
              </span>
            )}
          </button>

          {/* Badges Trophy Button */}
          <button
            onClick={() => { sound.playClick(); onNavigate('badges'); }}
            className="flex items-center gap-1 px-2 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/50 rounded-lg text-xs font-bold hover:bg-amber-500/30 transition shadow"
            title="Bacheca Badge e Obiettivi"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="hidden xs:inline">Badge</span>
            <span className="text-[10px] text-amber-200">({completedCount}/4)</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className={`p-1.5 rounded-lg border transition ${
              muted ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-cisco-blue/20 text-cisco-blue border-cisco-blue/50'
            }`}
            title={muted ? 'Attiva Audio' : 'Muta Audio'}
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          {/* Reset Button */}
          <button
            onClick={onReset}
            className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:text-red-400 hover:border-red-500/50 transition"
            title="Azzera progressi"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Isometric Room Container */}
      <main className="flex flex-col items-center justify-start p-2 sm:p-3 bg-[#0d121f]">
        {/* Room Title Header */}
        <div className="w-full max-w-4xl flex items-center justify-between pb-1 mb-1.5 border-b border-slate-800 text-[10.5px] sm:text-xs text-slate-400">
          <div className="flex items-center gap-1.5 font-bold tracking-wider">
            <Compass className="w-3.5 h-3.5 text-cisco-blue" />
            <span className="text-white">
              {currentRoom === 'office' 
                ? 'NETCORP CISCO ACADEMY // UFFICIO OPERATIVO (1F)' 
                : 'NETCORP CYBER VAULT // UNDERGROUND DATACENTER (-1F)'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 hidden xs:inline">Progresso Rete:</span>
            <span className={`font-black ${completedCount === 4 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {progressPct}% ({completedCount}/4 Missioni)
            </span>
          </div>
        </div>

        {/* The Live Interactive Isometric Canvas */}
        <div className="w-full max-w-4xl relative">
          <IsometricOfficeCanvas
            avatar={avatar}
            stats={stats}
            currentRoom={currentRoom}
            level1Done={level1Done}
            level2Done={level2Done}
            level3Done={level3Done}
            level4Done={level4Done}
            activeSpot={activeSpot}
            setActiveSpot={setActiveSpot}
            onTriggerSpot={handleTriggerSpot}
            onChangeRoom={onRoomChange}
            targetSpotId={targetSpotId}
            onClearTargetSpot={() => setTargetSpotId(null)}
            coffeeBoostTrigger={coffeeBoostTrigger}
          />
        </div>
      </main>

      {/* UNIFIED ACTION DOCK: ALWAYS CLEAN, INTUITIVE & NON-OVERLAPPING */}
      <section className="w-full max-w-4xl mx-auto px-2 sm:px-3 pb-3 z-30 font-mono flex flex-col gap-2">
        {/* Permanent Quick Station Navigation Bar */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2 shadow-lg">
          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5 px-0.5">
            <span className="flex items-center gap-1 font-bold text-slate-300">
              <Sparkles className="w-3 h-3 text-cisco-blue" />
              <span>POSTAZIONI RAPIDE (Tocca per raggiungere):</span>
            </span>
            <span className="text-slate-500 hidden sm:inline">oppure tocca il pavimento per camminare</span>
          </div>

          {/* Quick buttons based on current room */}
          {currentRoom === 'office' ? (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-[10.5px] sm:text-[11px] font-bold">
              <button
                onClick={() => handleQuickWalk('rack')}
                className={`flex items-center justify-center gap-1 min-h-[38px] py-1.5 px-1.5 rounded-lg border transition ${
                  activeSpot?.id === 'rack'
                    ? 'bg-amber-500/30 text-amber-300 border-amber-400 ring-1 ring-amber-400'
                    : level1Done 
                      ? 'bg-slate-800/80 text-emerald-400 border-emerald-500/40 hover:bg-slate-800' 
                      : 'bg-slate-800/80 text-amber-300 border-amber-500/40 hover:bg-amber-950/40'
                }`}
              >
                <Server className="w-3 h-3 shrink-0" />
                <span className="truncate">Rack 9300</span>
                {level1Done && <span className="text-[9px] text-emerald-400">✓</span>}
              </button>

              <button
                onClick={() => handleQuickWalk('terminal')}
                className={`flex items-center justify-center gap-1 min-h-[38px] py-1.5 px-1.5 rounded-lg border transition ${
                  activeSpot?.id === 'terminal'
                    ? 'bg-amber-500/30 text-amber-300 border-amber-400 ring-1 ring-amber-400'
                    : level2Done 
                      ? 'bg-slate-800/80 text-emerald-400 border-emerald-500/40 hover:bg-slate-800' 
                      : 'bg-slate-800/80 text-amber-300 border-amber-500/40 hover:bg-amber-950/40'
                }`}
              >
                <Terminal className="w-3 h-3 shrink-0" />
                <span className="truncate">CLI Admin</span>
                {level2Done && <span className="text-[9px] text-emerald-400">✓</span>}
              </button>

              <button
                onClick={() => handleQuickWalk('umbrella')}
                className={`flex items-center justify-center gap-1 min-h-[38px] py-1.5 px-1.5 rounded-lg border transition ${
                  activeSpot?.id === 'umbrella'
                    ? 'bg-amber-500/30 text-amber-300 border-amber-400 ring-1 ring-amber-400'
                    : level3Done 
                      ? 'bg-slate-800/80 text-emerald-400 border-emerald-500/40 hover:bg-slate-800' 
                      : 'bg-slate-800/80 text-amber-300 border-amber-500/40 hover:bg-amber-950/40'
                }`}
              >
                <Shield className="w-3 h-3 shrink-0" />
                <span className="truncate">SOC Wall</span>
                {level3Done && <span className="text-[9px] text-emerald-400">✓</span>}
              </button>

              <button
                onClick={() => handleQuickWalk('coffee')}
                className={`flex items-center justify-center gap-1 min-h-[38px] py-1.5 px-1.5 rounded-lg border transition ${
                  activeSpot?.id === 'coffee'
                    ? 'bg-amber-500/30 text-amber-300 border-amber-400 ring-1 ring-amber-400'
                    : 'border-amber-500/30 bg-slate-800/80 text-amber-200 hover:bg-amber-950/40'
                }`}
              >
                <Coffee className="w-3 h-3 shrink-0" />
                <span className="truncate">Bar & Pizza</span>
              </button>

              <button
                onClick={() => handleQuickWalk('marco')}
                className={`flex items-center justify-center gap-1 min-h-[38px] py-1.5 px-1.5 rounded-lg border transition ${
                  activeSpot?.id === 'marco'
                    ? 'bg-cisco-blue/30 text-cyan-300 border-cisco-blue ring-1 ring-cisco-blue'
                    : 'border-cisco-blue/40 bg-slate-800/80 text-cisco-blue hover:bg-sky-950/40'
                }`}
              >
                <User className="w-3 h-3 shrink-0" />
                <span className="truncate">Marco</span>
              </button>

              <button
                onClick={() => handleQuickWalk('elevator_down')}
                className={`flex items-center justify-center gap-1 min-h-[38px] py-1.5 px-1.5 rounded-lg border transition ${
                  activeSpot?.id === 'elevator_down'
                    ? 'bg-cyan-500/30 text-cyan-300 border-cyan-400 ring-1 ring-cyan-400'
                    : 'border-cyan-500/40 bg-slate-800/80 text-cyan-300 hover:bg-sky-950/40'
                }`}
              >
                <ArrowDownUp className="w-3 h-3 shrink-0 text-cyan-400" />
                <span className="truncate">Piano -1</span>
              </button>
            </div>
          ) : (
            /* Datacenter Vault buttons */
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-[10.5px] sm:text-[11px] font-bold">
              <button
                onClick={() => handleQuickWalk('wireshark')}
                className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg border transition ${
                  activeSpot?.id === 'wireshark'
                    ? 'bg-cyan-500/30 text-cyan-300 border-cyan-400 ring-1 ring-cyan-400'
                    : level4Done 
                      ? 'bg-slate-800/80 text-emerald-400 border-emerald-500/40 hover:bg-slate-800' 
                      : 'bg-slate-800/80 text-cyan-300 border-cyan-500/40 hover:bg-sky-950/40'
                }`}
              >
                <Radar className="w-3 h-3 text-cyan-400 shrink-0" />
                <span className="truncate">Wireshark DPI</span>
                {level4Done && <span className="text-[9px] text-emerald-400">✓</span>}
              </button>

              <button
                onClick={() => handleQuickWalk('firepower')}
                className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg border transition ${
                  activeSpot?.id === 'firepower'
                    ? 'bg-amber-500/30 text-amber-300 border-amber-400 ring-1 ring-amber-400'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800'
                }`}
              >
                <Shield className="w-3 h-3 text-red-400 shrink-0" />
                <span className="truncate">Firepower 4100</span>
              </button>

              <button
                onClick={() => handleQuickWalk('san_storage')}
                className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg border transition ${
                  activeSpot?.id === 'san_storage'
                    ? 'bg-cyan-500/30 text-cyan-300 border-cyan-400 ring-1 ring-cyan-400'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800'
                }`}
              >
                <Database className="w-3 h-3 text-cyan-400 shrink-0" />
                <span className="truncate">UCS SAN</span>
              </button>

              <button
                onClick={() => handleQuickWalk('secbot')}
                className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg border transition ${
                  activeSpot?.id === 'secbot'
                    ? 'bg-emerald-500/30 text-emerald-300 border-emerald-400 ring-1 ring-emerald-400'
                    : 'bg-slate-800/80 text-emerald-300 border-emerald-500/40 hover:bg-slate-800'
                }`}
              >
                <Bot className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="truncate">SecBot AI</span>
              </button>

              <button
                onClick={() => handleQuickWalk('elevator_up')}
                className={`flex items-center justify-center gap-1 min-h-[38px] py-1.5 px-1 rounded-lg border transition col-span-2 sm:col-span-1 ${
                  activeSpot?.id === 'elevator_up'
                    ? 'bg-amber-500/30 text-amber-300 border-amber-400 ring-1 ring-amber-400'
                    : 'border-amber-500/40 bg-slate-800/80 text-amber-300 hover:bg-amber-950/40'
                }`}
              >
                <ArrowDownUp className="w-3 h-3 shrink-0 text-amber-400" />
                <span className="truncate">Ascensore (1F)</span>
              </button>
            </div>
          )}
        </div>

        {/* Contextual Action Card */}
        {activeSpot && activeSpot.id !== 'marco' ? (
          /* ACTIVE STATION VIEW */
          <div className="bg-slate-900 border-2 border-amber-400 rounded-xl p-3 sm:p-4 shadow-2xl animate-fade-in flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-amber-400/20 border border-amber-400 flex items-center justify-center shrink-0">
                {activeSpot.id === 'rack' && <Server className="w-5 h-5 text-amber-400" />}
                {activeSpot.id === 'terminal' && <Terminal className="w-5 h-5 text-amber-400" />}
                {activeSpot.id === 'umbrella' && <Shield className="w-5 h-5 text-amber-400" />}
                {activeSpot.id === 'coffee' && <Coffee className="w-5 h-5 text-amber-400" />}
                {activeSpot.id === 'wireshark' && <Radar className="w-5 h-5 text-cyan-400" />}
                {activeSpot.id === 'firepower' && <Shield className="w-5 h-5 text-red-400" />}
                {activeSpot.id === 'san_storage' && <Database className="w-5 h-5 text-cyan-400" />}
                {activeSpot.id === 'secbot' && <Bot className="w-5 h-5 text-emerald-400" />}
                {activeSpot.isElevator && <ArrowDownUp className="w-5 h-5 text-cyan-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xs sm:text-sm font-black text-white">{activeSpot.name}</h3>
                  <span className="text-[8.5px] bg-amber-400/20 text-amber-300 border border-amber-400/40 px-1.5 py-0.2 rounded font-bold uppercase">
                    {activeSpot.tag}
                  </span>
                  {activeSpot.completed && (
                    <span className="text-[8.5px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.2 rounded font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> FATTO
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  {activeSpot.desc}
                </p>
              </div>
            </div>

            <button
              onClick={() => handleTriggerSpot(activeSpot)}
              className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-amber-300 hover:to-yellow-200 text-slate-950 font-black text-xs sm:text-sm rounded-lg shadow-lg flex items-center justify-center gap-2 transition active:scale-95 shrink-0"
            >
              <span>
                {activeSpot.isElevator
                  ? activeSpot.targetRoom === 'datacenter_vault'
                    ? 'SCENDI AL DATACENTER (-1F)'
                    : 'RISALI ALL\'UFFICIO (1F)'
                  : activeSpot.isCoffee
                    ? 'PRENDI ESPRESSO & PIZZA'
                    : activeSpot.isBot
                      ? 'INTERROGA SECBOT AI'
                      : activeSpot.screen === 'wireshark'
                        ? 'APRI CONSOLE WIRESHARK DPI'
                        : 'ENTRA NELLA MISSIONE'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : npcDialogue ? (
          /* NPC DIALOGUE VIEW */
          <div className="bg-slate-900 border-2 border-cisco-blue rounded-xl p-3 sm:p-4 shadow-2xl animate-fade-in flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-cisco-blue/20 border border-cisco-blue flex items-center justify-center shrink-0">
                <MessageSquare className="w-5 h-5 text-cisco-blue" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-cisco-blue uppercase tracking-wider">
                    COMUNICAZIONE // NETADMIN
                  </span>
                  <button
                    onClick={() => { sound.playClick(); setNpcDialogue(null); }}
                    className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-slate-800 transition sm:hidden"
                    title="Chiudi messaggio"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs sm:text-sm text-slate-200 mt-1 leading-relaxed">
                  {npcDialogue}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                sound.playClick();
                sound.startBgm();
                setNpcDialogue(null);
              }}
              className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-cisco-blue to-cyan-500 hover:from-cyan-400 hover:to-cisco-blue text-slate-950 font-black text-xs rounded-lg shadow-lg flex items-center justify-center gap-1.5 transition active:scale-95 shrink-0"
            >
              <span>HO CAPITO!</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : activeSpot && activeSpot.id === 'marco' ? (
          /* MARCO STANDING PROMPT */
          <div className="bg-slate-900 border-2 border-cisco-blue rounded-xl p-3 sm:p-4 shadow-2xl animate-fade-in flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-cisco-blue/20 border border-cisco-blue flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-cisco-blue" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-black text-white">Marco (Senior NetAdmin)</h3>
                  <span className="text-[8.5px] bg-cisco-blue/20 text-cyan-300 border border-cisco-blue/40 px-1.5 py-0.2 rounded font-bold uppercase">
                    MENTOR CISCO
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Chiedi consigli tecnici sulle missioni e sul cablaggio di rete.
                </p>
              </div>
            </div>
            <button
              onClick={handleNpcClick}
              className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-cisco-blue to-cyan-500 hover:from-cyan-400 hover:to-cisco-blue text-slate-950 font-black text-xs sm:text-sm rounded-lg shadow-lg flex items-center justify-center gap-2 transition active:scale-95 shrink-0"
            >
              <span>PARLA CON MARCO</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* FREE ROAMING STATUS */
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-2.5 text-center text-xs text-slate-400">
            <span>
              {currentRoom === 'office'
                ? 'Stai esplorando l\'Ufficio Panoramico. Prendi l\'ascensore per scendere nel Datacenter (-1F).'
                : 'Sei nell\'Underground Datacenter. Ispeziona la console Wireshark DPI o risali con l\'ascensore.'}
            </span>
          </div>
        )}
      </section>

      {/* Clean Bottom Footer */}
      <footer className="mt-auto bg-slate-900 border-t border-slate-800 px-3 sm:px-4 py-1.5 flex flex-wrap items-center justify-between text-[9.5px] sm:text-[10px] font-mono text-slate-500 z-20">
        <div>The Big Hack 2026 // Challenge 04: Consorzio Clara & Cisco</div>
        <button
          onClick={() => { sound.playClick(); onOpenCustomizer(); }}
          className="hover:text-cisco-blue transition flex items-center gap-1 text-slate-400"
        >
          <User className="w-3 h-3" /> Skin Avatar
        </button>
      </footer>
    </div>
  );
};
