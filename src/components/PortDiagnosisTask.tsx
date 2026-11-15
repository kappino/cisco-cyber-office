import { useEffect, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { infraBridge, PortLed, RoomPorts } from '../utils/infraBridge';

function isPort(value: unknown): value is PortLed {
  return !!value && typeof value === 'object' && 'led' in value && 'status' in value;
}
const explanations: Record<string, string> = {
  off: 'Il link non risulta attivo. Controlla cavo, apparato remoto e stato amministrativo.',
  green: 'Link operativo. Un LED verde non garantisce VLAN, routing o servizi corretti.',
  green_blink: 'Link operativo con attività rilevata. Il traffico non prova la raggiungibilità della destinazione.',
  amber: 'La porta può essere in convergenza STP o in uno stato di attenzione. Leggi lo stato prima di intervenire.',
  amber_blink: 'Possibile blocco STP: verifica il ruolo della porta e la topologia. Non disabilitare STP per aggirare il sintomo.',
  green_amber: 'Possibili errori sul link. Esamina contatori e configurazione dell’interfaccia.',
};
export function PortDiagnosisTask({ roomId }: { roomId: string }) {
  const [ports, setPorts] = useState<RoomPorts | null>(null);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const data = await infraBridge.getRoomPorts(roomId, true);
      if (!alive) return;
      setPorts(data); setError(data ? '' : 'Lettura non disponibile: nessun LED viene inventato.');
      timer = setTimeout(tick, 8000);
    };
    void tick();
    return () => { alive = false; clearTimeout(timer); };
  }, [roomId, refresh]);
  const items = Object.entries(ports?.ports || {}).flatMap(([node, values]) => Object.entries(values).filter(([,v]) => isPort(v)).map(([iface,v]) => ({ node, iface, port: v as PortLed, stale: !!values._stale, inUse: !!values._console_in_use })));
  const active = items.find(p => `${p.node}/${p.iface}` === selected);
  return <div className="port-diagnosis"><div className="port-task-heading"><Activity size={20} /><h3>Trova il segnale</h3><button onClick={() => setRefresh(n => n + 1)} aria-label="Rileggi LED"><RefreshCw size={16} /></button></div><p>Seleziona una porta e confronta il LED con stato e VLAN. Raccogli un indizio prima di cambiare cavi o configurazione.</p>{error && <p role="status">{error}</p>}{ports && !ports.ready && <p>Il laboratorio non è ancora pronto per leggere le porte.</p>}<div className="port-task-grid">{items.map(({ node, iface, port, stale, inUse }) => <button key={`${node}/${iface}`} aria-pressed={selected === `${node}/${iface}`} onClick={() => setSelected(`${node}/${iface}`)}><span className={`port-led led-${stale ? 'off' : port.led}`} /><strong>{node}</strong><span>{iface}</span><small>{stale ? 'Dato precedente' : inUse ? 'Ultima lettura · console in uso' : port.status}</small></button>)}</div>{!items.length && ports?.ready && <p>Nessuna lettura di porta disponibile per questa stanza.</p>}{active && <article className="port-task-explanation" role="status"><h4>{active.node} · {active.iface}</h4><p>Stato: {active.port.status} · VLAN: {active.port.vlan || 'non riportata'}</p><p>{active.stale ? 'Il dato è obsoleto: attendi una lettura aggiornata prima della diagnosi.' : explanations[active.port.led] || 'Stato non riconosciuto: consulta la console del dispositivo.'}</p><p>Per confermare la causa usa la console e poi il collaudo di Gaia. L’osservazione del LED da sola non completa la missione.</p></article>}</div>;
}
