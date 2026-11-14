# Integrazione gioco ↔ Cisco Modeling Labs (CML)

Documento tecnico del collegamento 1:1 tra le stanze del gioco e i lab di CML: come sono fatte le
stanze, come si accendono, come funzionano console, cavi, LED e Verifica, come convivono le
operazioni automatiche con il giocatore, e **quali sono i limiti noti**.

Branch: `feat/cml-1to1`. Codice principale: `backend/room_labs.py`, `backend/config_diff.py`,
`backend/main.py`, `backend/rooms/*.yaml`, `src/components/RackView.tsx`,
`src/components/CmlDevicePanel.tsx`, `src/utils/useRoomNetwork.ts`, `src/game/scenes/OfficeScene.ts`.

---

## 1. Architettura in breve

```
Browser (React + Phaser)
   │  HTTP  /api/...              WebSocket /api/console/<stanza>/<nodo>
   ▼
Backend FastAPI (backend/main.py, room_labs.py)
   │  REST  https://<cml>/api/v0     (lab, nodi, interfacce, link)
   │  SSH   console server di CML    (termserv: "open /<lab>/<nodo>/0")
   ▼
CML 2.10 — un lab per stanza (max 5 nodi accesi: licenza)
```

- **Principio 1:1**: ogni dispositivo disegnato nel gioco è un nodo del lab della stanza, con lo stesso
  nome. Nessun dispositivo "finto": quelli decorativi senza nodo sono stati tolti.
- **Unica fonte di verità della rete**: i file `backend/rooms/<stanza>.yaml` (topologia, configurazioni
  target, collocazione nel gioco, controlli della Verifica).
- **Console condivisa**: CML espone per ogni nodo una sola linea seriale. Tutte le sessioni (gioco,
  backend, interfaccia web di CML) la condividono: gran parte della complessità descritta sotto serve a
  far convivere i comandi automatici con quelli del giocatore.

---

## 2. Le stanze e i loro lab

### 2.1 File della stanza (`backend/rooms/<stanza>.yaml`)

| Chiave | Significato |
|---|---|
| `room_id`, `lab_title` | id della stanza nel gioco e titolo del lab su CML |
| `racks` | armadi di rete della stanza: `{id, label, gx, gy}` (posizione sulla griglia 8×8) |
| `nodes[]` | `label`, `cml_def` (`iol-xe`, `ioll2-xe`, `alpine`), `kind` (`router`, `switch`, `pc`, `server`, `printer`), `display`, `config` (configurazione target), `min_interfaces` |
| `nodes[].rack` | apparati montati nell'armadio (router, switch, server) |
| `nodes[].game` + `nodes[].jack` | postazioni nella stanza (PC, stampante): posizione e presa a muro sul patch panel |
| `links[]` | `[nodoA, portaA, nodoB, portaB]` |
| `checks[]` | controlli funzionali della Verifica: `{from, dhcp: "10.10.10."}` o `{from, ping: <ip>}` |

Massimo 5 nodi per stanza (controllato al caricamento).

### 2.2 Topologie attuali

| Stanza | Nodi | Contenuto didattico |
|---|---|---|
| `office` (1F) | RTR-UFFICIO, SW-PIANO1, PC-MARKETING, PC-CONTABILITA, STAMPANTE | VLAN 10/20/30/99, VLAN nativa 999 inutilizzata, trunk 802.1Q, router-on-a-stick, DHCP. Prese libere in VLAN diverse. **La presa sala riunioni (Et1/0) non ha portfast** (fase ambra STP di ~30 s) |
| `corridor` | RTR-CORE, SW-DIST, SW-ACC, PC-HELPDESK, SRV-FILE | trunk tra switch, EtherChannel LACP (Po1) + collegamento di riserva bloccato da Rapid-PVST, SW-DIST root, BPDU guard sulle porte utente |
| `datacenter_vault` (-1F) | RTR-DC, SW-DC1, SW-DC2, SRV-GESTIONALE, SRV-BACKUP | due switch di rack con trunk, VLAN server 50 e backup 60 che devono attraversarlo, router-on-a-stick |

