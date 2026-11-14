"""Collaudo end-to-end sul CML vero, nella stanza "office":
cambio stanza, topologia 1:1, cavi (stacca / ricollega / sposta in un'altra VLAN con rinnovo DHCP),
console WebSocket (login automatico su Alpine, IOS), configurazione che resta dopo il cambio stanza.

Richiede il backend acceso e collegato a CML. ATTENZIONE: spegne gli altri lab accesi (licenza da 5 nodi).
Uso:
    API=http://127.0.0.1:8000/api python tests/cml/e2e_cml.py [risultati.json]
    FORCE_PROVISION=1 ...   ricrea prima i lab di tutte le stanze dai file YAML
"""
import asyncio
import json
import os
import re
import sys
import time

import httpx
import websockets

API = os.getenv("API", "http://127.0.0.1:8000/api")
WS = API.replace("http://", "ws://").replace("https://", "wss://")
OUT = sys.argv[1] if len(sys.argv) > 1 else "e2e_cml.json"
R: dict = {"steps": []}
ANSI = re.compile(r"\x1b\[[0-9;]*[a-zA-Z]")


def step(name: str, ok: bool, detail: str = "") -> None:
    R["steps"].append({"step": name, "ok": ok, "detail": detail[-300:]})
    print(f"{'✓' if ok else '✗'} {name}  {detail[-120:]}".replace("\n", " | "))
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(R, fh, indent=1, ensure_ascii=False)


async def ready(c: httpx.AsyncClient, room: str, tmo: int = 500) -> dict:
    await c.post(f"{API}/cml/room-sync", json={"room_id": room})
    t0 = time.time()
    while time.time() - t0 < tmo:
        st = (await c.get(f"{API}/room/{room}/status")).json()
        if st["phase"] in ("ready", "error"):
            return st
        await asyncio.sleep(3)
    return st


async def cmd(c: httpx.AsyncClient, node: str, command: str) -> str:
    r = (await c.post(f"{API}/terminal/command", json={"node": node, "command": command}, timeout=60)).json()
    return ANSI.sub("", r.get("output", "")) if r.get("source") == "live_cml" else "[SIM]"


async def ws_console(room: str, node: str, keys: list, wait: float = 6) -> str:
    out = b""
    async with websockets.connect(f"{WS}/console/{room}/{node}") as ws:
        async def rd(t: float) -> None:
            nonlocal out
            end = time.time() + t
            while time.time() < end:
                try:
                    m = await asyncio.wait_for(ws.recv(), timeout=0.5)
                    out += m if isinstance(m, bytes) else m.encode()
                except asyncio.TimeoutError:
                    pass
        await rd(wait)
        for k in keys:
            await ws.send(k)
            await rd(4)
    return ANSI.sub("", out.decode(errors="ignore"))


def ip_of(text: str) -> str:
    m = re.search(r"inet (\d+\.\d+\.\d+\.\d+)/", text)
    return m.group(1) if m else ""


async def main() -> int:
    async with httpx.AsyncClient(timeout=60) as c:
        if os.getenv("FORCE_PROVISION"):
            r = await c.post(f"{API}/rooms/provision?force=true", timeout=600)
            step("lab ricreati dai file YAML", r.status_code == 200, r.text)

        st = await ready(c, "office")
        step("ufficio acceso", st["phase"] == "ready", st["message"])
        if st["phase"] != "ready":
            return 1
        await asyncio.sleep(30)

        topo = (await c.get(f"{API}/room/office/topology")).json()
        labels = sorted(d["label"] for d in topo["devices"])
        step("topologia 1:1 con il file della stanza", labels == sorted(
            ["RTR-UFFICIO", "SW-PIANO1", "PC-MARKETING", "PC-CONTABILITA", "STAMPANTE"]), str(labels))

        cab = lambda body: c.post(f"{API}/room/office/cable", json=body)  # noqa: E731
        r = await cab({"action": "unplug", "node": "PC-MARKETING", "iface": "eth0"})
        out = await cmd(c, "PC-MARKETING", "ping -c 2 -W 2 10.10.10.1")
        step("cavo staccato: il ping fallisce", r.status_code == 200 and "100% packet loss" in out, out)
        r = await cab({"action": "plug", "node": "PC-MARKETING", "iface": "eth0"})
        await asyncio.sleep(3)
        out = await cmd(c, "PC-MARKETING", "ping -c 2 -W 2 10.10.10.1")
        step("cavo ricollegato: il ping torna", r.status_code == 200 and " 0% packet loss" in out, out)

        r = await cab({"action": "move", "node": "PC-MARKETING", "iface": "eth0",
                       "to_node": "SW-PIANO1", "to_iface": "Ethernet1/1"})
        await asyncio.sleep(3)
        out = await cmd(c, "PC-MARKETING", "sudo udhcpc -i eth0 -n -q -t 4 -T 2 >/dev/null 2>&1; ip -4 addr show eth0")
        step("PC spostato nella presa VLAN 20: indirizzo dell'Amministrazione",
             r.status_code == 200 and ip_of(out).startswith("10.10.20."), ip_of(out))
        r = await cab({"action": "move", "node": "PC-MARKETING", "iface": "eth0",
                       "to_node": "SW-PIANO1", "to_iface": "Ethernet0/1"})
        await asyncio.sleep(3)
        out = await cmd(c, "PC-MARKETING", "sudo udhcpc -i eth0 -n -q -t 4 -T 2 >/dev/null 2>&1; ip -4 addr show eth0")
        step("PC riportato nella presa VLAN 10", r.status_code == 200 and ip_of(out).startswith("10.10.10."), ip_of(out))

        out = await ws_console("office", "PC-CONTABILITA", ["ip -4 addr show eth0\r"], wait=8)
        step("console WebSocket Alpine con login automatico", "10.10.20." in out, out)
        out = await ws_console("office", "RTR-UFFICIO", ["show ip interface brief\r"], wait=4)
        step("console WebSocket IOS", "Ethernet0/0.10" in out, out)

        out = await ws_console("office", "RTR-UFFICIO", ["enable\r", "configure terminal\r",
                                                        "banner motd #E2E-PERSIST#\r", "end\r"], wait=4)
        st = await ready(c, "corridor")
        step("cambio stanza: corridoio acceso", st["phase"] == "ready", st["message"])
        st = await ready(c, "office")
        await asyncio.sleep(10)
        out = await cmd(c, "RTR-UFFICIO", "show running-config | include E2E-PERSIST")
        step("configurazione rimasta dopo il cambio stanza", "E2E-PERSIST" in out, out)
        await ws_console("office", "RTR-UFFICIO", ["enable\r", "configure terminal\r", "no banner motd\r", "end\r",
                                                  "write memory\r"], wait=4)
    return 0 if all(s["ok"] for s in R["steps"]) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
