"""Collaudo sul CML vero: accende una stanza alla volta e lancia la Verifica
(diff running-config vs target + controlli DHCP/ping del file della stanza).

Richiede il backend acceso e collegato a CML.
Uso:
    API=http://127.0.0.1:8000/api python tests/cml/verify_rooms.py [risultati.json] [stanza ...]
Esempio:  python tests/cml/verify_rooms.py /tmp/verify.json corridor
Esce con codice 0 solo se tutte le stanze sono verdi.
"""
import json
import os
import sys
import time

import httpx

API = os.getenv("API", "http://127.0.0.1:8000/api")
OUT = sys.argv[1] if len(sys.argv) > 1 else "verify_rooms.json"
ROOMS = sys.argv[2:] or ["office", "corridor", "datacenter_vault"]
BOOT_TIMEOUT_S = 500
DHCP_SETTLE_S = 30  # gli host chiedono l'indirizzo qualche secondo dopo l'avvio


def main() -> int:
    results = {}
    c = httpx.Client(timeout=120)
    for room in ROOMS:
        t0 = time.time()
        c.post(f"{API}/cml/room-sync", json={"room_id": room})
        while True:
            st = c.get(f"{API}/room/{room}/status").json()
            if st["phase"] in ("ready", "error") or time.time() - t0 > BOOT_TIMEOUT_S:
                break
            time.sleep(3)
        r = {"status": st["phase"], "message": st["message"], "ready_s": round(time.time() - t0)}
        if st["phase"] == "ready":
            time.sleep(DHCP_SETTLE_S)
            v = c.get(f"{API}/room/{room}/verify")
            r["verify"] = v.json() if v.status_code == 200 else {"error": v.text}
        results[room] = r
        with open(OUT, "w", encoding="utf-8") as fh:
            json.dump(results, fh, indent=1, ensure_ascii=False)

        v = r.get("verify", {})
        print(f"== {room}: {r['status']} in {r['ready_s']} s, verifica {'OK' if v.get('ok') else 'KO'}")
        for chk in v.get("checks", []):
            print(f"   {'✓' if chk['ok'] else '✗'} {chk['label']} · {chk['detail']}")
        for d in v.get("devices", []):
            print(f"   {'✓' if d['ok'] else '✗'} {d['node']} {d.get('error') or ''}")
            for m in d["missing"]:
                print(f"       - {m['section']} | {m['line']}")
            for m in d["extra"]:
                print(f"       + {m['section']} | {m['line']}")
    return 0 if all(r.get("verify", {}).get("ok") for r in results.values()) else 1


if __name__ == "__main__":
    sys.exit(main())
