import React from 'react';
import { AvatarConfig } from '../types/game';
import { sound } from '../utils/audio';
import { X, Check, User } from 'lucide-react';

interface Props {
  config: AvatarConfig;
  onSave: (newConfig: AvatarConfig) => void;
  onClose: () => void;
}

const SKIN_TONES = [
  { label: 'Chiara', color: '#ffd1b3' },
  { label: 'Media', color: '#dca180' },
  { label: 'Scura', color: '#8a5332' },
  { label: 'Cyber', color: '#a5f3fc' },
];

const HAIR_COLORS = [
  { label: 'Nero', color: '#171717' },
  { label: 'Castano', color: '#573318' },
  { label: 'Biondo', color: '#eab308' },
  { label: 'Rosso', color: '#dc2626' },
  { label: 'Ciano Cyber', color: '#00bceb' },
  { label: 'Viola', color: '#a855f7' },
];

const SHIRT_COLORS = [
  { label: 'Cisco Blue', color: '#00bceb' },
  { label: 'Navy Blue', color: '#0d274d' },
  { label: 'Cyber Red', color: '#e2231a' },
  { label: 'Matrix Green', color: '#10b981' },
  { label: 'Dark Slate', color: '#334155' },
  { label: 'Neon Yellow', color: '#fbab18' },
];

const TITLES = [
  'Junior NetAdmin',
  'Cyber Sentinel',
  'Cisco Apprentice',
  'Packet Tracer Master',
  'Security SOC Analyst',
];

