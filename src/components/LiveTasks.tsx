import { PortDiagnosisTask } from './PortDiagnosisTask';
import { useEffect, useRef, useState } from 'react';
import { Cable, ClipboardCheck, Terminal, X } from 'lucide-react';
import { useRoomNetwork } from '../utils/useRoomNetwork';
import { RackView } from './RackView';
import { StatefulConsole } from './StatefulConsole';
import { EventBus } from '../game/EventBus';
import { infraBridge, RoomVerify } from '../utils/infraBridge';

/** Mounted only after explicit activation: all nodes, cables and results come from CML. */
export function LiveTasks({ roomId, onClose }: { roomId: string; onClose: () => void }) {
  const panel = useRef<HTMLElement>(null);
  const { topology, publish, offline } = useRoomNetwork(roomId);
  const [task, setTask] = useState<'patch' | 'diagnosis' | 'console' | 'verify' | null>('patch');
  const [rack, setRack] = useState('');
  const [node, setNode] = useState('');
  const [result, setResult] = useState<RoomVerify | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { EventBus.emit('SET_INPUT_ENABLED', false); return () => { EventBus.emit('SET_INPUT_ENABLED', true); }; }, []);
  useEffect(() => {
    EventBus.emit('SET_ROOM_DEVICES', { roomId, devices: [], racks: [] });
  }, [roomId]);
  useEffect(() => {
    const openNode = (label: string) => {
      if (topology?.devices.some(d => d.label === label && d.console)) { setNode(label); setTask('console'); }
    };
    const openRack = (id: string) => {
      if (topology?.racks.some(r => r.id === id)) { setRack(id); setTask('patch'); }
    };
    EventBus.on('LIVE_OPEN_NODE', openNode); EventBus.on('LIVE_OPEN_RACK', openRack);
    return () => { EventBus.off('LIVE_OPEN_NODE', openNode); EventBus.off('LIVE_OPEN_RACK', openRack); };
  }, [topology]);
  useEffect(() => {
    panel.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }, [task]);
  useEffect(() => { if (!rack && topology?.racks[0]) setRack(topology.racks[0].id); }, [topology, rack]);
  const ready = !offline && topology?.status.phase === 'ready';
  async function verify() {
    setTask('verify'); setBusy(true); setError(''); setResult(null);
    try {
      const response = await infraBridge.verifyRoom(roomId);
      if (response.data) { setResult(response.data); if (response.data.ok) EventBus.emit('TRIGGER_CELEBRATION'); }
      else setError(response.error || 'Collaudo non disponibile');
    } finally { setBusy(false); }
  }
  return <section ref={panel} className="live-tasks" aria-label="Task CML live">
    <header><div><span className="cozy-eyebrow">LABORATORIO REALE · {roomId}</span><h2>Banco di rete</h2></div><button onClick={onClose} aria-label="Chiudi laboratorio"><X size={18} /> Torna in ufficio</button></header>
    <p>Una task alla volta: collega, osserva, configura, collauda. Queste azioni modificano il laboratorio CML della stanza.</p>
    <p role="status">{offline ? 'Backend non raggiungibile. Le task sono sospese; riprovo automaticamente. Puoi chiudere il laboratorio e continuare la storia.' : !topology ? 'Connessione al backend: in attesa della topologia reale…' : ready ? `${topology.devices.length} nodi · laboratorio pronto` : `${topology.status.phase}: ${topology.status.message || 'Avvio del laboratorio in corso'}`}</p>
    {topology?.error && <p role="alert">{topology.error}</p>}
    <div className="live-task-grid">
      <button disabled={!ready || busy} onClick={() => { setTask('patch'); setRack(topology?.racks[0]?.id || ''); }}><Cable /><strong>Armadio di rete</strong><small>Patch panel, porte e LED degli switch reali</small></button>
      <button disabled={!ready || busy} onClick={() => setTask('diagnosis')}><Cable /><strong>Stato delle porte</strong><small>Osserva porte e VLAN prima di intervenire</small></button>
      <button disabled={!ready || busy} onClick={() => setTask('console')}><Terminal /><strong>Terminale</strong><small>Console persistente del dispositivo selezionato</small></button>
      <button disabled={!ready || busy} onClick={() => void verify()}><ClipboardCheck /><strong>Collaudo</strong><small>Confronta la configurazione con l’obiettivo reale</small></button>
    </div>
    {task === 'patch' && <div><p>Scegli l’armadio, seleziona un connettore e poi la porta di destinazione. La stessa porta due volte scollega il cavo. Il LED può restare ambra durante STP.</p><select aria-label="Armadio CML" value={rack} onChange={e => setRack(e.target.value)}><option value="">Scegli armadio</option>{topology?.racks.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select>{!topology?.racks.length && <p>Questa topologia non espone armadi.</p>}</div>}
    {task === 'patch' && rack && <RackView embedded roomId={roomId} rackId={rack} topology={topology} onTopology={publish} onClose={() => setTask(null)} />}
    {task === 'diagnosis' && <PortDiagnosisTask roomId={roomId} />}
    {task === 'console' && <div><label>Nodo reale <select aria-label="Nodo CML" value={node} onChange={e => setNode(e.target.value)}><option value="">Scegli dispositivo</option>{topology?.devices.filter(d => d.console).map(d => <option key={d.label} value={d.label}>{d.label} · {d.cml_def}</option>)}</select></label>{node && <StatefulConsole key={node} roomId={roomId} node={node} />}</div>}
    {busy && <p role="status">Gaia sta verificando le configurazioni e i percorsi reali…</p>}{error && <p role="alert">{error}</p>}
    {result && <div className="live-verification" role="status"><h3>{result.ok ? 'Task completate · collaudo superato' : 'Qualcosa manca: continuiamo la diagnosi'}</h3>{result.devices.map(d => <article key={d.node}><strong>{d.ok ? 'Superato' : 'Da correggere'} · {d.node}</strong>{d.error && <p>{d.error}</p>}{Object.entries({ 'Ordine ACL': d.acl_ok, 'Persistenza startup-config': d.persistence_ok, 'Accesso remoto': d.ssh_telnet_ok }).filter(([,v]) => v !== undefined).map(([label, ok]) => <p key={label}>{ok ? 'Superato' : 'Da correggere'} · {label}</p>)}{d.missing.map((line,i) => <pre key={i}>Manca: {line.section} / {line.line}</pre>)}{d.extra.map((line,i) => <pre key={i}>In eccesso: {line.section} / {line.line}</pre>)}</article>)}{result.checks.map((c,i) => <p key={i}>{c.ok ? 'Superato' : 'Da correggere'} · {c.label}: {c.detail}</p>)}</div>}
  </section>;
}
