# Analisi & Architettura Lab CML — «Cyber: Giorni 1, 2 e 3 (Blue/Red Team)»

Analisi tecnica basata sul documento `/home/enzo/Downloads/Cyber — Giorni 1, 2 e 3 (Blue Red team).pdf` per tradurre le 3 giornate Cyber in **lab reali su Cisco Modeling Labs (CML-Free, max 5 nodi attivi)** integrati con `netAgent` e il gioco 3D/2D.

---

## 1. Principi Chiave del Documento Cyber

1. **Rete già costruita e già vulnerabile:** a differenza del lato Network (dove il giocatore ripara guasti di connettività), nel lato Cyber la rete funziona già ma ha **debolezze di sicurezza**.
2. **Bivio Red Team (A) vs Blue Team (B) su ogni giorno:**
   - **Percorso A (Red):** test autorizzato in laboratorio per verificare cosa è esposto o cosa passa davvero (*Atteso vs Ottenuto*).
   - **Percorso B (Blue):** incident response a partire dai log reali (es. scansioni/accessi da `192.168.10.77` o `192.168.10.30`) + messa in sicurezza senza rompere i servizi legittimi (*trappole didattiche*: non spegnere `443`, non bloccare `192.168.10.50`, non disabilitare `admin`).
3. **Continuità narrativa:** l'IP `192.168.10.77` è l'attaccante ricorrente dal Giorno 1 al Giorno 3; il server `192.168.20.10` (Prenotazioni) è il target dei Giorni 2 e 3.
4. **Zero punteggi negativi:** nessun malus per errori o indizi; due barre (`Blue` e `Red`, 0–100, max +25/giorno +3 riepilogo opposto) + **Taccuino** (`N1.x`, `N2.x`, `N3.x`).

---

## 2. Mapping 1-a-1 dei 3 Giorni in Lab CML (<= 5 Nodi ciascuno)

| Giorno | Titolo & Modulo Cisco | Lab YAML | Nodi CML (Totale) | Debolezza Reale su CML |
| :--- | :--- | :--- | :--- | :--- |
| **Giorno 1** | *Porte che nessuno usa* (Mod. 2) | `cyber_day1_ports.yaml` | `SW-OFFICE-01` (`ioll2-xe`), `SRV-DIDATTICA` (`alpine` `192.168.10.20`), `PC-LUCA` (`alpine` `192.168.10.50`), `PC-SCANNER` (`alpine` `192.168.10.77`) — **4 nodi** | `SRV-DIDATTICA` espone 5 porte (`21, 22, 23, 443, 8080`) invece delle sole `22` e `443`. |
| **Giorno 2** | *Chi può entrare?* (Mod. 4 ACL) | `cyber_day2_acl.yaml` | `SW-CORRIDOR` (`ioll2-xe`), `FW-RTR-01` (`iol-xe`), `PC-RECEPTION` (`alpine` `192.168.10.50`), `PC-AULA` (`alpine` `192.168.10.30`), `SRV-PRENOTAZIONI` (`alpine` `192.168.20.10`) — **5 nodi** | `FW-RTR-01` ha `ACL_PRENOTAZIONI` applicata in `out` su `E0/0.20` con `10 permit ip any any` in cima alla lista! |
| **Giorno 3** | *Una porta con la password sbagliata* (Mod. 3 & 8) | `cyber_day3_auth.yaml` | `SW-CORRIDOR` (`ioll2-xe`), `FW-RTR-01` (`iol-xe`), `PC-ATTACKER` (`alpine` `192.168.10.77`), `SRV-PRENOTAZIONI` (`alpine` `192.168.20.10`) — **4 nodi** | `SRV-PRENOTAZIONI` espone pannello HTTP (porta `80` in chiaro) con credenziali default `admin/admin`. |

