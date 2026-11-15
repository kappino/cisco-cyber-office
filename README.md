# CLARA / TNES — Backend CML, Splunk & AI

Backend **FastAPI** per il gioco 3D **CLARA Day One / TNES (Unreal Engine 5)** alla challenge Cisco / Clara — *The Big Hack 2026*.

Collega in tempo reale il client 3D (e qualsiasi client HTTP/WebSocket) a:
- **Cisco Modeling Labs (CML 2.10.1)**: console seriali IOS/Linux, topologia, cablaggio 1:1, LED porte STP/up/down, verifiche su `running-config` e `startup-config`, reload pulito.
- **Splunk Enterprise**: lettura alert SOC live (`GET /api/soc/alerts`).
- **Ollama (`gemma4:12b`)**: suggerimenti didattici progressivi e dialoghi NPC.

> Il frontend 2D Phaser completo (Piano B) è conservato separatamente sul branch **`feat/2d-fallback`**.

---

## Struttura del repository (`main`)

- `backend/main.py` — orchestratore FastAPI (tutte le rotte HTTP e WebSocket).
- `backend/room_labs.py` — gestione stanze CML, console TermServ SSH, LED porte, verifiche, reload.
- `backend/rooms/` — definizioni YAML delle stanze (`tnes_n1`, `tnes_n2_prova`, `tnes_n3`, `office`, `corridor`, `datacenter_vault`).
- `backend/console_session.py` — sessioni console HTTP stateful (`ConsoleBridge`).
- `backend/config_diff.py` — diff `running-config` e generazione hint a 3 livelli.
- `backend/windows_translator.py` — traduttore comandi CLI Windows (`ipconfig`, `arp -a`, `tracert`, `ping`) per nodi Alpine.
- `backend/fault_injection.py` — iniezione guasti di rete per training.
- `backend/splunk_soc.py` — client REST Splunk (`:8089`) con fallback resiliente.
- `backend/ai_service.py` — integrazione Ollama (`gemma4:12b`).
- `tests/cml/` — suite `pytest` (`61` test, dettagli in [`tests/cml/README.md`](tests/cml/README.md)).
- `docs/CML_INTEGRAZIONE.md` — architettura e limiti noti dell'integrazione CML.

---

## Avvio rapido

### 1. Variabili d'ambiente (`backend/.env`)

```env
CML_HOST=192.168.122.110
CML_USER=admin
CML_PASS=...
USE_TNES_LABS=1
SPLUNK_HOST=127.0.0.1
```

### 2. Avvio server e tunnel

```bash
backend/.venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Esposto pubblicamente per Unreal tramite Cloudflare Tunnel su `https://api-cml.kappino.me`.

### 3. Test

```bash
backend/.venv/bin/python -m pytest tests/cml/ -q
```

---

## Lab TNES e alias per Unreal 3D

Con `USE_TNES_LABS=1`, il backend si collega direttamente ai lab TNES precaricati in CML (`external_lab: true`, senza ricrearli o cancellarli):

| `room_id` | Lab CML | Nodi reali |
| --- | --- | --- |
| `tnes_n1` | `TNES N1 - inizio` | `SW1`, `R1`, `PORTATILE`, `PC2` |
| `tnes_n2_prova` | `TNES N2 prova - inizio` | `SW-PROVA`, `R1`, `PORTATILE` |
| `R1`, `SW-A`, `SW-B`, `PC2`, `PC3` |
| `tnes_n3` | `TNES N3 - inizio` | `R1`, `SW1`, `R2`, `SW2`, `PC2` |

Alias automatici attivi per il client Unreal:
- Stanze: `office -> tnes_n1`, `corridor -> tnes_n2_prova`, `datacenter_vault -> tnes_n3`
- Nodi: `SW-PIANO1 -> SW1`, `RTR-UFFICIO -> R1`, `PC-MARKETING -> PORTATILE`, `LAPTOP -> PORTATILE`, `PC-CONTABILITA -> PC2`, `SW-ACC -> SW-PROVA`, `SW-DC1 -> SW2`

---

## Rotte API principali (`backend/main.py`)

### Stato, stanze e topologia CML
- `GET /api/health` — stato live CML, Ollama e stanze
- `POST /api/cml/bootstrap-demo` — attiva la stanza di default (`tnes_n1` / `office`)
- `POST /api/cml/room-sync` — sincronizza/attiva la stanza richiesta (`{"room_id": "..."}`)
- `GET /api/rooms` — elenco stanze e nodi
- `POST /api/rooms/provision` — provisioning YAML delle stanze non esterne
- `GET /api/room/{room_id}/status` — stato boot della stanza
- `GET /api/room/{room_id}/topology` — nodi e link correnti in CML
- `GET /api/room/{room_id}/ports?fresh=false` — stato/LED porte dagli apparati
- `POST /api/room/{room_id}/cable` — collega/scollega cavi 1:1 in CML
- `POST /api/rack/patch` — compatibilità patch rack Unreal (`SW-PIANO1` / `SW1`)

### Console, verifiche, hint e training
- `POST /api/terminal/command` — esecuzione comando one-shot sulla console reale (`{"node": "...", "command": "..."}`)
- `POST /api/console-session/{room_id}/{node}` — apre sessione console HTTP stateful
- `POST /api/console-session/{session_id}/send` — invia input alla sessione
- `GET /api/console-session/{session_id}/read` — legge output dalla sessione
- `DELETE /api/console-session/{session_id}` — chiude sessione
- `WS /ws/console/{room_id}/{node}` — console WebSocket interattiva
- `GET /api/room/{room_id}/verify` — verifica su `running-config` / `startup-config` / LED / connettività
- `GET /api/room/{room_id}/hint?level=1|2|3` — suggerimenti progressivi a 3 livelli
- `POST /api/room/{room_id}/reload` — reset pulito stanza o singolo nodo (`autosave: false`)
- `POST /api/room/{room_id}/inject-fault` — iniezione guasti (`vlan_mismatch`, `interface_shutdown`, `missing_static_route`, `trunk_vlan_exclusion`)

### SOC, AI e missioni
- `GET /api/soc/alerts` — alert live da Splunk Enterprise (`live_splunk` o `fallback_sim`)
- `POST /api/soc/sinkhole` — policy sinkhole DNS
- `POST /api/ai/interact` — interazione NPC con Ollama (`gemma4:12b`)
- `GET /api/mission/specs`, `POST /api/mission/verify`, `POST /api/mission/generate` — specifiche, verifica e generazione missioni
