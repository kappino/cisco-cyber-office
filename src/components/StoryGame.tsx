import { LiveTasks } from './LiveTasks';
import { PracticeConsole } from './PracticeConsole';
import { useEffect, useState } from 'react';
import { Building2, ClipboardList, Monitor, ArrowRight, BookOpen, CheckCircle2, MapPin, RotateCcw, Trophy, Volume2, VolumeX } from 'lucide-react';
import { PhaserGameContainer } from './PhaserGameContainer';
import { EventBus } from '../game/EventBus';
import { storyOffice } from '../data/storyOffice';
import { storyMissions } from '../data/storyMissions';
import { RoomId } from '../types/game';
import { sound } from '../utils/audio';
import './StoryGame.css';

export function StoryGame() {
  const [step, setStep] = useState(() => {
    try {
      const value = Number(localStorage.getItem('cozy-onboarding-v2-step') || 0);
      return Number.isInteger(value) && value >= 0 && value <= storyMissions.length ? value : 0;
    } catch { return 0; }
  });
  const [room, setRoom] = useState<RoomId>('office');
  const [answer, setAnswer] = useState<number | null>(null);
  const [live, setLive] = useState(false);
  const [notes, setNotes] = useState(false);
  const [talked, setTalked] = useState(false);
  const [inspected, setInspected] = useState(false);
  const [visitor, setVisitor] = useState('');
  const [saveUnavailable, setSaveUnavailable] = useState(false);
  const [muted, setMuted] = useState(sound.isMuted);
  const mission = storyMissions[Math.min(step, storyMissions.length - 1)];
  const badge = step === 0 ? 'Ospite' : step < 2 ? 'Neoassunto' : step < 3 ? 'Apprendista di rete' : step < 4 ? 'Osservatore SOC' : step < 6 ? 'Operatore laboratorio' : 'Tecnico di squadra';
  const complete = step === storyMissions.length;
  const correct = answer === mission.correct;
  useEffect(() => {
    try { localStorage.setItem('cozy-onboarding-v2-step', String(step)); setSaveUnavailable(false); }
    catch { setSaveUnavailable(true); }
  }, [step]);
  useEffect(() => { setRoom(mission.room); setAnswer(null); setInspected(false); setTalked(false); setVisitor(''); }, [mission]);
  useEffect(() => {
    if (live) return;
    const publish = () => {
      Object.entries(storyOffice).forEach(([roomId, data]) => EventBus.emit('SET_ROOM_DEVICES', { roomId, ...data, devices: data.devices.map(d => ({ ...d, linksUp: step > 0 ? d.linksTotal : d.linksUp })), racks: data.racks.map(r => ({ ...r, alert: step < 3 && r.alert })) }));
    };
    EventBus.on('SCENE_READY', publish);
    publish();
    return () => { EventBus.off('SCENE_READY', publish); };
  }, [step, live]);
  useEffect(() => {
    const openNotes = (name: string) => { setVisitor(name); setNotes(true); if (name === mission.colleague) setTalked(true); };
    EventBus.on('LEARNING_COLLEAGUE', openNotes);
    return () => { EventBus.off('LEARNING_COLLEAGUE', openNotes); };
  }, [mission.colleague]);
  const next = () => { if (!talked || !inspected || !correct) return; setStep(s => s + 1); setAnswer(null); EventBus.emit('TRIGGER_CELEBRATION'); };
  return <div className={`cozy-app ${live ? 'is-live' : ''}`} onFocusCapture={e => EventBus.emit('SET_INPUT_ENABLED', (e.target as HTMLElement).closest('.cozy-canvas') !== null)}>
    <a className="cozy-skip" href="#mission-desk">Vai alla missione</a><header className="cozy-header"><a href="#" className="cozy-brand"><span className="cozy-logo"><Building2 size={24} /></span><span>Fuori Rete<small>OFFICE STORIES / NETWORK LEARNING</small></span></a><div className="cozy-header-actions"><span className="cozy-mode">{live ? 'Laboratorio CML · azioni reali' : 'Storia locale · nessun lab connesso'}</span><button aria-label={muted ? 'Attiva audio' : 'Disattiva audio'} onClick={() => setMuted(sound.toggleMute())}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button></div></header>
    {saveUnavailable && <p className="cozy-save-notice" role="status">La partita continua normalmente. Il browser non consente di salvare i progressi su questo dispositivo.</p>}
    <main className="cozy-main">
      <div className="cozy-page-intro"><div><span className="cozy-eyebrow">LA TUA SCRIVANIA È PRONTA</span><h1>Un giorno ordinario.<br /><em>Quasi.</em></h1><p>Una rete da rimettere in piedi. Quattro colleghi.<br />Qualcuno ha toccato qualcosa. Naturalmente, nessuno sa niente.</p></div><div className="cozy-day-card"><ClipboardList size={22} /><div><strong>Il primo giorno</strong><span>6 incarichi · nessuna fretta</span></div><span className="cozy-day-count">{Math.min(step, storyMissions.length)}<small>/06</small></span></div></div>

      <section className="cozy-scene-card" aria-label="Ufficio esplorabile">
        <div className="cozy-scene-heading"><div><span className="cozy-eyebrow">PARTENOPE DIGITAL / PIANO OPERATIVO</span><h2>Il nostro piccolo ufficio</h2></div><span className="cozy-location"><MapPin size={15} />{room === 'office' ? 'Reception & caffetteria' : room === 'corridor' ? 'Studio di rete' : 'Sala collaudi'}</span></div>
        {live && <LiveTasks key={room} roomId={room} onClose={() => setLive(false)} />}
        <div style={live ? { display: 'none' } : undefined} className="cozy-canvas" tabIndex={0} aria-label="Scena di gioco: clicca per attivare movimento e interazioni" onPointerDown={e => { e.currentTarget.focus(); EventBus.emit('SET_INPUT_ENABLED', true); }}><PhaserGameContainer currentRoom={room} timePhase="morning" onChangeRoom={setRoom} onTriggerSpot={spot => { if (live && spot.cmlNode) { EventBus.emit('LIVE_OPEN_NODE', spot.cmlNode); return; } if (live && spot.cmlRack) { EventBus.emit('LIVE_OPEN_RACK', spot.cmlRack); return; } if (spot.targetRoom) setRoom(spot.targetRoom as RoomId); else if (spot.isCoffee) EventBus.emit('TRIGGER_COFFEE_BOOST'); else { if (talked) setInspected(true); setVisitor(spot.name); } }} /></div>
        <div className="cozy-scene-footer"><button disabled={step < 4} title={step < 4 ? 'Completa onboarding, rete e briefing SOC per ottenere il badge operativo' : 'Apri il laboratorio reale'} className="open-network-task" onClick={() => { if (step >= 4) setLive(true); }}>Apri armadio</button><p>Clicca il pavimento per camminare · WASD / frecce · Invio per interagire</p><nav aria-label="Esplora gli ambienti">{(['office', 'corridor', 'datacenter_vault'] as RoomId[]).map((r, i) => <button key={r} aria-pressed={room === r} onClick={() => setRoom(r)}>{['Reception', 'Studio di rete', 'Sala collaudi'][i]}</button>)}</nav></div>
      </section>
      <aside onFocusCapture={() => EventBus.emit('SET_INPUT_ENABLED', false)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget)) EventBus.emit('SET_INPUT_ENABLED', true); }} id="mission-desk" className="cozy-mission-card" aria-label="Diario delle missioni">
        <div className="cozy-progress-heading"><span className="cozy-eyebrow"><ClipboardList size={12} /> DOSSIER OPERATIVO</span><span>{Math.min(step, storyMissions.length)} / 6</span></div><div className="cozy-progress" role="progressbar" aria-label="Missioni completate" aria-valuenow={step} aria-valuemin={0} aria-valuemax={6}><span style={{ width: `${step / storyMissions.length * 100}%` }} /></div>
        {complete ? <div className="cozy-finale"><Trophy size={48} /><h2>Open day salvato!</h2><p>Sei incarichi completati, una squadra che può tornare al lavoro. Alessia ha già messo da parte una sfogliatella per te.</p><p>Hai imparato a osservare, isolare il guasto, correggere e verificare. È questo il lavoro di rete.</p><button className="cozy-primary" onClick={() => { setStep(0); setNotes(false); }}><RotateCcw size={16} />Rigioca la storia</button></div> : <>
          <div className="cozy-colleague"><span className={`cozy-avatar cozy-avatar-${mission.colleague.toLowerCase()}`}><span>{mission.colleague.slice(0, 1)}</span><i /></span><div><strong>{mission.colleague}</strong><small>{mission.role}</small></div><span className="cozy-chapter">CAP. {step + 1}</span></div>
          <div className="cozy-badge" role="status">Badge: {badge} · {step < 4 ? 'Formazione e osservazione' : 'Interventi nel laboratorio autorizzati'}</div><h2>{mission.title}</h2><button className="cozy-inspect" onClick={() => setTalked(true)}>{talked ? 'Briefing ricevuto' : `Parla con ${mission.colleague}`}</button>{talked && <p className="cozy-dialogue">{mission.intro}</p>}<div className="cozy-objective"><BookOpen size={18} /><p><strong>Cosa impari oggi</strong>{mission.objective}</p></div>
          <button disabled={!talked} className="cozy-inspect" onClick={() => { if (!talked) return; setRoom(mission.room); setInspected(true); }}> <MapPin size={16} />{inspected ? 'Rileggi il sopralluogo' : 'Esamina la postazione'}</button>
          {inspected && <div className="cozy-evidence"><span className="cozy-eyebrow">DAL TACCUINO DEL TEAM</span><p>{mission.evidence}</p></div>}
          <fieldset disabled={correct || !inspected}><legend>{inspected ? 'Come procedi?' : 'Prima raccogli gli indizi alla postazione.'}</legend>{mission.choices.map((choice, i) => <button key={choice} className={`cozy-choice ${answer === i ? correct ? 'is-correct' : 'is-incorrect' : ''}`} onClick={() => setAnswer(i)}><span>{String.fromCharCode(65 + i)}</span>{choice}</button>)}</fieldset>
          {answer !== null && <div className={`cozy-feedback ${correct ? 'is-correct' : ''}`} role="status"><strong>{correct ? 'Ottima diagnosi.' : 'Facciamo un passo indietro.'}</strong><p>{correct ? mission.explanation : 'Rileggi gli indizi: quale intervento risolve il sintomo osservato con il minor impatto sugli altri colleghi? Puoi riprovare senza penalità.'}</p></div>}
          {correct && <button className="cozy-primary" onClick={next}>{step === storyMissions.length - 1 ? 'Consegna il collaudo' : 'Prossimo incarico'}<ArrowRight size={17} /></button>}
        </>}
      </aside>
      <section className="cozy-notebook">{visitor && <p className="cozy-visitor" role="status"><strong>{visitor}</strong> · {visitor.includes(mission.colleague) ? mission.intro : 'Benvenuto nel team! Nel diario trovi il prossimo incarico. Le configurazioni sul taccuino sono solo esempi locali.'}</p>}<div><span className="cozy-eyebrow"><Monitor size={12} /> SPAZIO PERSONALE</span><h2>La bacheca del team</h2><p>Gli errori sono indizi, non penalità. Prenditi il tempo di capire.</p></div><ol>{storyMissions.map((m, i) => <li key={m.id} className={i <= step ? 'is-active' : ''}>{i < step ? <CheckCircle2 size={18} /> : <span className="cozy-number">{i + 1}</span>}<div><strong>{m.title}</strong><small>{m.colleague} · {i < step ? 'Completata' : i === step ? 'In corso' : 'Da scoprire'}</small></div></li>)}</ol><button onClick={() => setNotes(n => !n)}><BookOpen size={16} />{notes ? 'Chiudi appunti' : 'Configurazioni di esempio'}</button>{notes && <div className="cozy-config"><p>Solo appunti locali: nessun comando viene inviato a CML. Interfacce e VLAN sono esempi da adattare al laboratorio del team.</p><pre>{mission.configuration.join('\n')}</pre><button onClick={() => { const blob = new Blob([storyMissions.map(m => `! ${m.title}\n${m.configuration.join('\n')}`).join('\n\n')], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'fuori-rete-esempi.txt'; a.click(); URL.revokeObjectURL(url); }}>Scarica appunti</button></div>}<PracticeConsole /></section>
    </main><footer className="cozy-footer">Fuori Rete · Learning game 2D · Le missioni di questa storia sono simulate nel browser.</footer>
  </div>;
}
