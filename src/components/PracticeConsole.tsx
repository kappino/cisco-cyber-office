import { useState } from 'react';
import { Terminal } from 'lucide-react';
import { initialPractice, practiceCommand } from '../utils/practiceConsole';

export function PracticeConsole() {
  const [state, setState] = useState(initialPractice);
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState('Banco didattico locale. Digita help per iniziare.\n');
  return <details className="cozy-practice"><summary><Terminal size={16} />Prova sul banco CLI · simulazione locale</summary><p>Questo banco è un esercizio libero, separato dalla storia. Supporta solo un sottoinsieme di comandi e non si collega ad alcun dispositivo.</p><div className="cozy-practice-status"><span>Cavo: {state.connected ? 'collegato' : 'scollegato'}</span><span>Stampante: VLAN {state.printerVlan}</span><span>Ospiti: {state.guestAllowed ? 'consentiti' : 'esclusi'}</span><span>{state.saved ? 'Salvato' : 'Da salvare'}</span></div><pre tabIndex={0} aria-label="Output console simulata">{history}</pre><form onSubmit={e => { e.preventDefault(); const response = practiceCommand(state, command); setState(response.state); setHistory(h => (h + `\nSW-LAB${state.mode === 'exec' ? '#' : '(config)#'} ${command}\n${response.output}\n`).slice(-16000)); setCommand(''); }}><label htmlFor="practice-command">Comando</label><div><input id="practice-command" autoComplete="off" spellCheck={false} value={command} onChange={e => setCommand(e.target.value)} placeholder="show vlan brief" /><button disabled={!command.trim()}>Invia</button></div></form><button onClick={() => { setState(initialPractice); setHistory('Banco ripristinato. Digita help.\n'); }}>Ripristina solo il banco</button></details>;
}
