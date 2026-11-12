# 🏢 Cisco Cyber Office // Hack The Route

> **The Big Hack 2026** – Progetto didattico e simulativo per la **Challenge 04: Consorzio Clara (Cisco Networking Academy)**.

Un **serious game retro/pixel-art in stile Habbo Hotel** che introduce studenti e giovani sviluppatori al mondo del networking e della cybersecurity attraverso simulazioni tattili e missioni pratiche.

---

## 🎮 Caratteristiche e Minigiochi Inclusi (v0.0)

1. **🏢 Hub Ufficio (Stile Habbo / Retro Isometrico):**
   - Sala operativa con postazioni interattive, progress bar live della rete e dialoghi con **Marco (Senior NetAdmin)**.
   - Motore audio retro a 8-bit sintetizzato in tempo reale tramite **Web Audio API** (zero dipendenze audio esterne, click meccanici, bip ed effetti vittoria).
   - Sistema di persistenza dei progressi via `localStorage`.

2. **🔌 Minigioco 1: Datacenter Rack 01 (Layer 1-2 Cablaggio Strutturato):**
   - Simulazione frontale di un rack 19" con **Patch Panel CAT6A** e **Switch Cisco Catalyst 9300**.
   - Collegamento interattivo dei patch cable RJ45: porta router su *Trunk (802.1Q)*, porte PC su *Access (VLAN 10, 20, 30)*.
   - Feedback sonoro di aggancio (*clack*), LED dinamici (spento, ambra, verde fisso) e validazione automatica.

3. **💻 Minigioco 2: Workstation Admin (Cisco IOS CLI CRT):**
   - Emulatore terminale retro CRT con effetto curvatura, scanlines fosfori verdi e comandi Cisco reali.
   - Supporto per comandi: `enable`, `configure terminal`, `show ip interface brief`, `show vlan brief`, `interface <id>`, `no shutdown`, `switchport access vlan 20`, `exit`.
   - Autocompletamento con tasto `Tab` e navigazione cronologia con frecce `↑` e `↓`.
   - Risoluzione del Ticket #9021 (accensione porta Uplink Gi0/1 e assegnazione VLAN 20).

4. **🛡️ Minigioco 3: Cisco Umbrella SOC (Layer 7 Incident Response):**
   - Monitoraggio del traffico DNS in tempo reale dal gateway aziendale.
   - Rilevamento minaccia attiva di tipo **Ransomware Command & Control (C2) Beaconing**.
   - Integrazione policy Cisco Umbrella: blocco DNS (Sinkhole) e isolamento endpoint per prevenire il movimento laterale.

5. **🏆 Bacheca Badge & Certificazioni:**
   - Assegnazione progressiva di 4 badge ufficiali (Cavo d'Oro, Cisco IOS Ninja, Umbrella Guardian, Cisco Elite NetAdmin) con animazioni e coriandoli (`canvas-confetti`).

---

## 🚀 Come avviare il progetto

### Metodo 1: Node.js locale / Dev Server (Immediato)
```bash
cd /root/.gemini/antigravity-cli/scratch/cisco-cyber-office
npm run dev -- --host
```
Il gioco sarà raggiungibile sulla porta `5173`.

### Metodo 2: Docker Container
```bash
cd /root/.gemini/antigravity-cli/scratch/cisco-cyber-office
docker compose up -d
```
Il gioco sarà attivo sulla porta `3000`.

---

## 🛠️ Stack Tecnologico AI-Native
- **Framework:** React 18 + Vite 5 + TypeScript
- **Styling:** Tailwind CSS + Google Fonts (VT323, Press Start 2P)
- **Animazioni:** Framer Motion (transizioni fluide tra stanza e minigiochi)
- **Audio Engine:** Sintetizzatore Web Audio API autonomo
- **Icone:** Lucide React
- **Effetti:** Canvas Confetti