> [!TIP]
> **Come gestire `PC-Ospiti` (`192.168.10.99`) nel Giorno 2 senza superare i 5 nodi CML-Free:**
> Su `PC-AULA` (`alpine`) si aggiunge un IP secondario (`ip addr add 192.168.10.99/24 dev eth0`), così da 1 solo nodo Alpine possiamo testare sia `ping -I 192.168.10.30 192.168.20.10` (Aula) che `ping -I 192.168.10.99 192.168.20.10` (Ospiti)!

---

## 3. Come Funzionano le Azioni Reali su CML per Ogni Giorno

### Giorno 1 (`cyber_day1_ports.yaml`)
- **Boot Alpine (`SRV-DIDATTICA`):** nello script di boot (`node.cfg`), si avviano 5 listener leggeri (`nc -lk -p 21`, `22`, `23`, `443`, `8080` oppure micro-daemon `busybox`).
- **Percorso A (Red):** comando `scansiona 192.168.10.20` -> il backend esegue `nc -zv 192.168.10.20 21 22 23 443 8080` direttamente su `PC-SCANNER` via CML2 TermServ porta `22`, mostrando le porte realmente aperte.
- **Percorso B (Blue):** l'interfaccia di gioco mostra i 5 servizi; spegnere `21, 23, 8080` esegue `kill` dei rispettivi listener (o `iptables -A INPUT -p tcp --dport <P> -j DROP`) su `SRV-DIDATTICA`.
- **Trappola didattica reale:** se il giocatore spegne `443`, il check `nc -z 192.168.10.20 443` da `PC-LUCA` fallisce davvero e parte l'alert di Luca!

### Giorno 2 (`cyber_day2_acl.yaml`)
- **Config iniziale `FW-RTR-01`:**
  ```ios
  ip access-list extended ACL_PRENOTAZIONI
   10 permit ip any any
   20 permit ip host 192.168.10.50 host 192.168.20.10
   30 deny ip any host 192.168.20.10
  ```
- **Percorso A (Red):** `prova da 192.168.10.30 a 192.168.20.10` esegue `ping -c 2 192.168.20.10` da `PC-AULA` -> passa davvero!
- **Percorso B (Blue):** il riordino delle regole nella UI traduce i drag-and-drop in comandi IOS reali via SSH su `FW-RTR-01` (es. `no 10` per rimuovere `permit ip any any`, oppure riordinando i sequence number).
- **Trappola didattica reale:** se il giocatore mette `deny ip any host 192.168.20.10` sopra `permit ip host 192.168.10.50`, il `ping` da `PC-RECEPTION` verso `192.168.20.10` fallisce davvero su CML!
- **Verifica `netAgent`:** `CiscoConfParse` controlla l'ordine di `ACL_PRENOTAZIONI` su `FW-RTR-01` + test Data Plane (`PC-RECEPTION` passa, `PC-AULA` bloccato).

### Giorno 3 (`cyber_day3_auth.yaml`)
- **Packet Capture Reale su CML:** CML 2.10 espone `/api/v0/labs/{lab_id}/links/{link_id}/capture/start` e `/api/v0/pcap/{link_id}/packets`!
  - Quando in **Percorso A** o **Percorso B** il giocatore osserva il traffico in chiaro vs cifrato in Network Vision, il backend può mostrare i pacchetti catturati sul link tra `SW-CORRIDOR` e `SRV-PRENOTAZIONI` (HTTP porta `80` con `Authorization: Basic` / credenziali leggibili vs HTTPS porta `443` TLS cifrato).
- **Trappola didattica reale:** se in **Percorso B** disabilita `admin` invece di cambiare password, il check di accesso del team tecnico fallisce finché non lo riabilita con la nuova password.

---

## 4. File YAML Pronti nella Repo

I 3 file YAML sono già stati creati e validati in `backend/missions/`:
- `backend/missions/cyber_day1_ports.yaml`
- `backend/missions/cyber_day2_acl.yaml`
- `backend/missions/cyber_day3_auth.yaml`

Per deployare qualsiasi giorno su CML basta passare il rispettivo spec a `cml_service.deploy_custom_topology(spec)` (che ferma automaticamente i lab precedenti rispettando il limite di 5 licenze CML-Free).
