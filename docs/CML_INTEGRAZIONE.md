# Integrazione Unreal 3D ↔ Backend ↔ Cisco Modeling Labs (CML)

Documento tecnico dell'integrazione tra il gioco 3D (Unreal Engine — `ClaraDayOne`), il backend FastAPI (`backend/`) e Cisco Modeling Labs (CML 2.10).

---

## 1. Architettura

```
Unreal Engine 3D (ClaraStoryGateway)
   │  HTTP  /api/...  (https://api-cml.kappino.me -> 127.0.0.1:8000)
   ▼
Backend FastAPI (backend/main.py, backend/room_labs.py)
   │  REST  https://<cml>/api/v0      (lab, nodi, interfacce, link)
   │  SSH   CML TermServ (port 22)    ("open /<lab>/<nodo>/0")
   │  Splunk REST / HEC (opzionale)   (SPLUNK_HOST / SPLUNK_PORT)
   ▼
CML 2.10 — un lab attivo alla volta (licenza da 5 nodi)
```

---

## 2. Modalità TNES (`USE_TNES_LABS=1`) e Alias Stanze/Nodi

Quando `USE_TNES_LABS=1` è impostato in `backend/.env`, il backend mappa automaticamente gli ID usati dal client Unreal sui lab reali TNES già presenti su CML, mantenendo i contratti API invariati:

| `room_id` richiesto da Unreal | Lab TNES usato su CML | File YAML (`backend/rooms/`) |
|---|---|---|
| `office` / `tnes_n1` | `TNES N1 - inizio` | `tnes_n1.yaml` |
| `corridor` / `tnes_n2_prova` | `TNES N2 - prova` | `tnes_n2_prova.yaml` |
| `datacenter_vault` / `tnes_n2_gaia` | `TNES N2 - gaia` | `tnes_n2_gaia.yaml` |
| `tnes_n3` | `TNES N3` | `tnes_n3.yaml` |

Alias nodi in modalità TNES:
- `SW-PIANO1` → `SW1`
- `RTR-UFFICIO` → `R1`
- `PC-MARKETING` → `PORTATILE`
- `PC-CONTABILITA` → `PC2`

I file `backend/rooms/tnes_*.yaml` usano `external_lab: true` e `autosave: false`: `RoomManager.provision()` **non** modifica, **non** cancella e **non** ricrea questi lab su CML (vengono solo agganciati e avviati/sincronizzati).

Quando `USE_TNES_LABS` è disattivato (o in ambiente `pytest`), il backend usa i lab definiti in `office.yaml`, `corridor.yaml` e `datacenter_vault.yaml`.

---

## 3. Ciclo di Vita dei Lab (`room-sync`)

Con la licenza CML da 5 nodi può essere acceso un solo lab alla volta. Entrando in una stanza o selezionando uno scenario, Unreal chiama `POST /api/cml/room-sync` (non bloccante) e fa polling su `GET /api/room/{room_id}/topology` finché `status.phase == "ready"`.

Fasi possibili (`status.phase`):
`queued → saving → stopping → starting → booting → ready` (oppure `error`).

1. **saving**: esegue `write memory` sui nodi IOS del lab precedente (saltato se `autosave: false`).
2. **stopping**: ferma gli altri lab accesi e attende che i nodi siano `STOPPED`.
3. **starting**: avvia il lab richiesto (con retry fino a 45 s per il rilascio licenze nodi).
4. **booting**: attende `BOOTED` su tutti i nodi.
5. **ready**: lab pronto per comandi console e verifiche.

---

## 4. Console Condivisa e Comandi da Unreal

- `POST /api/terminal/command` esegue un comando su un nodo (`room_id`, `node`, `command`) aprendo o riusando la sessione console SSH verso CML TermServ (`open /<lab_id>/<node_id>/0`).
- Tutte le sessioni (Unreal, backend, UI web di CML) condividono la stessa linea seriale per nodo: il backend serializza l'accesso per nodo con un lock dedicato.
- `GET /api/room/{room_id}/node/{node}/config` legge `show running-config` per ispezione/diff.
- `POST /api/room/{room_id}/port` consente lo spostamento patch/link delle porte (`jack` / `port`) sulle topologie supportate.
- `POST /api/room/{room_id}/verify` esegue i `checks` definiti nel file YAML della stanza.
