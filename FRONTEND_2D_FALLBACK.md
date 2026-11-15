# Piano B 2D

Il dock sotto la scena espone console stateful, indizi progressivi, verifica della stanza,
reload e allenamento con guasto casuale. Le etichette dei colleghi aprono il loro messaggio.
Le postazioni e il rack usano lo stesso componente console HTTP, senza dipendenze xterm a runtime.

## Contratti

- GET /api/rooms: selettore dei nodi reali della stanza.
- POST /api/console-session/{room_id}/{node}: session_id; POST /{session_id}/send
  con {data}; GET /{session_id}/read?wait=2; DELETE /{session_id} alla chiusura.
- GET /api/room/{room_id}/hint?level=1|2|3: hints, nessun indizio inventato se vuoto.
- GET /api/room/{room_id}/verify: ok, devices, checks; il badge richiede ok=true.
  Vengono mostrati anche acl_ok, persistence_ok e risultati traceroute quando presenti.
- POST /api/room/{room_id}/reload con {}: ricarica la startup-config;
  il backend preserva i salvataggi NVRAM, quindi non equivale al wipe del laboratorio.
- POST /api/room/{room_id}/inject-fault con {}: scelta casuale del backend.
- GET /api/soc/alerts: la modalità fallback_sim è visibile, non spacciata per live.
- GET /api/room/{room_id}/ports: LED letti dagli apparati; in assenza di lettura
  si usa lo stato dei collegamenti della topologia, come nel frontend preesistente.

Vite inoltra /api a http://127.0.0.1:8000. Per il deploy serve lo stesso reverse proxy.
Il focus nel dock disabilita la cattura tastiera Phaser; uscita e smontaggio la riattivano.

## Verifica manuale con infrastruttura disponibile

1. Entrare in ogni stanza e attendere ready; aprire un nodo IOS e un host Alpine/Windows.
2. Eseguire show, entrare in configurazione, inviare più comandi e controllare che il prompt persista.
3. Cambiare nodo e chiudere la console: verificare DELETE e ritorno dei controlli di movimento.
4. Richiedere tre indizi; collaudare una configurazione errata e poi corretta e salvata.
5. Iniettare un guasto, osservare LED e nuovo collaudo; ripristinare con reload.
6. Controllare SOC live/fallback e interrompere il backend: banner e scena devono restare utilizzabili.
7. Controllare il dock a 412x915 e 1920x1080, inclusi focus e chiusura dei pannelli.
