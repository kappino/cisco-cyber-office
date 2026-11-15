# Fuori Rete — storia locale

La schermata iniziale ora usa StoryGame. Non monta App/HabboOffice, useRoomNetwork,
InfraMonitorBadge o LearningDock: nessuna API o sessione CML viene chiamata dalla storia.
I dispositivi di storyOffice sono fixture grafiche pubblicate solo sul bus Phaser.
Le configurazioni di storyMissions sono esempi scaricabili, non provisioning.

La storia segue il primo giorno di un junior durante l'open day: Alessia segnala
un cavo scollegato, Luca guida il controllo VLAN, Davide propone un guasto trunk
simulato e Gaia insegna verifica e persistenza. Ogni missione include evidenze,
scelte, spiegazione, ripetizione senza penalità e configurazione di esempio.
Il progresso usa la chiave locale cozy-story-step, separata dai badge precedenti.

La precedente UI CML resta in src/App.tsx per l'integrazione futura del team.
Non è montata dalla modalità storia.

Controlli: build TypeScript/Vite, lint e integrità dei quattro contenuti missione.
La verifica visiva mobile/desktop e del movimento resta necessaria su un host
che consenta l'avvio di Vite e del browser (il sandbox corrente nega i listener).

Aggiornamenti di giocabilità: celle 96×48, percorsi con ricerca a quattro direzioni
per aggirare mobili e rack, focus tastiera separato dalla scena. Le missioni richiedono
un sopralluogo prima delle risposte; l'ispezione è disponibile anche come pulsante
nel diario per chi usa la tastiera o lo schermo piccolo.

Test ripetibile: `node pipeline/test_cozy_story.mjs` controlla missioni, configurazioni,
spawn liberi, aree raggiungibili delle tre stanze, ostacoli e proiezione isometrica.
Non sostituisce il controllo nel browser di rendering, input e percorso completo.

Test browser predisposto: con Vite già avviato, eseguire
`BROWSER_PATH=/percorso/chromium node pipeline/test_cozy_browser.mjs`.
`COZY_URL` permette di usare un server differente. Il test prova quattro capitoli,
risposte sbagliate e corrette, completamento, ripresa e replay, overflow su tre
larghezze e assenza di richieste /api. Salva immagini in /tmp/cozy-browser.
Nell'ambiente corrente l'esecuzione si ferma perché /usr/bin/chromium non esiste;
non è quindi una verifica browser superata.

Il banco CLI nella bacheca è un esercizio libero locale. Mostra cavo, VLAN, trunk
e salvataggio e permette di osservare gli effetti dei comandi supportati. Non è
un emulatore IOS completo, non esegue networking e non modifica il progresso
narrativo. `connect reception` è esplicitamente un'azione del gioco. Il test locale
copre anche modalità di configurazione, risultati ping e persistenza del banco.

Audit asset: tutti i 21 file richiesti da BootScene sono presenti in public/assets.
Il bridge React/Phaser usa riferimenti aggiornati per stanza, orario e callback,
anche se cambiano mentre BootScene carica le risorse o alla ripresa di una partita.

## Onboarding Partenope Digital

Sei incarichi sequenziali: accoglienza e badge, cavo reception, VLAN, triage SOC,
trunk del laboratorio, collaudo e consegna. Ogni incarico richiede il briefing
con il referente e poi il sopralluogo prima delle scelte. I permessi narrativi
crescono da ospite a neoassunto, apprendista rete, osservatore SOC e operatore.
L'accesso ai task CML si sblocca dopo i primi quattro incarichi; il badge non è
una misura di sicurezza del backend. Il salvataggio usa cozy-onboarding-v2-step,
separato dai precedenti progressi a quattro missioni per evitare salti di onboarding.
