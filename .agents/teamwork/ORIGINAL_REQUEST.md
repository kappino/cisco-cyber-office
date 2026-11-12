# Original User Request

## 2026-11-12T12:46:10Z

Migliorare l'esperienza di Cisco Cyber Office (The Big Hack 2026 / Challenge 04) rendendo il gioco estremamente accattivante, godibile, vivo e visivamente affascinante in stile retrò Habbo/Cyberpunk, con micro-animazioni atmosferiche, avatar dinamico, dialoghi e quiz interattivi Cisco CCNA/CyberOps, e una colonna sonora procedurale synthwave chiptune 8-bit in Web Audio API.

Working directory: /root/.gemini/antigravity-cli/scratch/cisco-cyber-office
Integrity mode: development

## Requirements

### R1. Atmosfera Visiva Viva & Effetti Particellari Isometrici
Arricchire entrambe le stanze (Ufficio Panoramico e Datacenter Sotterraneo) con animazioni continue a 60 FPS:
- Particelle di vapore animate che salgono dalla tazzina di espresso al Bar Napoletano.
- Schermi dei computer e terminali con linee di codice o flussi di dati fluorescenti in movimento.
- Bagliori neon pulsanti, riflessi dinamici della luce del tramonto sul parquet e sfumature di luce blu dal pavimento flottante del datacenter.
- Ologramma Cisco rotante o badge di sicurezza luminoso nell'area centrale.

### R2. Avatar Vivo & Interazioni Diegetiche nel Canvas
Rendere l'avatar NetCadet un vero protagonista vivo dell'ambiente:
- Quando si ferma vicino a una sedia o postazione, l'avatar si siede o si orienta verso la console di lavoro.
- Durante la pausa al bar (`coffee`), animazione con emote a fumetto (fumante tazza di espresso / trancio di pizza) e mini-aura di velocità temporanea con scie dorate.
- Micro-reazioni visive dell'avatar al completamento delle missioni (animazione di esultanza / salto con stelline).

### R3. Gamification & Dialoghi Ramificati con Quiz Didattici Cisco (Marco & SecBot)
Trasformare i dialoghi da semplici messaggi di testo a un sistema narrativo interattivo:
- **Marco (Senior NetAdmin)**: Offre un albero di dialogo con opzioni di risposta e mini-quiz veloci su concetti chiave Cisco CCNA (differenza tra Trunk e Access VLAN, default gateway, scopo del 3-way handshake). Risposte corrette assegnano punti XP e Skill Points bonus.
- **SecBot Sentinel AI**: Nel Datacenter Sotterraneo, fornisce telemetria diagnostica umoristica e consigli tecnici sui comandi di mitigazione ACL e analisi dei flussi.

### R4. Colonna Sonora Synthwave 8-bit Procedurale (Web Audio API)
Introdurre un sintetizzatore musicale integrato a oscillatori Web Audio API leggero e senza dipendenze da file esterni:
- Traccia chiptune/synthwave retrò in loop con linea di basso synth e arpeggio armonico ispirato ai classici giochi arcade anni '90.
- Il pulsante audio esistente nella barra HUD gestisce muto/unmute sia per la colonna sonora che per gli effetti sonori.
- Effetti sonori tattili migliorati (clic meccanico tastiera IBM durante l'uso del terminale, allarme cyber soft all'attivazione del ransomware).

## Acceptance Criteria

### Grafica & Atmosfera
- [ ] Il canvas isometrico renderizza elementi particellari (vapore bar, monitor attivi con dati scorrevoli, neon) a 60 FPS stabili.
- [ ] L'avatar mostra reazioni contestuali visive (animazione seduta / pausa caffè con emote / festeggiamento vittoria).

### Audio & Sound Design
- [ ] Colonna sonora chiptune/synthwave sintetizzata proceduralmente via Web Audio API, attivabile e disattivabile dal pulsante audio dell'HUD senza interruzioni o errori audio.
- [ ] Gli effetti sonori tattili (passi, clic, beep successo, ascensore) rimangono nitidi e bilanciati.

### Gameplay Didattico & Lore
- [ ] Marco propone almeno 3 quiz didattici Cisco CCNA a scelta multipla con assegnazione immediata di ricompense (XP/Skill Points).
- [ ] SecBot nel Datacenter Vault offre interazioni e lore sull'infrastruttura di rete.

### Robustezza & Performance
- [ ] `npm run build` (`tsc -b && vite build`) compila con 0 errori TypeScript o warning bloccanti.
- [ ] La suite di collaudo `node pipeline/run_qa_suite.mjs` supera al 100% tutti i 5 Gate (0 overflow, 0 collisioni layout, validità buffer canvas su mobile `412x915` e desktop `1920x1080`).
