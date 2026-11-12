import React from 'react';
import { sound } from '../utils/audio';
import { Badge } from '../types/game';
import { ArrowLeft, Trophy, CheckCircle2, Lock, Award } from 'lucide-react';

interface Props {
  badges: Badge[];
  onBack: () => void;
}

export const BadgeShowcase: React.FC<Props> = ({ badges, onBack }) => {
  const unlockedCount = badges.filter(b => b.unlocked).length;

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
            <h2 className="text-xl sm:text-2xl font-bold text-amber-400 flex items-center gap-2 font-mono">
              <Trophy className="w-6 h-6 text-amber-400" /> Bacheca Badge & Certificazioni Cisco
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Traguardi sbloccati risolvendo le missioni didattiche di rete e sicurezza.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono bg-amber-950/60 text-amber-300 border border-amber-500/40 px-3 py-1.5 rounded-lg">
          <Award className="w-4 h-4" /> Sbloccati: {unlockedCount} di {badges.length}
        </div>
      </div>

      {/* Grid of Badges */}
      <div className="my-8 max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-6">
        {badges.map((b) => (
          <div
            key={b.id}
            className={`p-5 rounded-xl border-2 transition-all flex items-start gap-4 ${
              b.unlocked
                ? 'bg-slate-950/80 border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/30'
                : 'bg-slate-950/40 border-slate-800 opacity-50'
            }`}
          >
            <div
              className={`w-16 h-16 rounded-xl flex items-center justify-center text-3xl shrink-0 border-2 ${
                b.unlocked
                  ? 'bg-amber-500/10 border-amber-400 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)] animate-pulse'
                  : 'bg-slate-900 border-slate-800 text-slate-600'
              }`}
            >
              {b.unlocked ? b.icon : <Lock className="w-6 h-6" />}
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-mono font-bold text-base text-white">{b.title}</h3>
                {b.unlocked ? (
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800 flex items-center gap-1 font-bold">
                    <CheckCircle2 className="w-3 h-3" /> ACQUISITO
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    BLOCCATO
                  </span>
                )}
              </div>
              <div className="text-xs text-amber-400/90 font-mono mb-2">{b.subtitle}</div>
              <p className="text-xs text-slate-400 font-mono leading-relaxed">{b.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer Info */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-slate-300">
        <div className="flex items-center gap-2">
          <span>
            {unlockedCount === badges.length
              ? '🎉 COMPLIMENTI! Hai ottenuto tutti i riconoscimenti del programma didattico Cisco!'
              : 'Completa tutte e 3 le missioni nella sala operativa per sbloccare l\'Attestato Cisco Elite Defender.'}
          </span>
        </div>
        <button
          onClick={() => { sound.playClick(); onBack(); }}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold transition shadow"
        >
          Chiudi Bacheca
        </button>
      </div>
    </div>
  );
};
