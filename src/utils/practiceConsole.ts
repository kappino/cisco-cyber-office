export interface PracticeState { connected: boolean; printerVlan: number; guestAllowed: boolean; saved: boolean; mode: string }
export const initialPractice: PracticeState = { connected: false, printerVlan: 20, guestAllowed: false, saved: false, mode: 'exec' };
export function practiceCommand(state: PracticeState, input: string): { state: PracticeState; output: string } {
  const command = input.trim().replace(/\s+/g, ' ').toLowerCase();
  const next = { ...state };
  let output = '';
  if (command === 'help' || command === '?') output = 'Console didattica locale. Comandi: show ip interface brief, show vlan brief, show interfaces trunk, connect reception, configure terminal, interface Ethernet0/2, switchport access vlan 10, interface Ethernet0/0, switchport trunk allowed vlan add 30, end, ping stampante, copy running-config startup-config. Nessun apparato reale viene modificato.';
  else if (command === 'show ip interface brief') output = `Interface       IP-Address   Status\nEthernet0/1     unassigned   ${state.connected ? 'up' : 'down'}\nEthernet0/2     unassigned   up\nEthernet0/0     unassigned   up`;
  else if (command === 'show vlan brief') output = `VLAN  Name          Ports\n10    Reception     Ethernet0/1${state.printerVlan === 10 ? ', Ethernet0/2' : ''}\n20    Laboratorio   ${state.printerVlan === 20 ? 'Ethernet0/2' : ''}\n30    Ospiti`;
  else if (command === 'show interfaces trunk') output = `Port          Mode   Allowed VLANs\nEthernet0/0   trunk  10,20${state.guestAllowed ? ',30' : ''}`;
  else if (command === 'connect reception') { next.connected = true; next.saved = false; output = 'Azione sul banco simulato: cavo reception collegato. Il comando “connect reception” è un’azione del gioco, non sintassi Cisco IOS.'; }
  else if (command === 'configure terminal' || command === 'conf t') { next.mode = 'config'; output = 'Modalità configurazione globale.'; }
  else if (command.startsWith('interface ')) {
    if (state.mode === 'exec') output = 'Prima entra in configurazione: configure terminal.';
    else if (['interface ethernet0/2', 'interface ethernet0/0'].includes(command)) { next.mode = command.slice(10); output = `Interfaccia selezionata: ${next.mode}.`; }
    else output = 'Questo banco di prova espone Ethernet0/2 e Ethernet0/0 per la configurazione.';
  }
  else if (command === 'switchport access vlan 10') {
    if (state.mode !== 'ethernet0/2') output = 'Seleziona la porta della stampante: interface Ethernet0/2.';
    else { next.printerVlan = 10; next.saved = false; output = 'Porta stampante assegnata alla VLAN 10 (simulazione).'; }
  }
  else if (command === 'switchport trunk allowed vlan add 30') {
    if (state.mode !== 'ethernet0/0') output = 'Seleziona il trunk: interface Ethernet0/0.';
    else { next.guestAllowed = true; next.saved = false; output = 'VLAN 30 aggiunta, preservando VLAN 10 e 20.'; }
  }
  else if (command === 'end') { next.mode = 'exec'; output = 'Ritorno alla modalità EXEC.'; }
  else if (command === 'ping stampante') output = state.connected && state.printerVlan === 10 ? 'Banco simulato: 4/4 risposte dalla stampante. Il ping non verifica il servizio di stampa o la persistenza.' : 'Banco simulato: nessuna risposta. Controlla cavo reception e VLAN della stampante.';
  else if (command === 'copy running-config startup-config') {
    if (state.mode !== 'exec') output = 'Prima torna in EXEC con end.';
    else { next.saved = true; output = 'Configurazione del banco salvata [OK]. Gli apparati reali non sono stati modificati.'; }
  }
  else output = 'Comando non previsto da questo piccolo simulatore. Digita help per i comandi supportati. Su un apparato reale sintassi e funzioni dipendono dal sistema.';
  return { state: next, output };
}
