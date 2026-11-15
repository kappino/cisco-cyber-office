# Task di manutenzione CML

Ingresso esplicito dal pulsante “Apri task con CML reale”. Montare il pannello
attiva /api/cml/room-sync per la stanza corrente: il backend può fermare gli altri
lab secondo il proprio contratto. Il frontend non esegue provisioning né modifica
il backend. La storia locale resta separata e non avvia API prima dell'ingresso.

Le quattro attività sono:
1. Patch: RackView, prese jack dei PC, porte degli apparati, cavi selezionabili;
   /api/room/{room}/cable esegue connect/disconnect/move reali.
2. Diagnosi: PortDiagnosisTask, /ports?fresh=true ogni otto secondi, stato e VLAN.
   Dati obsoleti e console in uso sono espliciti; nessun verde inventato.
3. Console: StatefulConsole, creazione /console-session/{room}/{node}, send/read
   e DELETE al cambio nodo o alla chiusura. Nodi dal campo console della topologia.
4. Collaudo: /verify; completamento solo con ok=true. Si mostrano diff, errori,
   controlli funzionali e, quando presenti, ordine ACL e persistenza.

Uscendo si interrompe il polling frontend e si ripristinano i dispositivi grafici
della storia. Il lab reale non viene spento dal frontend. Gli esiti della storia
non vengono usati per dichiarare superate attività CML.

Da verificare con infrastruttura reale: avvio stanza, sessione IOS e host,
collegamento tra due porte libere, scollegamento, LED dopo convergenza STP,
verifica errata/corretta, cambio stanza e chiusura sessioni. Non dichiarato live
PASS sulla sola base della compilazione o dei test della storia.

La console include modalità tastiera diretta: input serializzato nella sessione
HTTP, frecce e Ctrl+A…Z come sequenze terminale, incolla testo senza esecuzioni
aggiuntive. Tab mantiene la navigazione accessibile; il pulsante Tab invia il
carattere di autocompletamento. Alla chiusura si scartano i tasti ancora in coda.
L'output HTTP viene già ripulito dagli escape ANSI dal backend: non è un renderer
VT completo, ma i tasti sono inviati senza traduzioni dei comandi.

Prova UI con API intercettate (nessuna chiamata al backend reale): con Vite acceso,
`LIVE_TASK_TEST=1 node pipeline/test_cozy_browser.mjs`.
Verifica attivazione, porte ambra/verdi, console stateful e collaudo negativo/positivo.
Salva screenshot delle attività in /tmp/cozy-browser. Questo test non sostituisce
la verifica dei collegamenti e delle console sul CML vero.

Sonda in sola lettura dal computer che raggiunge FastAPI:
`node pipeline/probe_cml_tasks.mjs`. Usa CML_API_URL e CML_ROOM se necessario.
Non attiva stanze e non modifica cavi o configurazioni; stampa stato, nodi e LED
per verificare il primo tratto dell'integrazione. Console e mutazioni richiedono
ancora una prova interattiva separata.

Per provare anche il ciclo di vita della console sul lab già pronto:
`CML_ROOM=corridor CML_NODE=SW-ACC node pipeline/probe_cml_tasks.mjs`.
Il nodo deve corrispondere alla topologia reale. La sonda apre una sessione,
legge, invia un solo Invio, legge il prompt e chiude in finally. Non invia comandi
di configurazione, ma Invio può confermare un prompt già presente: usare un nodo
senza altre operazioni interattive in corso. Il PASS richiede output effettivo.

Il banco sostituisce la mappa nell'area di gioco. Non è più un pannello nel
fondo pagina. “Apri armadio” entra nel banco; “Torna in ufficio” ripristina la
mappa. Nel rack incorporato, il laptop occupa la colonna a destra: collegare il
cavo CON monta lì la sessione del nodo. Su mobile le colonne si impilano nello
spazio di lavoro, con scorrimento interno; la pagina resta ferma. Il test fixture
controlla su desktop l'affiancamento e l'assenza di scroll del documento e salva
live-rack-console.png.
