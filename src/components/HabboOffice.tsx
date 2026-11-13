import React, { useState, useEffect } from 'react';
import { sound } from '../utils/audio';
import { GameScreen, AvatarConfig, PlayerStats, RoomId } from '../types/game';
import { PhaserGameContainer } from './PhaserGameContainer';
import { InteractiveSpotData, TimePhase } from '../game/EventBus';
import {
  DialogueChoice,
  DialogueNode,
  buildNpcDialogue,
  getPortraitSrc
} from '../data/fuoriReteDialogues';
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
  Bot,
  Database,
  ArrowDownUp,
  Radar,
  DoorOpen,
  Sun,
  Sunset,
  Moon
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
  const [activeSpot, setActiveSpot] = useState<InteractiveSpotData | null>(null);
  const [targetSpotId, setTargetSpotId] = useState<string | null>(null);
  const [coffeeBoostTrigger, setCoffeeBoostTrigger] = useState<number>(0);
  const [timePhase, setTimePhase] = useState<TimePhase>('morning');
  const [reputation, setReputation] = useState<number>(50);

  useEffect(() => {
    const unsubscribe = sound.subscribeMute((isMuted) => {
      setMuted(isMuted);
    });
    return unsubscribe;
  }, []);

  const completedCount = [level1Done, level2Done, level3Done, level4Done].filter(Boolean).length;
  const progressPct = Math.round((completedCount / 4) * 100);

  const [dialogue, setDialogue] = useState<DialogueNode | null>(() => {
    if (completedCount === 0) {
      return buildNpcDialogue('rosaria', avatar.name, {
        level1Done,
        level2Done,
        level3Done,
        level4Done,
      });
    }
    return null;
  });

  const cycleTimePhase = () => {
    sound.playClick();
    setTimePhase((prev) => (prev === 'morning' ? 'sunset' : prev === 'sunset' ? 'night' : 'morning'));
  };

  const handleDialogueChoice = (choice: DialogueChoice) => {
    sound.playClick();
    sound.startBgm();
    setReputation((rep) => Math.max(0, Math.min(100, rep + choice.repDelta)));
    setDialogue((prev) =>
      prev
        ? {
            ...prev,
            mood: choice.replyMood,
            text: `${choice.reply} (${choice.repDelta >= 0 ? `+${choice.repDelta}` : choice.repDelta} Rep)`,
            choices: undefined,
          }
        : null
    );
  };

  const toggleSound = () => {
    const isNowMuted = sound.toggleMute();
    setMuted(isNowMuted);
  };

  const handleNpcClick = () => {
    sound.playClick();
    setDialogue(
      buildNpcDialogue('marco', avatar.name, { level1Done, level2Done, level3Done, level4Done })
    );
  };

  const handleCoffeeClick = () => {
    sound.playCoffee();
    onCoffeeBoost();
    setCoffeeBoostTrigger(k => k + 1);
    setActiveSpot(null);
    setDialogue({
      speaker: 'protagonist',
      speakerName: avatar.name,
      role: 'Pausa Napoletana',
      mood: 'satisfied',
      text: 'Espresso bollente e trancio di margherita! +40 XP guadagnati e velocità aumentata!',
    });
  };

  const handleSecBotClick = () => {
    sound.playClick();
    setDialogue(
      buildNpcDialogue('secbot', avatar.name, { level1Done, level2Done, level3Done, level4Done })
    );
  };

  const handleElevatorClick = (spot: InteractiveSpotData) => {
    sound.playElevator();
    const dest = spot.targetRoom || (currentRoom === 'office' ? 'datacenter_vault' : 'office');
    onRoomChange(dest as RoomId);
    setActiveSpot(null);
  };

  const handleTriggerSpot = (spot: InteractiveSpotData) => {
    if (spot.isElevator) {
      handleElevatorClick(spot);
    } else if (spot.isCoffee) {
      handleCoffeeClick();
    } else {
      sound.playClick();
      if (spot.screen) {
        onNavigate(spot.screen as GameScreen);
      } else if (spot.id === 'rosaria') {
        setDialogue(
          buildNpcDialogue('rosaria', avatar.name, { level1Done, level2Done, level3Done, level4Done })
        );
      } else if (spot.id === 'ciro') {
        setDialogue(
          buildNpcDialogue('ciro', avatar.name, { level1Done, level2Done, level3Done, level4Done })
        );
      } else if (spot.id === 'marco' || spot.isNpc) {
        handleNpcClick();
      } else if (spot.isBot) {
        handleSecBotClick();
      } else if (spot.id === 'firepower') {
        setDialogue({
          speaker: 'secbot',
          speakerName: 'Cisco Firepower 4100',
          role: 'NGFW Telemetry',
          mood: 'neutral',
          text: 'Throughput 35 Gbps operativo. Regole Snort 3 attive a protezione delle subnet critiche.',
        });
      } else if (spot.id === 'san_storage') {
        setDialogue({
          speaker: 'secbot',
          speakerName: 'Array Cisco UCS SAN',
          role: 'Storage Vault',
          mood: 'satisfied',
          text: '24 dischi NVMe in RAID 60. Volumi di backup NetCorp integri e crittografati con AES-256.',
        });
      } else if (spot.targetRoom) {
        sound.playElevator();
        onRoomChange(spot.targetRoom as RoomId);
        setActiveSpot(null);
      }
    }
  };

  const handleQuickWalk = (spotId: string) => {
    sound.playClick();
    setDialogue(null);
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
          {/* Reputation Pill */}
          <div
            className="hidden sm:flex items-center gap-1 px-2 py-1.5 bg-slate-800/90 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold"
            title="Reputazione Team Fuori Rete"
          >
            <span>Rep</span>
            <span className="font-black text-white">{reputation}</span>
          </div>

          {/* Time Phase Cycler */}
          <button
            onClick={cycleTimePhase}
            className="flex items-center gap-1 px-2 py-1.5 bg-slate-800/90 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold hover:bg-slate-800 transition shadow"
            title="Cambia Fase Oraria (Mattina / Tramonto / Notte)"
          >
            {timePhase === 'morning' ? (
              <Sun className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            ) : timePhase === 'sunset' ? (
              <Sunset className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
            )}
            <span className="hidden sm:inline">
              {timePhase === 'morning' ? 'Mattina' : timePhase === 'sunset' ? 'Tramonto' : 'Notte'}
            </span>
          </button>

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
                : (currentRoom as string) === 'corridor'
                ? 'NETCORP CISCO ACADEMY // CORRIDOIO OPERATIVO (1F)'
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

        {/* The Live Interactive Isometric Phaser 3 Canvas */}
        <div className="w-full max-w-4xl relative">
          <PhaserGameContainer
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
            celebrationTrigger={completedCount === 4 ? 1 : 0}
            timePhase={timePhase}
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10.5px] sm:text-[11px] font-bold">
              <button
                onClick={() => handleQuickWalk('rosaria')}
                className={`flex items-center justify-center gap-1 min-h-[38px] py-1.5 px-1.5 rounded-lg border transition ${
                  activeSpot?.id === 'rosaria'
                    ? 'bg-cisco-blue/30 text-cyan-300 border-cisco-blue ring-1 ring-cisco-blue'
                    : 'border-cisco-blue/40 bg-slate-800/80 text-cisco-blue hover:bg-sky-950/40'
                }`}
              >
                <User className="w-3 h-3 shrink-0" />
                <span className="truncate">Rosaria</span>
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
                onClick={() => handleQuickWalk('door_corridor')}
                className={`flex items-center justify-center gap-1 min-h-[38px] py-1.5 px-1.5 rounded-lg border transition ${
                  activeSpot?.id === 'door_corridor'
                    ? 'bg-cyan-500/30 text-cyan-300 border-cyan-400 ring-1 ring-cyan-400'
                    : 'border-cyan-500/40 bg-slate-800/80 text-cyan-300 hover:bg-sky-950/40'
                }`}
              >
                <DoorOpen className="w-3 h-3 shrink-0 text-cyan-400" />
                <span className="truncate">Corridoio (1F)</span>
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
          ) : currentRoom === 'corridor' ? (
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
                <span className="truncate">Rack SW1</span>
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
                onClick={() => handleQuickWalk('ciro')}
                className={`flex items-center justify-center gap-1 min-h-[38px] py-1.5 px-1.5 rounded-lg border transition ${
                  activeSpot?.id === 'ciro'
                    ? 'bg-cisco-blue/30 text-cyan-300 border-cisco-blue ring-1 ring-cisco-blue'
                    : 'border-cisco-blue/40 bg-slate-800/80 text-cisco-blue hover:bg-sky-950/40'
                }`}
              >
                <User className="w-3 h-3 shrink-0" />
                <span className="truncate">Ciro</span>
              </button>

              <button
                onClick={() => handleQuickWalk('door_entrance')}
                className={`flex items-center justify-center gap-1 min-h-[38px] py-1.5 px-1.5 rounded-lg border transition ${
                  activeSpot?.id === 'door_entrance'
                    ? 'bg-cyan-500/30 text-cyan-300 border-cyan-400 ring-1 ring-cyan-400'
                    : 'border-cyan-500/40 bg-slate-800/80 text-cyan-300 hover:bg-sky-950/40'
                }`}
              >
                <DoorOpen className="w-3 h-3 shrink-0 text-cyan-400" />
                <span className="truncate">Ingresso (1F)</span>
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
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5 text-[10.5px] sm:text-[11px] font-bold">
              <button
                onClick={() => handleQuickWalk('wireshark')}
                className={`flex items-center justify-center gap-1 min-h-[38px] py-1.5 px-1 rounded-lg border transition ${
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
                className={`flex items-center justify-center gap-1 min-h-[38px] py-1.5 px-1 rounded-lg border transition ${
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
                className={`flex items-center justify-center gap-1 min-h-[38px] py-1.5 px-1 rounded-lg border transition ${
                  activeSpot?.id === 'san_storage'
                    ? 'bg-cyan-500/30 text-cyan-300 border-cyan-400 ring-1 ring-cyan-400'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800'
                }`}
              >
                <Database className="w-3 h-3 text-cyan-400 shrink-0" />
                <span className="truncate">UCS SAN</span>
              </button>

              <button
                onClick={() => handleQuickWalk('marco')}
                className={`flex items-center justify-center gap-1 min-h-[38px] py-1.5 px-1 rounded-lg border transition ${
                  activeSpot?.id === 'marco'
                    ? 'bg-cisco-blue/30 text-cyan-300 border-cisco-blue ring-1 ring-cisco-blue'
                    : 'border-cisco-blue/40 bg-slate-800/80 text-cisco-blue hover:bg-sky-950/40'
                }`}
              >
                <User className="w-3 h-3 shrink-0" />
                <span className="truncate">Marco</span>
              </button>

              <button
                onClick={() => handleQuickWalk('secbot')}
                className={`flex items-center justify-center gap-1 min-h-[38px] py-1.5 px-1 rounded-lg border transition ${
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
                className={`flex items-center justify-center gap-1 min-h-[38px] py-1.5 px-1 rounded-lg border transition ${
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
        {activeSpot ? (
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
                {(activeSpot.id === 'rosaria' || activeSpot.id === 'ciro' || activeSpot.id === 'marco') && (
                  <User className="w-5 h-5 text-cisco-blue" />
                )}
                {activeSpot.isElevator && <ArrowDownUp className="w-5 h-5 text-cyan-400" />}
                {activeSpot.id.startsWith('door_') && <DoorOpen className="w-5 h-5 text-cyan-400" />}
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
                    : activeSpot.id === 'rosaria'
                      ? 'PARLA CON ROSARIA'
                      : activeSpot.id === 'ciro'
                        ? 'PARLA CON CIRO'
                        : activeSpot.id === 'marco'
                          ? 'PARLA CON MARCO'
                          : activeSpot.isBot
                            ? 'INTERROGA SECBOT AI'
                            : activeSpot.screen === 'wireshark'
                              ? 'APRI CONSOLE WIRESHARK DPI'
                              : activeSpot.screen
                                ? 'ENTRA NELLA MISSIONE'
                                : activeSpot.actionText || 'INTERAGISCI'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : dialogue ? (
          /* NPC DIALOGUE VIEW WITH PORTRAIT & CHOICES */
          <div className="bg-slate-900 border-2 border-cisco-blue rounded-xl p-3 sm:p-4 shadow-2xl animate-fade-in flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <img
                  src={getPortraitSrc(dialogue.speaker, dialogue.mood)}
                  alt={`${dialogue.speakerName} (${dialogue.mood})`}
                  className="w-16 h-16 rounded-xl border-2 border-cisco-blue bg-slate-950 object-contain shrink-0"
                  style={{ imageRendering: 'pixelated' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black text-cisco-blue uppercase tracking-wider">
                      {dialogue.speakerName} // {dialogue.role}
                    </span>
                    <button
                      onClick={() => { sound.playClick(); setDialogue(null); }}
                      className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-slate-800 transition"
                      title="Chiudi messaggio"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-200 mt-1 leading-relaxed">
                    {dialogue.text}
                  </p>
                </div>
              </div>
              {!dialogue.choices && (
                <button
                  onClick={() => {
                    sound.playClick();
                    sound.startBgm();
                    setDialogue(null);
                  }}
                  className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-cisco-blue to-cyan-500 hover:from-cyan-400 hover:to-cisco-blue text-slate-950 font-black text-xs rounded-lg shadow-lg flex items-center justify-center gap-1.5 transition active:scale-95 shrink-0"
                >
                  <span>HO CAPITO!</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {dialogue.choices && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {dialogue.choices.map((choice, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleDialogueChoice(choice)}
                    className="text-left px-3 py-2 rounded-lg border border-cisco-blue/50 bg-slate-800/80 hover:bg-sky-950/60 hover:border-cyan-400 text-xs font-bold text-slate-100 transition flex items-center justify-between gap-2"
                  >
                    <span>{choice.label}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* FREE ROAMING STATUS */
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-2.5 text-center text-xs text-slate-400">
            <span>
              {currentRoom === 'office'
                ? 'Stai esplorando l\'Ufficio Panoramico. Prendi l\'ascensore per scendere nel Datacenter (-1F) o passa nel corridoio operativo.'
                : (currentRoom as string) === 'corridor'
                ? 'Sei nel Corridoio Operativo. Ispeziona il Rack Catalyst 9300 (SW1) o parla con Ciro.'
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