export const AvatarCustomizerModal: React.FC<Props> = ({ config, onSave, onClose }) => {
  const [tempConfig, setTempConfig] = React.useState<AvatarConfig>({ ...config });

  const handleSave = () => {
    sound.playSuccess();
    onSave(tempConfig);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in font-mono">
      <div className="bg-slate-900 border-4 border-cisco-blue/60 rounded-2xl p-6 max-w-2xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-700">
          <div className="flex items-center gap-2 text-lg font-bold text-white">
            <User className="w-5 h-5 text-cisco-blue" /> Personalizza il tuo Avatar Habbo
          </div>
          <button
            onClick={() => { sound.playClick(); onClose(); }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-6 items-center">
          {/* Avatar Preview Box (Habbo Style Pixel Render) */}
          <div className="flex flex-col items-center justify-center p-6 bg-slate-950 border-2 border-slate-800 rounded-xl shadow-inner relative overflow-hidden">
            <div className="absolute top-2 left-2 text-[10px] text-slate-500 font-bold uppercase">
              Anteprima PG
            </div>

            {/* Render Habbo Avatar via SVG */}
            <div className="w-36 h-48 relative flex items-center justify-center my-2">
              <svg viewBox="0 0 100 140" className="w-full h-full drop-shadow-[0_8px_16px_rgba(0,188,235,0.25)]">
                {/* Shadow */}
                <ellipse cx="50" cy="130" rx="26" ry="7" fill="rgba(0,0,0,0.4)" />

                {/* Shoes */}
                <rect x="36" y="118" width="12" height="8" rx="2" fill="#1e293b" />
                <rect x="52" y="118" width="12" height="8" rx="2" fill="#1e293b" />

                {/* Legs / Pants */}
                <rect x="38" y="90" width="10" height="30" rx="1" fill={tempConfig.pantsColor} />
                <rect x="52" y="90" width="10" height="30" rx="1" fill={tempConfig.pantsColor} />

                {/* Torso / Shirt */}
                <rect x="34" y="55" width="32" height="38" rx="4" fill={tempConfig.shirtColor} />
                {/* Collar/Details */}
                <path d="M 44 55 L 50 64 L 56 55" fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.6" />
                <circle cx="50" cy="72" r="3" fill="#ffffff" opacity="0.8" />

                {/* Arms */}
                <rect x="27" y="58" width="7" height="28" rx="2" fill={tempConfig.shirtColor} />
                <rect x="66" y="58" width="7" height="28" rx="2" fill={tempConfig.shirtColor} />
                {/* Hands */}
                <circle cx="30.5" cy="89" r="4" fill={tempConfig.skinTone} />
                <circle cx="69.5" cy="89" r="4" fill={tempConfig.skinTone} />

                {/* Head / Face */}
                <rect x="36" y="24" width="28" height="32" rx="6" fill={tempConfig.skinTone} />
                {/* Eyes */}
                <rect x="42" y="36" width="3" height="4" fill="#0f172a" />
                <rect x="55" y="36" width="3" height="4" fill="#0f172a" />
                {/* Smile */}
                <path d="M 46 47 Q 50 50 54 47" fill="none" stroke="#0f172a" strokeWidth="1.5" />

                {/* Hair Styles */}
                {tempConfig.hairStyle === 'short' && (
                  <path d="M 34 26 C 34 16, 66 16, 66 26 C 66 22, 60 18, 50 18 C 40 18, 34 22, 34 26 Z" fill={tempConfig.hairColor} />
                )}
                {tempConfig.hairStyle === 'spiky' && (
                  <path d="M 33 26 L 37 14 L 43 22 L 49 11 L 55 22 L 62 14 L 67 26 Z" fill={tempConfig.hairColor} />
                )}
                {tempConfig.hairStyle === 'curly' && (
                  <path d="M 33 26 C 30 18, 42 12, 50 13 C 58 12, 70 18, 67 26 C 71 28, 69 35, 65 37 C 62 40, 38 40, 35 37 Z" fill={tempConfig.hairColor} />
                )}
                {tempConfig.hairStyle === 'cyber' && (
                  <g>
                    <path d="M 34 26 L 40 10 L 66 26 Z" fill={tempConfig.hairColor} />
                    <rect x="38" y="16" width="24" height="4" fill="#00bceb" />
                  </g>
                )}

                {/* Accessories */}
                {tempConfig.accessory === 'glasses' && (
                  <g stroke="#0f172a" strokeWidth="1.5" fill="rgba(255,255,255,0.4)">
                    <rect x="40" y="33" width="8" height="7" rx="1" />
                    <rect x="52" y="33" width="8" height="7" rx="1" />
                    <line x1="48" y1="36" x2="52" y2="36" />
                  </g>
                )}
                {tempConfig.accessory === 'cyber-visor' && (
                  <rect x="38" y="33" width="24" height="7" rx="2" fill="#00bceb" opacity="0.8" />
                )}
                {tempConfig.accessory === 'headset' && (
                  <g stroke="#38bdf8" strokeWidth="2" fill="none">
                    <path d="M 34 38 C 34 16, 66 16, 66 38" />
                    <rect x="32" y="35" width="4" height="8" rx="1" fill="#38bdf8" />
                    <rect x="64" y="35" width="4" height="8" rx="1" fill="#38bdf8" />
                  </g>
                )}
                {tempConfig.accessory === 'cisco-lanyard' && (
                  <path d="M 44 55 L 50 78 L 56 55" fill="none" stroke="#00bceb" strokeWidth="2.5" />
                )}
              </svg>
            </div>

            {/* Nametag & Title */}
            <div className="mt-2 text-center">
              <div className="font-bold text-xs text-white bg-slate-900 border border-slate-700 px-3 py-1 rounded-md shadow">
                {tempConfig.name || 'Senza Nome'}
              </div>
              <div className="text-[10px] text-cisco-blue font-semibold mt-1">
                {tempConfig.title}
              </div>
            </div>
          </div>

          {/* Configuration Form Controls */}
          <div className="md:col-span-2 space-y-4">
            {/* Name & Title */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1">Nome Personaggio:</label>
                <input
                  type="text"
                  maxLength={16}
                  value={tempConfig.name}
                  onChange={(e) => setTempConfig({ ...tempConfig, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cisco-blue"
                  placeholder="Es. MarioNet"
                />
              </div>
              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1">Titolo RPG:</label>
                <select
                  value={tempConfig.title}
                  onChange={(e) => setTempConfig({ ...tempConfig, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cisco-blue"
                >
                  {TITLES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Skin Tone */}
            <div>
              <label className="text-xs text-slate-300 font-bold block mb-1">Carnagione:</label>
              <div className="flex gap-2">
                {SKIN_TONES.map((s) => (
                  <button
                    key={s.color}
                    onClick={() => { sound.playClick(); setTempConfig({ ...tempConfig, skinTone: s.color }); }}
                    className={`w-7 h-7 rounded-full border-2 transition ${
                      tempConfig.skinTone === s.color ? 'border-white scale-110 shadow-lg' : 'border-slate-800'
                    }`}
                    style={{ backgroundColor: s.color }}
                    title={s.label}
                  />
                ))}
              </div>
            </div>

            {/* Hair Style & Color */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1">Taglio Capelli:</label>
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  {(['short', 'spiky', 'curly', 'cyber'] as const).map((style) => (
                    <button
                      key={style}
                      onClick={() => { sound.playClick(); setTempConfig({ ...tempConfig, hairStyle: style }); }}
                      className={`p-1.5 rounded border text-center uppercase ${
                        tempConfig.hairStyle === style
                          ? 'bg-cisco-blue text-slate-950 font-bold border-cisco-blue'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1">Colore Capelli:</label>
                <div className="flex flex-wrap gap-2">
                  {HAIR_COLORS.map((h) => (
                    <button
                      key={h.color}
                      onClick={() => { sound.playClick(); setTempConfig({ ...tempConfig, hairColor: h.color }); }}
                      className={`w-6 h-6 rounded-full border-2 transition ${
                        tempConfig.hairColor === h.color ? 'border-white scale-110 shadow-lg' : 'border-slate-800'
                      }`}
                      style={{ backgroundColor: h.color }}
                      title={h.label}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Shirt Color & Accessory */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1">Colore Maglia:</label>
                <div className="flex flex-wrap gap-2">
                  {SHIRT_COLORS.map((sc) => (
                    <button
                      key={sc.color}
                      onClick={() => { sound.playClick(); setTempConfig({ ...tempConfig, shirtColor: sc.color }); }}
                      className={`w-6 h-6 rounded-full border-2 transition ${
                        tempConfig.shirtColor === sc.color ? 'border-white scale-110 shadow-lg' : 'border-slate-800'
                      }`}
                      style={{ backgroundColor: sc.color }}
                      title={sc.label}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1">Accessorio:</label>
                <select
                  value={tempConfig.accessory}
                  onChange={(e) => setTempConfig({ ...tempConfig, accessory: e.target.value as AvatarConfig['accessory'] })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cisco-blue"
                >
                  <option value="none">Nessuno</option>
                  <option value="glasses">Occhiali Nerd</option>
                  <option value="cyber-visor">Visore Cyberpunk</option>
                  <option value="headset">Cuffie / Headset</option>
                  <option value="cisco-lanyard">Laccetto Cisco</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            onClick={() => { sound.playClick(); onClose(); }}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
          >
            Annulla
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-cisco-blue hover:bg-sky-400 text-slate-950 text-xs font-bold transition shadow-lg"
          >
            <Check className="w-4 h-4" /> Salva Avatar
          </button>
        </div>
      </div>
    </div>
  );
};
