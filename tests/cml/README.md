# Collaudi CML

| Script | Serve CML? | Cosa verifica |
|---|---|---|
| `test_config_diff.py` | no | il diff running-config / target (`backend/config_diff.py`) su running-config vere salvate in `fixtures/`, guasti tipici, `interface range`, parser dei ping e dei LED (STP, EtherChannel) |
| `verify_rooms.py` | sì | accende una stanza alla volta e lancia la Verifica (`GET /api/room/<stanza>/verify`): diff per apparato + controlli DHCP/ping del file della stanza |
| `deep_suite.py` | sì | 37 test (circa 16-18 min): comunicazione con CML (cambio stanza, licenze, lab spento da fuori, persistenza), console (IOS/Alpine, latenza, due console, errori), Verifica (baseline, guasti iniettati e ripristinati, concorrenza, mutex), LED (STP, err-disabled, shutdown, freeze silenzioso), cavi (errori, cicli rapidi, VLAN), robustezza |
| `e2e_cml.py` | sì | nella stanza "office": topologia 1:1, cavi (stacca / ricollega / sposta in un'altra VLAN con rinnovo DHCP), console WebSocket (Alpine e IOS), configurazione che resta dopo il cambio stanza |

```bash
# dalla radice del repository
python -m tests.cml.test_config_diff

# con il backend acceso (default http://127.0.0.1:8000/api)
python tests/cml/verify_rooms.py /tmp/verify.json              # tutte le stanze
python tests/cml/verify_rooms.py /tmp/verify.json corridor     # solo il corridoio
python tests/cml/e2e_cml.py /tmp/e2e.json
CML_URL=https://<cml> CML_PASS=... python tests/cml/deep_suite.py /tmp/deep.json   # suite completa
FORCE_PROVISION=1 python tests/cml/e2e_cml.py /tmp/e2e.json    # ricrea prima i lab dai file YAML
```

Gli script che usano CML **spengono gli altri lab accesi** (licenza da 5 nodi) e durano alcuni minuti
(circa 1-1,5 min per accendere una stanza, di piu' alla prima accensione dopo una ricreazione).
Escono con codice 0 solo se tutto e' verde; i dettagli finiscono nel file JSON indicato.

Riferimento dell'ultimo collaudo (14/11/2026, CML 2.10.1): ufficio 6/6, corridoio 4/4, datacenter 4/4,
tutte le configurazioni identiche al target.

Ultimo giro completo della suite approfondita: 35/37; i 2 casi rimasti (lettura chiusa in anticipo
da prompt residui sulla linea) sono stati corretti e verificati a parte sotto raffica di syslog.
