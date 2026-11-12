import React from 'react';
import { PlayerStats, RpgSkills } from '../types/game';
import { sound } from '../utils/audio';
import { X, Award, Zap, Terminal, Shield, Coffee, Plus, Sparkles } from 'lucide-react';

interface Props {
  stats: PlayerStats;
  onUpgradeSkill: (skillKey: keyof RpgSkills) => void;
  onClose: () => void;
}

export const RpgSkillModal: React.FC<Props> = ({ stats, onUpgradeSkill, onClose }) => {
  const xpPercent = Math.min(100, Math.round((stats.xp / stats.xpNextLevel) * 100));

  const SKILLS_CONFIG: Array<{
    key: keyof RpgSkills;
    title: string;
    levelName: string;
    desc: string;
    icon: React.ReactNode;
    color: string;
  }> = [
    {
      key: 'cablingSpeed',
      title: 'Cabling & Latch Mastery',
      levelName: 'Layer 1-2 Hardware',
      desc: 'Migliora la destrezza nel cablaggio strutturato CAT6A e la sensibilità di aggancio delle porte Cisco.',
      icon: <Zap className="w-5 h-5 text-amber-400" />,
      color: 'border-amber-500/50 bg-amber-500/10 text-amber-400',
    },
    {
      key: 'cliMastery',
      title: 'Cisco IOS CLI Ninja',
      levelName: 'Layer 3 Routing & VLAN',
      desc: 'Velocità di digitazione ed esecuzione dei comandi Cisco IOS. Aumenta i punti XP guadagnati per ticket.',
      icon: <Terminal className="w-5 h-5 text-emerald-400" />,
      color: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400',
    },
    {
      key: 'threatHunting',
      title: 'Umbrella Threat Hunter',
      levelName: 'Layer 7 Cloud Security',
      desc: 'Sensibilità di rilevamento euristiche DNS Cisco Talos. Intercetta prima i domini ransomware C2 beaconing.',
      icon: <Shield className="w-5 h-5 text-cisco-blue" />,
      color: 'border-cisco-blue/50 bg-cisco-blue/10 text-cisco-blue',
    },
    {
      key: 'caffeineEndurance',
      title: 'Caffeine Endurance',
      levelName: 'Stamina & Velocità',
      desc: 'Aumenta la velocità di movimento del personaggio nei corridoi dell\'ufficio (+20% per livello).',
      icon: <Coffee className="w-5 h-5 text-orange-400" />,
      color: 'border-orange-500/50 bg-orange-500/10 text-orange-400',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in font-mono">
      <div className="bg-slate-900 border-4 border-amber-500/60 rounded-2xl p-6 max-w-2xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-700">
          <div className="flex items-center gap-2 text-lg font-bold text-white">
            <Award className="w-6 h-6 text-amber-400" /> Albero Skill RPG & Livello
          </div>
          <button
            onClick={() => { sound.playClick(); onClose(); }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Level & XP Overview */}
        <div className="bg-slate-950 border-2 border-slate-800 rounded-xl p-4 my-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 flex flex-col items-center justify-center text-slate-950 font-black shadow-lg">
              <span className="text-[10px] uppercase tracking-wider font-bold">Livello</span>
              <span className="text-2xl">{stats.level}</span>
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                Esperienza Totale: <span className="text-amber-400">{stats.xp} XP</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Prossimo livello a {stats.xpNextLevel} XP
              </p>
              {/* XP Progress Bar */}
              <div className="w-48 sm:w-64 h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700 mt-2">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-yellow-300 transition-all duration-300"
                  style={{ width: `${xpPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Skill Points available */}
          <div className="text-center sm:text-right bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Punti Skill Disponibili</span>
            <span className="text-2xl font-black text-amber-400 flex items-center justify-center sm:justify-end gap-1">
              <Sparkles className="w-5 h-5 animate-pulse" /> {stats.skillPoints}
            </span>
          </div>
        </div>

        {/* Skill Trees Grid */}
        <div className="space-y-3 my-4">
          {SKILLS_CONFIG.map((sk) => {
            const currentVal = stats.skills[sk.key];
            const canUpgrade = stats.skillPoints > 0 && currentVal < 5;

            return (
              <div
                key={sk.key}
                className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between gap-4 hover:border-slate-700 transition"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-lg border ${sk.color}`}>
                    {sk.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-xs sm:text-sm text-white">{sk.title}</h4>
                      <span className="text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                        {sk.levelName}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-md leading-relaxed">{sk.desc}</p>
                    
                    {/* Star Level Indicator (0/5) */}
                    <div className="flex items-center gap-1 mt-2">
                      {[1, 2, 3, 4, 5].map((lvl) => (
                        <div
                          key={lvl}
                          className={`w-4 h-2 rounded-sm transition-all ${
                            lvl <= currentVal
                              ? 'bg-amber-400 shadow-[0_0_6px_#fbbf24]'
                              : 'bg-slate-800'
                          }`}
                        />
                      ))}
                      <span className="text-[10px] text-slate-400 font-bold ml-1.5">{currentVal}/5</span>
                    </div>
                  </div>
                </div>

                {/* Upgrade Button */}
                <button
                  onClick={() => {
                    if (canUpgrade) {
                      sound.playSuccess();
                      onUpgradeSkill(sk.key);
                    } else {
                      sound.playError();
                    }
                  }}
                  disabled={!canUpgrade}
                  className={`p-2 rounded-lg font-bold text-xs flex items-center gap-1 transition shrink-0 ${
                    canUpgrade
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md'
                      : 'bg-slate-800/80 text-slate-600 border border-slate-800 cursor-not-allowed'
                  }`}
                  title={canUpgrade ? 'Migliora Skill' : currentVal >= 5 ? 'Livello Max Raggiunto' : 'Punti skill insufficienti'}
                >
                  <Plus className="w-4 h-4" /> Potenzia
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs text-slate-400">
          <span>💡 Completa i minigiochi e risolvi i ticket di rete per guadagnare altri XP!</span>
          <button
            onClick={() => { sound.playClick(); onClose(); }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold transition"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