Fuori ambito per scelta: OSPF e routing dinamico, ACL.

Tutti gli switch hanno `vtp mode transparent`: in modalità VTP server IOS ignora i comandi `vlan …`
della configurazione di avvio e le VLAN nascerebbero solo dalle porte d'accesso (bug trovato in collaudo).

### 2.3 Creazione dei lab (provisioning)

`RoomManager.provision()` crea il lab dal file della stanza se manca, o lo ricrea se il file è cambiato.
L'**impronta** (`fr-hash:<sha1>`) è calcolata solo sulla parte che riguarda CML (nodi, configurazioni,
link) ed è scritta nelle note del lab: cambiare posizioni nel gioco o controlli non ricrea il lab.

Ricreare a mano: `POST /api/rooms/provision?force=true` (tutte le stanze).

### 2.4 Primo avvio

Due correzioni vengono applicate **dalla console, una sola volta** per lab (marcatore
`fr-init-done:<hash>` nelle note):

- **router**: `interface <porta>` + `no shutdown` sulle porte collegate. IOL ignora il `no shutdown`
  della configurazione di avvio sulle interfacce senza IP (la "madre" delle sottointerfacce).
- **switch con EtherChannel**: `shutdown` / `no shutdown` sui membri del canale: al primo avvio IOL
  sospende il canale LACP (`Po1(SD)`).

---

## 3. Ciclo di vita di una stanza

Con la licenza CML da 5 nodi è accesa **una stanza alla volta**. Entrando in una stanza il gioco chiama
`POST /api/cml/room-sync` (non bloccante) e segue lo stato con `GET /api/room/<stanza>/topology`.

Fasi (`status.phase`): `queued → saving → stopping → starting → booting → ready` (oppure `error`).

1. **saving**: `write memory` sugli apparati IOS accesi della stanza precedente (la configurazione del
   giocatore resta dopo spegnimento e riaccensione — verificato).
2. **stopping**: `stop` (non `wipe`) degli altri lab accesi, e attesa che i nodi siano davvero spenti.
3. **starting**: `start` del lab. CML **non segnala** l'errore di licenza sull'avvio del lab: il backend
   avvia i nodi rimasti spenti uno per uno per leggere l'errore, e riprova per 45 s perché le licenze
   dei nodi appena spenti si liberano qualche secondo dopo lo stato `STOPPED`.
4. **booting**: attesa che tutti i nodi siano `BOOTED` (massimo 300 s), poi le correzioni di primo avvio.
5. **ready**.

Altri comportamenti:
- richieste ripetute per la stanza già accesa non la riavviano; con cambi rapidi vince l'ultima;
- se il lab viene spento da fuori (interfaccia CML, altro backend) la stanza passa in `error` e il gioco
  mostra il pulsante **Riaccendi la rete**;
- dopo un riavvio del backend, una stanza il cui lab è già acceso e pronto risulta subito `ready`.

Tempi misurati (CML 2.10, server da 8 GB): **45–90 s** per accendere una stanza, di più alla prima
accensione dopo una ricreazione.

---

## 4. Console

### 4.1 Collegamento

Il backend apre una sessione SSH sul **console server** di CML (`CML_CONSOLE_HOST:CML_CONSOLE_PORT`,
porta **22 della VM CML**; dall'esterno era inoltrata come 2222 — **non** la 1122, che è la shell di
sistema) e invia `open /<lab>/<nodo>/0`.

`ConsoleBridge` collega quella sessione a un WebSocket (`/api/console/<stanza>/<nodo>`) e al terminale
xterm.js del gioco. Sugli host Alpine fa da solo il login (`cisco`/`cisco`).

### 4.2 Protocollo WebSocket

