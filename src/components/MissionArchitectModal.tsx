import React, { useState } from 'react';
import { Cpu, Network, Play, Server, Sparkles, X } from 'lucide-react';
import { GeneratedMissionResult, infraBridge } from '../utils/infraBridge';

interface MissionArchitectModalProps {
  open: boolean;
  onClose: () => void;
}

const PRESET_PROMPTS = [
  'Crea una missione Router-on-a-Stick con 2 VLAN (10 e 20), 1 switch ioll2-xe, 1 router iol-xe e 2 host alpine (uno in VLAN 10 e uno in VLAN 20), con la subinterface Gi0/0.20 mancante sul router',
  'Topologia 2 router iol-xe e 1 switch ioll2-xe con rotta statica mancante verso 192.168.30.0/24',
];

/**
 * Modal for generating network topologies and faulty/ideal mission configs
 * from natural-language prompts via Ollama + netAgent, with 1-click CML deploy.
 */
export const MissionArchitectModal: React.FC<MissionArchitectModalProps> = ({ open, onClose }) => {
  const [prompt, setPrompt] = useState(PRESET_PROMPTS[0]);
  const [deployToCml, setDeployToCml] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GeneratedMissionResult | null>(null);

  if (!open) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;
    setLoading(true);
    const res = await infraBridge.generateMissionTopology(prompt.trim(), deployToCml);
    setResult(res);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-slate-950 border border-slate-700 rounded-2xl shadow-2xl p-5 text-slate-200 font-mono text-xs max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-cisco-blue" />
            <h3 className="text-sm font-bold text-white">
              netAgent + Ollama: Mission & Topology Architect
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleGenerate} className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {PRESET_PROMPTS.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPrompt(p)}
                className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] text-cyan-300 text-left"
              >
                Preset {i + 1}
              </button>
            ))}
          </div>

          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
            placeholder="Descrivi la topologia CML e il guasto di missione..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
          />

          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={deployToCml}
                onChange={(e) => setDeployToCml(e.target.checked)}
                className="rounded border-slate-600"
              />
              Istanzia topologia su CML (`192.168.122.110`)
            </label>
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-cisco-blue to-cyan-500 hover:from-cyan-400 hover:to-cisco-blue text-slate-950 font-black disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {loading ? 'Generazione in corso...' : 'Genera & Deploy'}
            </button>
          </div>
        </form>

        {result && (
          <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                <Cpu className="w-4 h-4" /> {result.spec.mission_title}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                {result.source} · {result.latencyMs}ms · {result.spec.osi_layer}
              </span>
            </div>
            <p className="text-[11px] text-slate-300">{result.spec.description}</p>

            {result.cmlDeploy && (
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 text-cyan-300">
                  <Server className="w-3.5 h-3.5" />
                  CML Lab: <strong>{result.cmlDeploy.lab_title}</strong>
                </span>
                <span className={result.cmlDeploy.mode === 'live_cml' ? 'text-emerald-400' : 'text-amber-400'}>
                  {result.cmlDeploy.mode === 'live_cml'
                    ? `LIVE (${result.cmlDeploy.nodes_created} nodi, ${result.cmlDeploy.links_created} link)`
                    : 'SIM_FALLBACK'}
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {result.spec.nodes.map((n) => (
                <div key={n.label} className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{n.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300">{n.cml_def}</span>
                  </div>
                  {n.ideal_config.length > 0 && (
                    <pre className="text-[10px] text-emerald-300 bg-slate-950 p-1.5 rounded overflow-x-auto">
                      {n.ideal_config.join('\n')}
                    </pre>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <Play className="w-3 h-3 text-emerald-400" />
              Missione registrata in netAgent Verifier (`{result.spec.mission_id}`).
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
