# Redesign — ufficio illustrato

## Backup precedente al redesign

`/home/enzo/TheBigHack/cisco-office-backups/20261115-014923/`

- frontend-before-redesign.tar.gz: src, public, pipeline e configurazioni frontend,
  inclusi i file non tracciati presenti prima del redesign.
- working-tree.patch: diff binario dei file tracciati.
- manifest.json: branch, commit e SHA-256 dell'archivio.

Il backup esclude backend e credenziali. Per confrontare o recuperare file,
estrarre l'archivio in una directory separata prima di copiarli nella repo.

## Direzione

Ufficio contemporaneo credibile, illustrato in isometria 2:1. Proporzioni compatte,
materiali leggibili e piccoli dettagli cartoon; nessuna ambientazione spaziale.
L'ironia dell'equipaggio si traduce in alibi da pausa caffè e piccoli sospetti da
ufficio, separati dalle spiegazioni tecniche.

Interfaccia nuova: ardesia, carta bianca, lavanda; introduzione narrativa, dossier
operativo, planimetria e spazio personale con gerarchia distinta. La scena usa
sfondo chiaro, pareti e pavimenti da ufficio, sedute blu e nomi brevi sopra i colleghi.
Missioni e banco rimangono locali; nessuna API CML viene aggiunta.

Controlli: npx tsc --noEmit, npm run lint, npm run build,
node pipeline/test_cozy_story.mjs. La verifica browser del nuovo aspetto richiede
una nuova esecuzione di pipeline/test_cozy_browser.mjs e ispezione degli screenshot:
le immagini precedenti al redesign non provano la qualità della nuova grafica.

## Audit finale del redesign

Ispezionati gli screenshot condivisi generati il 15 novembre alle 06:54:
`/tmp/cozy-browser/desktop.png`, `reception.png`, `network-studio.png`,
`qa-room.png` e `mobile-complete.png`. Confermano il nuovo tema, le tre stanze,
la gerarchia della UI e il layout mobile fino al completamento delle missioni.
Il frontend non è raggiungibile dal sandbox: non si attribuisce un nuovo PASS
browser a un comando eseguito qui. Le immagini sono state prodotte dall'host.
Backup SHA-256 ricontrollato; nessuna modifica al backend.