| Direzione | Messaggio | Significato |
|---|---|---|
| backend → gioco | byte | output della console |
| backend → gioco | `{"type":"lock","on":true,"reason":"Verifica in corso","silent":false}` | blocco visibile (Verifica) |
| backend → gioco | `{"type":"lock","on":…,"silent":true}` | blocco silenzioso (lettura LED, rimbalzo porta) |
| backend → gioco | `{"type":"changed"}` | il giocatore ha dato un comando che può cambiare porte/VLAN/STP |
| gioco → backend | testo | tasti |
| gioco → backend | `{"type":"resize","cols":…,"rows":…}` | dimensioni del terminale |
| gioco → backend | `{"type":"replay","echoed":"…","raw":"…"}` | tasti scritti durante un blocco silenzioso |

Codici di chiusura: `4404` nodo inesistente, `4409` stanza non accesa, `4500` console non disponibile.

Prestazioni misurate: apertura ~0,9 s, eco del tasto ~100 ms (mediana).

### 4.3 Accesso ai dispositivi nel gioco

- **PC e stampante**: ci si avvicina alla postazione e si apre il suo terminale.
- **Router, switch, server**: si apre l'**armadio** e si inserisce il **cavo console** nella porta CON del
  dispositivo; senza cavo non c'è console. La "postazione del tecnico" nel corridoio apre l'armadio.

### 4.4 Comandi automatici sulla console

Le operazioni automatiche (`run_console_commands`) aprono una sessione propria e:
1. inviano Ctrl+C, Ctrl+U e Invio (ripetuto) finché compare il prompt — la linea può essere ferma dopo
   l'avvio o avere una riga lasciata a metà dal giocatore;
2. entrano in `enable` e impostano `terminal length 0`;
3. per ogni comando **svuotano la linea** (0,3 s) e considerano il comando finito solo quando arriva un
   prompt **dopo l'eco del comando** (si cercano i primi 20 caratteri: IOS accorcia l'eco lunga con `$`).
   Senza questa regola, i prompt ristampati da `logging synchronous` dopo un syslog chiudevano la lettura
   in anticipo (bug trovato in collaudo, verificato poi con 33 syslog veri generati durante le letture);
4. tolgono le sequenze di controllo del terminale prima di cercare il prompt (la shell di Alpine manda
   `ESC[6n` dopo il prompt: senza toglierla ogni comando aspettava il timeout intero).

Un **lucchetto per nodo** (`node_lock`) fa passare una sola operazione automatica alla volta per
dispositivo (LED, Verifica, salvataggio, primo avvio, rimbalzo, comando singolo): due letture
contemporanee sulla stessa linea mescolerebbero gli output.

---

## 5. Convivenza con il giocatore

### 5.1 Blocco visibile (Verifica)

Durante la Verifica le console aperte sui dispositivi letti vengono **bloccate**: il terminale si scurisce
e mostra "Verifica in corso", la tastiera è disattivata, l'output dei comandi automatici non viene
inoltrato. A fine Verifica il backend riporta il terminale com'era (5.3) e fa ricomparire il prompt.

### 5.2 Blocco silenzioso (LED, inserimento cavo)

Usato per la lettura dei LED su un dispositivo con console aperta e per il rimbalzo di una porta.
- Parte **solo se il terminale è inattivo**: fermo al prompt, nessun tasto da almeno 3 s, nessun output
  da 1,5 s. Se il giocatore sta scrivendo o un comando è in corso, la lettura salta un giro e i LED di
  quel dispositivo restano all'ultimo valore.
- Il gioco non mostra avvisi: passa all'**eco locale** (lettere e backspace compaiono subito) e mette i
  tasti in un buffer; Tab, `?`, Invio, frecce vengono solo accumulati.
- Allo sblocco il gioco manda il buffer (`replay`): la parte già vista viene inviata al dispositivo con
  l'eco nascosta, il resto normalmente. Durata tipica 2–4 s.

### 5.3 Ripristino della modalità

