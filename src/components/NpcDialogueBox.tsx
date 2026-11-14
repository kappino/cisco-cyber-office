import React from 'react';
import { ArrowRight, X } from 'lucide-react';
import { DialogueChoice, DialogueNode, getPortraitSrc } from '../data/fuoriReteDialogues';
import { sound } from '../utils/audio';

interface NpcDialogueBoxProps {
  /** Active NPC dialogue node to display. */
  dialogue: DialogueNode;
  /** Controlled input value for the live Ollama AI chat bar. */
  aiPrompt: string;
  /** True while waiting for Ollama /api/ai/interact response. */
  aiLoading: boolean;
  onAiPromptChange: (value: string) => void;
  onAskAiSubmit: (e: React.FormEvent) => void;
  onAskAiQuick: (question: string) => void;
  onSelectChoice: (choice: DialogueChoice) => void;
  onClose: () => void;
}

const QUICK_PROMPTS = ['Cosa devo fare ora?', 'Stato lab CML', 'Dammi un indizio'] as const;

/**
 * Reusable NPC dialogue panel with pixel-art portrait, branching choices,
 * 1-click quick prompts, and live Ollama AI chat input.
 */
export const NpcDialogueBox: React.FC<NpcDialogueBoxProps> = ({
  dialogue,
  aiPrompt,
  aiLoading,
  onAiPromptChange,
  onAskAiSubmit,
  onAskAiQuick,
  onSelectChoice,
  onClose,
}) => {
  return (
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
                onClick={() => {
                  sound.playClick();
                  onClose();
                }}
                className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-slate-800 transition"
                title="Chiudi messaggio"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 mt-1 leading-relaxed">{dialogue.text}</p>
          </div>
        </div>

        {!dialogue.choices && (
          <button
            onClick={() => {
              sound.playClick();
              sound.startBgm();
              onClose();
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
              onClick={() => onSelectChoice(choice)}
              className="text-left px-3 py-2 rounded-lg border border-cisco-blue/50 bg-slate-800/80 hover:bg-sky-950/60 hover:border-cyan-400 text-xs font-bold text-slate-100 transition flex items-center justify-between gap-2"
            >
              <span>{choice.label}</span>
              <ArrowRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* Quick-action AI prompts */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800">
        {QUICK_PROMPTS.map((q) => (
          <button
            key={q}
            type="button"
            disabled={aiLoading}
            onClick={() => onAskAiQuick(q)}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] text-cyan-300 font-semibold transition disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Live Ollama chat input (stops propagation so Phaser doesn't intercept WASD/E/Space) */}
      <form onSubmit={onAskAiSubmit} className="flex items-center gap-2">
        <input
          type="text"
          value={aiPrompt}
          onChange={(e) => onAiPromptChange(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
          }}
          onKeyUp={(e) => {
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
          }}
          placeholder={`Chiedi qualcosa a ${dialogue.speakerName} (Ollama gemma4:12b)...`}
          className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
        />
        <button
          type="submit"
          disabled={aiLoading || !aiPrompt.trim()}
          className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold transition shrink-0"
        >
          {aiLoading ? 'Penso...' : 'Chiedi AI'}
        </button>
      </form>
    </div>
  );
};