Dall'eco della console il ponte ricava la modalità IOS del giocatore (`>`, `#`, `(config)#`,
`(config-xxx)#`) e il comando con cui è entrato nella sottomodalità (`interface`, `vlan`, `line`,
`ip dhcp pool`, `router`, `ip access-list`, anche abbreviati). Dopo un blocco: `disable` oppure
`configure terminal` + sottomodalità, in modo invisibile, poi la riga che stava scrivendo viene rimessa
(Ctrl+U l'aveva cancellata).

---

## 6. Cavi

I cavi sono i link del lab CML. API: `POST /api/room/<stanza>/cable`

| `action` | Effetto in CML |
|---|---|
| `connect` | nuovo link tra due porte libere (`node/iface` → `to_node/to_iface`) |
| `disconnect` | il link viene cancellato (cavo tolto) |
| `move` | `node/iface` è il capo che **resta**; l'altro capo si sposta su `to_node/to_iface` (porta libera). Se CML rifiuta il nuovo link, quello vecchio viene ripristinato |
| `unplug` / `plug` | ferma / riavvia il link senza toglierlo |

Errori (porta occupata, inesistente, se stessa, azione sconosciuta) → HTTP 400.

**Inserimento realistico**: IOL non rileva il cambio di link. Quando un cavo viene collegato a una porta
di router o switch, il backend fa `shutdown` / `no shutdown` su quella porta (blocco silenzioso, senza
`write memory`): la porta va giù e risale e STP riparte davvero. Se la porta è in `shutdown` per scelta
del giocatore non viene toccata.

Nel gioco l'armadio (`RackView`) mostra patch panel con le prese dei PC, tutte le porte di ogni
apparato e i cavi (giallo tra apparati, azzurro verso le prese, rosso verso i server). Click porta →
porta collega; click su un cavo → porta libera sposta; doppio click sulla stessa porta toglie.

---

## 7. LED

### 7.1 Codifica (come il LED STAT dei Catalyst 2960/9200)

| LED | Condizione |
|---|---|
| spento | nessun cavo, cavo fermo in CML, `shutdown`, nessun link; porta appena collegata finché non arriva una lettura successiva al collegamento |
| verde | link su, porta in inoltro |
| verde lampeggiante | traffico > 5 pacchetti/s, oppure picco ≥ 4 pacchetti in pochi secondi su una porta d'accesso (DHCP/ARP di un PC appena collegato) |
| ambra | STP non ancora in inoltro (porta designata in discarding/learning), err-disabled, membro EtherChannel fuori dal canale |
| ambra lampeggiante | porta bloccata da STP (alternate/backup) |
| verde/ambra alternato | errori sul link in aumento (input/output errors) |
| SYST ambra | l'apparato ha almeno una porta err-disabled o con errori |

### 7.2 Da dove vengono

`read_port_leds()` legge in una sola sessione: `show interfaces | include …` (stato, pacchetti, errori),
`show interfaces status`, `show spanning-tree`, `show etherchannel summary` (solo switch). Il traffico è
il delta dei contatori tra due letture. I membri di un EtherChannel usano lo stato STP del Port-channel.

### 7.3 Quando si aggiornano

- ogni **8 s** mentre l'armadio è aperto (cache di 7 s);
- dopo un **cavo**: 1,5 / 4 / 16 / 32 s (letture "fresche", cache di 1,5 s);
- dopo un **comando di configurazione** (o `clear`, `shutdown`, `write`, `copy`) dalla console
  dell'armadio: 2 / 6 s;
- una lettura fallita o vuota mantiene l'ultimo valore valido (`_stale`).

### 7.4 Aiuto diagnosi

Di default il tooltip di una porta mostra solo porta e cavo; il motivo dello stato (es. "STP: bloccata
(VLAN 10 Altn BLK)") compare solo attivando **Aiuto diagnosi** nell'armadio.

---

## 8. Verifica

`GET /api/room/<stanza>/verify`, pulsante **Verifica** nell'armadio. Tipicamente 7–9 s.

1. **Diff delle configurazioni** (`backend/config_diff.py`) per ogni router e switch: running-config vera
   contro il `config` del file della stanza, **per sezioni**:
   - `-` mancanti: righe del target assenti nella sezione giusta;
   - `+` in più: righe presenti in una sezione descritta dal target ma non previste (es. `shutdown`,
     VLAN d'accesso diversa) e sezioni rilevanti sconosciute al target (VLAN, interfacce configurate,
     pool DHCP);
   - `no shutdown` nel target = assenza di `shutdown` sull'apparato; `interface range` viene espanso;
   - righe di default di IOS ignorate; syslog arrivati durante la lettura tolti;
   - lettura incompleta (manca `Building configuration` o `end`) → errore "riprova", non un diff falso.
2. **Controlli funzionali** dagli host (`checks` del file): indirizzo DHCP nella rete attesa, ping
   (parser ripreso da netAgent `tools/ping_parser.py`).
3. Durante la Verifica le console aperte sono bloccate (5.1).

Esempio di guasti trovati in collaudo: porta del PC nella VLAN sbagliata, interfaccia del router spenta,
VLAN tolta dal trunk, `description` cancellata, `portfast edge` rifiutato da IOL.

---

## 9. API

| Metodo | Percorso | Uso |
|---|---|---|
| GET | `/api/health` | stato di CML, Ollama e delle stanze |
| GET | `/api/rooms` | elenco stanze e nodi |
| POST | `/api/rooms/provision?force=` | crea/ricrea i lab dai file |
| POST | `/api/cml/room-sync` `{room_id}` | accende la stanza (non bloccante) |
| GET | `/api/room/<id>/status` | fase dell'accensione |
| GET | `/api/room/<id>/topology` | nodi, porte, cavi, armadi, stato |
| GET | `/api/room/<id>/ports?fresh=` | LED delle porte |
| POST | `/api/room/<id>/cable` | operazioni sui cavi |
| GET | `/api/room/<id>/verify` | Verifica |
| WS | `/api/console/<id>/<nodo>` | console |
| POST | `/api/terminal/command` `{node, command}` | comando singolo sulla console (output completo) |
| POST | `/api/rack/patch` | compatibilità con il vecchio minigioco del rack |

---

## 10. Configurazione e avvio

Variabili d'ambiente del backend (`backend/.env`, non nel repository):

| Variabile | Valore sul server | Note |
|---|---|---|
| `CML_URL` | `https://192.168.122.110` | API REST di CML |
| `CML_USER` / `CML_PASS` | credenziali CML | |
| `CML_CONSOLE_HOST` | (default: host di `CML_URL`) | console server |
| `CML_CONSOLE_PORT` | `22` | dall'esterno era inoltrata come 2222 |
| `CML_LINUX_USER` / `CML_LINUX_PASS` | `cisco` / `cisco` | login automatico sugli Alpine |

Frontend: `npm install` (dipendenze `@xterm/xterm`, `@xterm/addon-fit`), poi `npm run dev`. Il proxy di
Vite inoltra `/api` (anche WebSocket) a `http://127.0.0.1:8000`, oppure a `API_TARGET` se impostata.

---

## 11. Collaudi (`tests/cml/`)

| Script | CML | Contenuto |
|---|---|---|
| `test_config_diff.py` | no | diff, guasti tipici, `interface range`, parser di ping, STP, EtherChannel |
| `verify_rooms.py` | sì | Verifica stanza per stanza |
| `e2e_cml.py` | sì | topologia, cavi, console, persistenza |
| `deep_suite.py` | sì | 37 test (~16 min) su comunicazione, console, Verifica, LED, cavi, robustezza |

Gli script che usano CML spengono gli altri lab e iniettano guasti (poi ripristinati): nessuno deve
giocare mentre girano. Ultimo giro completo della suite: 35/37; i due casi rimasti (letture chiuse in
anticipo) sono stati corretti e riprovati a parte, la suite completa non è stata rieseguita dopo.

---

## 12. Limiti noti

### Licenza e risorse
- **Una stanza accesa alla volta** (5 nodi). Due giocatori in stanze diverse si spengono la rete a
  vicenda; lo stesso vale per qualunque altro backend o utente che accenda lab sullo stesso CML (anche il
  vecchio backend sulla porta 8000 e altri lab del team, es. `FuoriRete_cyber_*`).
- **Accensione lenta**: 45–90 s a stanza, di più alla prima accensione dopo una ricreazione.
- Il backend deve raggiungere CML in modo stabile: cadute di rete durante la creazione di un lab hanno
  lasciato un nodo che CML rifiutava di avviare senza dare motivo; si è risolto solo ricreando il lab
  (`provision?force=true`). Non è gestito in automatico.

### IOL (immagini Cisco in CML)
- **Le porte non sentono il cavo.** Collegando un cavo il backend simula l'inserimento (rimbalzo della
  porta); **togliendolo** IOL continua a dire `connected` e STP non se ne accorge (il LED nel gioco si
  spegne perché si basa sul cavo, ma `show interfaces status` sull'apparato no). Simularlo vorrebbe dire
  lasciare un `shutdown` nella configurazione.
- Le porte senza cavo risultano `connected` in IOS.
- Al primo avvio servono le correzioni da console (2.4) e `vtp mode transparent`; `spanning-tree portfast
  edge` non è accettato (si usa `spanning-tree portfast`).
- Errori fisici (CRC, collisioni) praticamente non si generano su CML: il LED verde/ambra alternato è
  implementato ma non è stato visto dal vivo.

### LED
- Si aggiornano ogni 8 s (o 1,5–6 s dopo un evento), non all'istante: ogni lettura richiede 2–3 s per
  apparato.
- Su una porta trunk con stati STP diversi per VLAN il LED mostra lo stato prevalente (verde se inoltra in
  almeno una VLAN).
- Il traffico è stimato dal delta dei contatori tra due letture: raffiche brevi possono non vedersi.
- Sul dispositivo con la console aperta i LED si aggiornano solo quando il giocatore è fermo al prompt.

### Console e convivenza con il giocatore
- Le sessioni aperte **fuori dal gioco** (interfaccia web di CML, altri strumenti) non vengono bloccate né
  ripristinate: lì i comandi automatici si vedono.
- Il ripristino della modalità copre le sottomodalità di primo livello tracciate (interface, vlan, line,
  ip dhcp pool, router, ip access-list); modalità annidate più profonde tornano al livello tracciato.
- Una riga lasciata a metà che contiene frecce o sequenze di escape non viene rimessa.
- Durante il blocco silenzioso l'eco locale vale solo per caratteri stampabili e backspace.
- La Verifica blocca la tastiera per ~7 s.

### Verifica
- Il diff confronta righe e sezioni, non la semantica: una configurazione equivalente scritta diversamente
  (ordine delle VLAN, forma abbreviata salvata da IOS in modo diverso) può risultare come differenza.
- Gli host Alpine non hanno diff di configurazione, solo controlli funzionali.
- Le righe di default di IOS sono ignorate tramite un elenco: un default non in elenco può comparire come
  "in più".
- Cambiare l'`hostname` di un apparato risulta come differenza (corretto) ma il resto del confronto
  continua sul nome atteso.

### Semantica rispetto a un apparato vero
- All'uscita da una stanza il backend fa `write memory` sugli apparati: le modifiche non salvate dal
  giocatore restano anche se lui non le ha salvate (su un apparato vero un riavvio le perderebbe).
- Il rinnovo DHCP sugli Alpine richiede `sudo` (si entra come utente `cisco`).

### Sicurezza e deploy
- L'API del backend non ha autenticazione e, sul server, ascoltava su tutte le interfacce: chiunque sulla
  rete della sede può accendere stanze, spostare cavi e aprire console.
- Le credenziali di CML stanno in `backend/.env` (non nel repository).

### Funzioni del gioco toccate
- Il vecchio minigioco del terminale (`CrtTerminalGame`, badge livello 2) non è più raggiungibile: la
  postazione del tecnico apre l'armadio.
- Rimossi i dispositivi decorativi senza nodo (Firepower, storage UCS, rack SW1, server R1).
- L'armadio non è stato provato su schermi da telefono.
