"""Suite approfondita sul CML vero: comunicazione con CML, console, Verifica, LED, cavi, robustezza.

Richiede il backend acceso e collegato a CML. Dura circa 20-25 minuti, ACCENDE E SPEGNE LE STANZE
e inietta guasti veri (poi li ripristina): nessuno deve giocare mentre gira.

Uso (dalla radice del repository):
    API=http://127.0.0.1:8000/api CML_URL=https://<cml> CML_USER=admin CML_PASS=... \\
        python tests/cml/deep_suite.py [risultati.json]
CML_URL/CML_USER/CML_PASS servono solo ai test che agiscono su CML "da fuori" (lab spento a mano).
Esce con codice 0 solo se tutti i test passano.
"""
import asyncio
import json
import os
import re
import statistics
import sys
import time
from typing import Any, Callable, Dict, List, Optional

import httpx
import websockets

API = os.getenv("API", "http://127.0.0.1:8000/api")
WS = API.replace("http://", "ws://").replace("https://", "wss://")
CML_URL = os.getenv("CML_URL", "").rstrip("/")
CML_USER = os.getenv("CML_USER", "admin")
CML_PASS = os.getenv("CML_PASS", "")
OUT = sys.argv[1] if len(sys.argv) > 1 else "deep_suite.json"
ANSI = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")
RESULTS: List[Dict[str, Any]] = []


def clean(t: str) -> str:
    return ANSI.sub("", t).replace("\r", "")


def save() -> None:
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump({"results": RESULTS,
                   "passed": sum(r["ok"] for r in RESULTS), "total": len(RESULTS)}, fh, indent=1, ensure_ascii=False)


def record(tid: str, area: str, name: str, ok: bool, detail: Any = "", t0: Optional[float] = None) -> bool:
    d = detail if isinstance(detail, str) else json.dumps(detail, ensure_ascii=False, default=str)
    RESULTS.append({"id": tid, "area": area, "name": name, "ok": bool(ok), "detail": d[-600:],
                    "seconds": round(time.time() - t0, 1) if t0 else None})
    print(f"{'PASS' if ok else 'FAIL'} {tid} {name} :: {d[-160:]}".replace("\n", " | "), flush=True)
    save()
    return bool(ok)


# ---------------------------------------------------------------------------
# helper
# ---------------------------------------------------------------------------
class Console:
    """Console WebSocket come la usa il gioco: tiene i messaggi di controllo separati dai dati
    e, durante un blocco silenzioso, fa eco locale e replay come CmlConsole."""

    def __init__(self, room: str, node: str) -> None:
        self.room, self.node = room, node
        self.data: List[str] = []
        self.ctl: List[Dict[str, Any]] = []
        self.silent = False
        self.echoed = ""
        self.ws = None
        self._task = None
        self.close_code = None

    async def __aenter__(self) -> "Console":
        self.ws = await websockets.connect(f"{WS}/console/{self.room}/{self.node}")
        self._task = asyncio.create_task(self._reader())
        await asyncio.sleep(2.5)
        return self

    async def __aexit__(self, *exc: Any) -> None:
        try:
            await self.ws.close()
        except Exception:
            pass
        if self._task:
            self._task.cancel()

    async def _reader(self) -> None:
        try:
            async for m in self.ws:
                if isinstance(m, str) and m.startswith('{"type":'):
                    msg = json.loads(m)
                    msg["_t"] = time.time()
                    self.ctl.append(msg)
                    if msg.get("type") == "lock" and msg.get("silent"):
                        self.silent = bool(msg.get("on"))
                        if not msg.get("on") and self.echoed:
                            await self.ws.send(json.dumps({"type": "replay", "echoed": self.echoed, "raw": ""}))
                            self.echoed = ""
                else:
                    self.data.append(m.decode(errors="ignore") if isinstance(m, bytes) else m)
        except websockets.ConnectionClosed as exc:
            self.close_code = exc.code
        except asyncio.CancelledError:
            pass

    async def send(self, keys: str, wait: float = 1.0) -> None:
        if self.silent:
            self.echoed += keys  # eco locale del gioco: arriva al dispositivo allo sblocco
        else:
            await self.ws.send(keys)
        await asyncio.sleep(wait)

    def text(self, since: int = 0) -> str:
        return clean("".join(self.data[since:]))

    def last_line(self) -> str:
        lines = [x for x in self.text().splitlines() if x.strip()]
        return lines[-1] if lines else ""


async def ios(room: str, node: str, lines: List[str], save_cfg: bool = False) -> str:
    """Configura un apparato come farebbe un giocatore, dalla console."""
    async with Console(room, node) as c:
        await c.send("\r", 0.8)
        await c.send("enable\r", 0.8)
        await c.send("configure terminal\r", 0.8)
        for ln in lines:
            await c.send(ln + "\r", 0.7)
        await c.send("end\r", 0.8)
        if save_cfg:
            await c.send("write memory\r", 3)
        return c.text()


async def activate(c: httpx.AsyncClient, room: str, tmo: int = 500) -> Dict[str, Any]:
    t0 = time.time()
    await c.post(f"{API}/cml/room-sync", json={"room_id": room})
    st: Dict[str, Any] = {}
    while time.time() - t0 < tmo:
        st = (await c.get(f"{API}/room/{room}/status")).json()
        if st["phase"] in ("ready", "error"):
            break
        await asyncio.sleep(3)
    st["_seconds"] = round(time.time() - t0, 1)
    return st


async def ports(c: httpx.AsyncClient, room: str, fresh: bool = True) -> Dict[str, Any]:
    return (await c.get(f"{API}/room/{room}/ports", params={"fresh": "true" if fresh else "false"})).json()


def led(p: Dict[str, Any], node: str, iface: str) -> Optional[str]:
    v = p.get("ports", {}).get(node, {}).get(iface)
    return v.get("led") if isinstance(v, dict) else None


async def wait_led(c: httpx.AsyncClient, room: str, node: str, iface: str, want: Callable[[Optional[str]], bool],
                   tmo: float = 45) -> Optional[str]:
    t0 = time.time()
    last = None
    while time.time() - t0 < tmo:
        last = led(await ports(c, room), node, iface)
        if want(last):
            return last
        await asyncio.sleep(2)
    return last


async def verify(c: httpx.AsyncClient, room: str) -> Dict[str, Any]:
    r = await c.get(f"{API}/room/{room}/verify", timeout=180)
    return r.json() if r.status_code == 200 else {"ok": False, "error": r.text, "devices": [], "checks": []}


def diff_of(v: Dict[str, Any], node: str) -> Dict[str, Any]:
    return next((d for d in v.get("devices", []) if d["node"] == node), {})


def check_of(v: Dict[str, Any], label_part: str) -> Optional[bool]:
    c = next((c for c in v.get("checks", []) if label_part in c["label"]), None)
    return c["ok"] if c else None


async def cml_api() -> Optional[httpx.AsyncClient]:
    if not (CML_URL and CML_PASS):
        return None
    cl = httpx.AsyncClient(base_url=f"{CML_URL}/api/v0", verify=False, timeout=30)
    tok = (await cl.post("/authenticate", json={"username": CML_USER, "password": CML_PASS})).text.strip().strip('"')
    cl.headers["Authorization"] = f"Bearer {tok}"
    return cl


async def running_labs(cml: httpx.AsyncClient) -> List[str]:
    tiles = (await cml.get("/populate_lab_tiles")).json()["lab_tiles"]
    return [v["lab_title"] for v in tiles.values() if v["state"] not in ("STOPPED", "DEFINED_ON_CORE")]


async def settle_verify(c: httpx.AsyncClient, room: str, tries: int = 4) -> Dict[str, Any]:
    """Verifica ripetuta finche' torna verde (ARP/DHCP/STP hanno bisogno di qualche secondo)."""
    v: Dict[str, Any] = {}
    for _ in range(tries):
        v = await verify(c, room)
        if v.get("ok"):
            return v
        await asyncio.sleep(8)
    return v


# ---------------------------------------------------------------------------
# test
# ---------------------------------------------------------------------------
async def robustness_offline(c: httpx.AsyncClient) -> None:
    t0 = time.time()
    codes = {}
    for path in ["/room/nonexistent/status", "/room/nonexistent/topology", "/room/nonexistent/ports",
                 "/room/nonexistent/verify"]:
        codes[path] = (await c.get(f"{API}{path}")).status_code
    codes["cable"] = (await c.post(f"{API}/room/nonexistent/cable",
                                   json={"action": "plug", "node": "X", "iface": "Y"})).status_code
    codes["sync"] = (await c.post(f"{API}/cml/room-sync", json={"room_id": "nonexistent"})).status_code
    record("F1", "robustezza", "stanza inesistente: 404 su tutti gli endpoint",
           all(v == 404 for v in codes.values()), codes, t0)

    t0 = time.time()
    async with Console("office", "NON-ESISTE") as con:
        await asyncio.sleep(1)
    record("B5a", "console", "console su nodo inesistente: chiusa con 4404", con.close_code == 4404,
           {"code": con.close_code, "text": con.text()[-120:]}, t0)


async def office_suite(c: httpx.AsyncClient) -> None:
    t0 = time.time()
    st = await activate(c, "office")
    if not record("A1a", "cml", "ufficio acceso", st["phase"] == "ready", st, t0):
        return
    await asyncio.sleep(25)

    t0 = time.time()
    topo = (await c.get(f"{API}/room/office/topology")).json()
    labels = sorted(d["label"] for d in topo["devices"])
    record("A1b", "cml", "topologia 1:1 (5 nodi, 4 cavi, armadio A)",
           labels == sorted(["RTR-UFFICIO", "SW-PIANO1", "PC-MARKETING", "PC-CONTABILITA", "STAMPANTE"])
           and len(topo["links"]) == 4 and [r["id"] for r in topo["racks"]] == ["A"],
           {"labels": labels, "links": len(topo["links"])}, t0)

    t0 = time.time()
    v = await settle_verify(c, "office")
    record("C1a", "verifica", "baseline ufficio verde", v.get("ok"), {"took": v.get("took_s"),
           "ko": [d["node"] for d in v.get("devices", []) if not d["ok"]] + [x["label"] for x in v.get("checks", []) if not x["ok"]]}, t0)

    # ---- console ----
    t0 = time.time()
    r = (await c.post(f"{API}/terminal/command", json={"node": "SW-PIANO1", "command": "show running-config"},
                      timeout=60)).json()
    out = r.get("output", "")
    record("B6", "console", "comando singolo: running-config completa (Building ... end)",
           r.get("source") == "live_cml" and "Building configuration" in out and re.search(r"^end\s*$", out, re.M) is not None,
           {"len": len(out), "tail": out[-60:]}, t0)

    t0 = time.time()
    async with Console("office", "RTR-UFFICIO") as con:
        await con.send("\r", 1)
        await con.send("terminal length 0\r", 1)
        mark = len(con.data)
        await con.send("show running-config\r", 4)
        txt = con.text(mark)
    record("B1", "console", "WebSocket IOS: output lungo completo", "hostname RTR-UFFICIO" in txt and re.search(r"^end\s*$", txt, re.M),
           txt[-80:], t0)

    t0 = time.time()
    async with Console("office", "PC-CONTABILITA") as con:
        await asyncio.sleep(4)
        mark = len(con.data)
        await con.send("ip -4 addr show eth0\r", 2)
        txt = con.text(mark)
    record("B2", "console", "WebSocket Alpine: login automatico", "10.10.20." in txt, txt[-120:], t0)

    t0 = time.time()
    lat = []
    async with Console("office", "SW-PIANO1") as con:
        await con.send("\r", 1)
        for ch in "show":
            n = len(con.data)
            ts = time.time()
            await con.ws.send(ch)
            while len(con.data) == n and time.time() - ts < 3:
                await asyncio.sleep(0.01)
            lat.append((time.time() - ts) * 1000)
        await con.send("\x15\r", 0.5)
    record("B3", "console", "latenza eco tasto (mediana < 300 ms)", statistics.median(lat) < 300,
           {"ms": [round(x) for x in lat]}, t0)

    t0 = time.time()
    async with Console("office", "SW-PIANO1") as a, Console("office", "SW-PIANO1") as b:
        ma, mb = len(a.data), len(b.data)
        await a.send("show clock\r", 2)
        ta, tb = a.text(ma), b.text(mb)
    record("B4", "console", "due console sullo stesso nodo vedono lo stesso output",
           "show clock" in ta and "show clock" in tb, {"a": ta[-60:], "b": tb[-60:]}, t0)

    t0 = time.time()
    async with Console("office", "SW-PIANO1") as con:
        await con.ws.send('{"type": "replay", "echoed": ')   # JSON rotto
        await con.ws.send("{")                               # tasto "{" normale
        await con.send("\x15\r", 1)
        await con.send("show clock\r", 2)
        alive = "show clock" in con.text()
    record("F2", "robustezza", "messaggi di controllo malformati non rompono la console", alive, "", t0)

    # ---- cavi ----
    t0 = time.time()
    cab = lambda b: c.post(f"{API}/room/office/cable", json=b)  # noqa: E731
    errs = {
        "occupata": (await cab({"action": "connect", "node": "SW-PIANO1", "iface": "Ethernet1/0",
                                "to_node": "SW-PIANO1", "to_iface": "Ethernet0/1"})).status_code,
        "se_stessa": (await cab({"action": "connect", "node": "SW-PIANO1", "iface": "Ethernet1/0",
                                 "to_node": "SW-PIANO1", "to_iface": "Ethernet1/0"})).status_code,
        "porta_inesistente": (await cab({"action": "connect", "node": "SW-PIANO1", "iface": "Ethernet9/9",
                                         "to_node": "SW-PIANO1", "to_iface": "Ethernet1/0"})).status_code,
        "togli_senza_cavo": (await cab({"action": "disconnect", "node": "SW-PIANO1", "iface": "Ethernet1/0"})).status_code,
        "sposta_stessa_porta": (await cab({"action": "move", "node": "PC-MARKETING", "iface": "eth0",
                                           "to_node": "SW-PIANO1", "to_iface": "Ethernet0/1"})).status_code,
        "azione_sconosciuta": (await cab({"action": "boh", "node": "PC-MARKETING", "iface": "eth0"})).status_code,
    }
    record("E1", "cavi", "operazioni non valide rifiutate con 400 (nessun 500)", all(v == 400 for v in errs.values()), errs, t0)

    t0 = time.time()
    ok = True
    for _ in range(10):
        a = (await cab({"action": "unplug", "node": "PC-MARKETING", "iface": "eth0"})).status_code
        b = (await cab({"action": "plug", "node": "PC-MARKETING", "iface": "eth0"})).status_code
        ok = ok and a == 200 and b == 200
    topo = (await c.get(f"{API}/room/office/topology")).json()
    pc = next(d for d in topo["devices"] if d["label"] == "PC-MARKETING")["interfaces"][0]
    record("E3", "cavi", "10 cicli rapidi stacca/collega: stato finale coerente",
           ok and pc["connected"] and pc["link_state"] == "STARTED" and pc["peer"] == {"node": "SW-PIANO1", "iface": "Ethernet0/1"},
           pc, t0)

    t0 = time.time()
    await cab({"action": "move", "node": "PC-MARKETING", "iface": "eth0", "to_node": "SW-PIANO1", "to_iface": "Ethernet1/1"})
    await asyncio.sleep(3)
    o1 = (await c.post(f"{API}/terminal/command", json={"node": "PC-MARKETING",
          "command": "sudo udhcpc -i eth0 -n -q -t 4 -T 2 >/dev/null 2>&1; ip -4 addr show eth0"}, timeout=60)).json()["output"]
    await cab({"action": "move", "node": "PC-MARKETING", "iface": "eth0", "to_node": "SW-PIANO1", "to_iface": "Ethernet0/1"})
    await asyncio.sleep(3)
    o2 = (await c.post(f"{API}/terminal/command", json={"node": "PC-MARKETING",
          "command": "sudo udhcpc -i eth0 -n -q -t 4 -T 2 >/dev/null 2>&1; ip -4 addr show eth0"}, timeout=60)).json()["output"]
    ip1 = re.search(r"inet (\S+)/", o1)
    ip2 = re.search(r"inet (\S+)/", o2)
    record("E2", "cavi", "PC spostato in presa VLAN 20 -> 10.10.20.x, riportato -> 10.10.10.x",
           bool(ip1 and ip1.group(1).startswith("10.10.20.") and ip2 and ip2.group(1).startswith("10.10.10.")),
           {"vlan20": ip1.group(1) if ip1 else None, "vlan10": ip2.group(1) if ip2 else None}, t0)

    # ---- Verifica: guasti iniettati ----
    faults = [
        ("C2", "porta del PC Marketing in VLAN 20", "SW-PIANO1",
         ["interface Ethernet0/1", "switchport access vlan 20"], ["interface Ethernet0/1", "switchport access vlan 10"],
         ("interface Ethernet0/1", "switchport access vlan 10"), "PC Marketing raggiunge il suo gateway"),
        ("C3", "interfaccia del router spenta", "RTR-UFFICIO",
         ["interface Ethernet0/0", "shutdown"], ["interface Ethernet0/0", "no shutdown"],
         None, "PC Contabilita' raggiunge la stampante"),
        ("C4", "VLAN 20 tolta dal trunk", "SW-PIANO1",
         ["interface Ethernet0/0", "switchport trunk allowed vlan 10,30,99"],
         ["interface Ethernet0/0", "switchport trunk allowed vlan 10,20,30,99"],
         ("interface Ethernet0/0", "switchport trunk allowed vlan 10,20,30,99"), "PC Contabilita' raggiunge la stampante"),
    ]
    for tid, name, node, inject, fix, want_missing, want_check_fail in faults:
        t0 = time.time()
        await ios("office", node, inject)
        await asyncio.sleep(6)
        v = await verify(c, "office")
        d = diff_of(v, node)
        missing = {(m["section"], m["line"]) for m in d.get("missing", [])}
        extra = {(m["section"], m["line"]) for m in d.get("extra", [])}
        diff_ok = (want_missing in missing) if want_missing else (("interface Ethernet0/0", "shutdown") in extra)
        func_ok = check_of(v, want_check_fail) is False
        await ios("office", node, fix)
        v2 = await settle_verify(c, "office")
        record(tid, "verifica", f"guasto '{name}': trovato nel diff e nei ping, poi ripristinato",
               not v.get("ok") and diff_ok and func_ok and v2.get("ok"),
               {"diff": diff_ok, "ping_fallito": func_ok, "missing": sorted(missing)[:3], "extra": sorted(extra)[:3],
                "verde_dopo": v2.get("ok")}, t0)

    t0 = time.time()
    v1, v2 = await asyncio.gather(verify(c, "office"), verify(c, "office"))
    record("C5", "verifica", "due Verifiche contemporanee coerenti e verdi", v1.get("ok") and v2.get("ok"),
           {"t1": v1.get("took_s"), "t2": v2.get("took_s"), "e1": v1.get("error"), "e2": v2.get("error")}, t0)

    # ---- mutex della Verifica con console aperta, sottomodalita' e riga a meta' ----
    t0 = time.time()
    async with Console("office", "SW-PIANO1") as con:
        for k in ["\r", "enable\r", "configure terminal\r", "interface Ethernet1/0\r"]:
            await con.send(k, 0.8)
        await con.send("descr", 0.5)
        mark = len(con.data)
        v = await verify(c, "office")
        await asyncio.sleep(2)
        leaked = con.text(mark)
        locks = [(m.get("on"), m.get("silent")) for m in con.ctl if m.get("type") == "lock"]
        await con.send("iption mutex-test\r", 1)
        await con.send("do show running-config interface Ethernet1/0\r", 3)
        txt = con.text()
        prompt = con.last_line()
        await con.send("no description\r", 0.8)
        await con.send("description presa libera sala riunioni (Marketing)\r", 0.8)
        await con.send("end\r", 0.8)
    record("C6", "interazione", "Verifica con console aperta: blocco visibile, nessun output, modalita' e riga ripristinate",
           v.get("ok") and (True, False) in locks and (False, False) in locks
           and "Building configuration" not in leaked.split("do show")[0]
           and " description mutex-test" in txt and prompt.endswith("(config-if)#"),
           {"locks": locks, "leak": leaked[:150], "prompt": prompt}, t0)

    # ---- freeze silenzioso dei LED con buffer ----
    t0 = time.time()
    async with Console("office", "SW-PIANO1") as con:
        for k in ["\r", "enable\r", "configure terminal\r", "interface Ethernet1/2\r"]:
            await con.send(k, 0.8)
        await asyncio.sleep(4)                       # fermo al prompt: il freeze e' permesso
        mark = len(con.data)
        task = asyncio.create_task(ports(c, "office"))
        t_wait = time.time()
        while not con.silent and time.time() - t_wait < 6:
            await asyncio.sleep(0.05)
        froze = con.silent
        await con.send("desc", 0.2)                  # scritto durante il freeze (eco locale)
        p = await task
        await asyncio.sleep(2.5)
        await con.send("ription freeze-test\r", 1.2)
        await con.send("do show running-config interface Ethernet1/2\r", 3)
        txt = con.text(mark)
        await con.send("no description\r", 0.8)
        await con.send("description presa libera (Servizi)\r", 0.8)
        await con.send("end\r", 0.8)
    cond = {"freeze": froze, "porte_lette": "Ethernet0/0" in p["ports"].get("SW-PIANO1", {}),
            "non_aggiornate": p["ports"].get("SW-PIANO1", {}).get("_stale"),
            "comando_arrivato": " description freeze-test" in txt, "eco_doppia": "descdesc" in txt,
            "output_automatico_visibile": "show interfaces" in txt}
    record("D6", "interazione", "freeze LED su console inattiva: silenzioso, buffer inviato, niente eco doppia",
           cond["freeze"] and cond["porte_lette"] and cond["comando_arrivato"] and not cond["eco_doppia"]
           and not cond["output_automatico_visibile"], {**cond, "testo": txt[:200]}, t0)

    t0 = time.time()
    async with Console("office", "SW-PIANO1") as con:
        await con.send("\r", 0.3)
        stop = time.time() + 6
        pr = None
        while time.time() < stop:                    # il giocatore sta scrivendo
            await con.ws.send("x")
            if pr is None:
                pr = asyncio.create_task(ports(c, "office"))
            await asyncio.sleep(0.4)
        p = await pr
        await con.send("\x15\r", 0.5)
        silent_locks = [m for m in con.ctl if m.get("type") == "lock" and m.get("silent")]
    record("D7", "interazione", "giocatore che scrive: nessun freeze, LED all'ultimo valore",
           not silent_locks and p["ports"].get("SW-PIANO1", {}).get("_console_in_use") is True,
           {"silent_locks": len(silent_locks)}, t0)


async def corridor_suite(c: httpx.AsyncClient) -> None:
    t0 = time.time()
    st = await activate(c, "corridor")
    if not record("A1c", "cml", "corridoio acceso (cambio stanza)", st["phase"] == "ready", st, t0):
        return
    await asyncio.sleep(25)

    t0 = time.time()
    v = await settle_verify(c, "corridor")
    record("C1b", "verifica", "baseline corridoio verde", v.get("ok"),
           {"ko": [d["node"] for d in v.get("devices", []) if not d["ok"]] + [x["label"] for x in v.get("checks", []) if not x["ok"]]}, t0)

    t0 = time.time()
    await ports(c, "corridor")
    await asyncio.sleep(8)
    p = await ports(c, "corridor")
    leds = {k: led(p, *k.split(" ")) for k in ["SW-ACC Ethernet1/0", "SW-ACC Ethernet0/1", "SW-ACC Ethernet0/3",
                                               "SW-DIST Ethernet1/0", "RTR-CORE Ethernet0/0", "RTR-CORE Ethernet0/1"]}
    record("D1", "led", "baseline: riserva Altn BLK ambra lampeggiante, link verdi, router inutilizzato spento",
           leds["SW-ACC Ethernet1/0"] == "amber_blink" and leds["SW-DIST Ethernet1/0"] in ("green", "green_blink")
           and leds["SW-ACC Ethernet0/1"] in ("green", "green_blink") and leds["RTR-CORE Ethernet0/0"] in ("green", "green_blink")
           and leds["RTR-CORE Ethernet0/1"] == "off", leds, t0)

    t0 = time.time()
    await ios("corridor", "SW-DIST", ["interface Ethernet0/3", "shutdown"])
    off = await wait_led(c, "corridor", "SW-DIST", "Ethernet0/3", lambda x: x == "off", 30)
    await ios("corridor", "SW-DIST", ["interface Ethernet0/3", "no shutdown"])
    on = await wait_led(c, "corridor", "SW-DIST", "Ethernet0/3", lambda x: x in ("green", "green_blink"), 40)
    record("D2", "led", "shutdown -> spento, no shutdown -> verde", off == "off" and on in ("green", "green_blink"),
           {"shut": off, "no_shut": on}, t0)

    t0 = time.time()
    await c.post(f"{API}/room/corridor/cable", json={"action": "connect", "node": "SW-DIST", "iface": "Ethernet1/1",
                                                     "to_node": "SW-ACC", "to_iface": "Ethernet1/1"})
    err = await wait_led(c, "corridor", "SW-ACC", "Ethernet1/1", lambda x: x == "amber", 40)
    syst = (await ports(c, "corridor"))["ports"].get("SW-ACC", {}).get("_syst")
    await c.post(f"{API}/room/corridor/cable", json={"action": "disconnect", "node": "SW-ACC", "iface": "Ethernet1/1"})
    await ios("corridor", "SW-ACC", ["interface Ethernet1/1", "shutdown", "no shutdown"])
    await asyncio.sleep(5)
    syst2 = (await ports(c, "corridor"))["ports"].get("SW-ACC", {}).get("_syst")
    record("D3", "led", "BPDU guard: err-disabled ambra + SYST ambra, poi ripristino",
           err == "amber" and syst == "amber" and syst2 == "green", {"led": err, "syst": syst, "syst_dopo": syst2}, t0)

    t0 = time.time()
    await ios("corridor", "SW-ACC", ["interface Port-channel1", "shutdown"])
    fwd = await wait_led(c, "corridor", "SW-ACC", "Ethernet1/0", lambda x: x in ("green", "green_blink"), 50)
    await ios("corridor", "SW-ACC", ["interface Port-channel1", "no shutdown"])
    blk = await wait_led(c, "corridor", "SW-ACC", "Ethernet1/0", lambda x: x == "amber_blink", 70)
    record("D5", "led", "STP reale: Po1 giu' -> riserva in inoltro (verde), Po1 su -> riserva bloccata (ambra lamp.)",
           fwd in ("green", "green_blink") and blk == "amber_blink", {"po1_giu": fwd, "po1_su": blk}, t0)

    t0 = time.time()
    await c.post(f"{API}/room/corridor/cable", json={"action": "unplug", "node": "PC-HELPDESK", "iface": "eth0"})
    topo = (await c.get(f"{API}/room/corridor/topology")).json()
    sw = next(d for d in topo["devices"] if d["label"] == "SW-ACC")
    port = next(i for i in sw["interfaces"] if i["label"] == "Ethernet0/3")
    backend_led = await wait_led(c, "corridor", "SW-ACC", "Ethernet0/3", lambda x: x == "off", 25)
    await c.post(f"{API}/room/corridor/cable", json={"action": "plug", "node": "PC-HELPDESK", "iface": "eth0"})
    record("D4", "led", "cavo fermo in CML: link STOPPED nella topologia (il gioco spegne il LED)",
           port["link_state"] == "STOPPED", {"link_state": port["link_state"], "led_letto_da_IOL": backend_led}, t0)

    t0 = time.time()
    res = await asyncio.gather(
        ports(c, "corridor"), verify(c, "corridor"),
        c.post(f"{API}/terminal/command", json={"node": "SW-DIST", "command": "show running-config"}, timeout=90),
        ports(c, "corridor"))
    out = res[2].json().get("output", "")
    record("F3", "robustezza", "LED + Verifica + comando sullo stesso nodo in contemporanea: nessun output mescolato",
           bool(res[1].get("ok")) and "show interfaces" not in out and "Building configuration" in out,
           {"verifica_ok": res[1].get("ok"), "errori": [d.get("error") for d in res[1].get("devices", []) if d.get("error")],
            "cmd_pulito": "show interfaces" not in out and "Building configuration" in out}, t0)
    v = await settle_verify(c, "corridor")
    record("F3b", "robustezza", "corridoio di nuovo verde dopo i test", v.get("ok"),
           {"ko": [d["node"] for d in v.get("devices", []) if not d["ok"]] + [x["label"] for x in v.get("checks", []) if not x["ok"]]}, t0)


async def datacenter_suite(c: httpx.AsyncClient) -> None:
    t0 = time.time()
    st = await activate(c, "datacenter_vault")
    if not record("A1d", "cml", "datacenter acceso (cambio stanza)", st["phase"] == "ready", st, t0):
        return
    await asyncio.sleep(25)
    t0 = time.time()
    v = await settle_verify(c, "datacenter_vault")
    record("C1c", "verifica", "baseline datacenter verde", v.get("ok"),
           {"ko": [d["node"] for d in v.get("devices", []) if not d["ok"]] + [x["label"] for x in v.get("checks", []) if not x["ok"]]}, t0)


async def lifecycle_suite(c: httpx.AsyncClient) -> None:
    cml = await cml_api()

    t0 = time.time()
    await c.post(f"{API}/cml/room-sync", json={"room_id": "corridor"})
    await asyncio.sleep(1)
    st = await activate(c, "office")
    running = await running_labs(cml) if cml else None
    record("A3", "cml", "cambio rapido corridoio->ufficio: vince l'ultimo, un solo lab acceso",
           st["phase"] == "ready" and (running is None or running == ["FuoriRete_Room_Office"]),
           {"stato": st["phase"], "accesi": running}, t0)

    t0 = time.time()
    r1 = (await c.post(f"{API}/cml/room-sync", json={"room_id": "office"})).json()
    r2 = (await c.post(f"{API}/cml/room-sync", json={"room_id": "office"})).json()
    await asyncio.sleep(2)
    s = (await c.get(f"{API}/room/office/status")).json()
    record("A2", "cml", "richieste doppie sulla stanza gia' accesa: restano 'ready', nessun riavvio",
           r1["status"]["phase"] == "ready" and r2["status"]["phase"] == "ready" and s["phase"] == "ready",
           {"r1": r1["status"]["phase"], "r2": r2["status"]["phase"]}, t0)

    t0 = time.time()
    await ios("office", "RTR-UFFICIO", ["banner motd #DEEP-SUITE-PERSIST#"])
    st1 = await activate(c, "corridor")
    st2 = await activate(c, "office")
    await asyncio.sleep(10)
    out = (await c.post(f"{API}/terminal/command", json={"node": "RTR-UFFICIO",
           "command": "show running-config | include DEEP-SUITE"}, timeout=60)).json().get("output", "")
    await ios("office", "RTR-UFFICIO", ["no banner motd"], save_cfg=True)
    record("A5", "cml", "configurazione non salvata dal giocatore resta dopo il cambio stanza (write memory automatico)",
           st1["phase"] == "ready" and st2["phase"] == "ready" and "DEEP-SUITE-PERSIST" in out,
           {"corridoio": st1["_seconds"], "ufficio": st2["_seconds"], "out": out[-80:]}, t0)

    if cml:
        t0 = time.time()
        lid = (await c.get(f"{API}/room/office/topology")).json()["lab_id"]
        await cml.put(f"/labs/{lid}/stop")
        await asyncio.sleep(8)
        topo = (await c.get(f"{API}/room/office/topology")).json()
        detected = topo["status"]["phase"] == "error"
        async with Console("office", "SW-PIANO1") as con:
            await asyncio.sleep(1)
        st = await activate(c, "office")
        record("A4", "cml", "lab spento da fuori: rilevato, console rifiutata (4409), recupero con nuova accensione",
               detected and con.close_code == 4409 and st["phase"] == "ready",
               {"rilevato": detected, "console": con.close_code, "recupero": st["phase"], "s": st["_seconds"]}, t0)
        await cml.aclose()
    else:
        record("A4", "cml", "lab spento da fuori (saltato: mancano CML_URL/CML_PASS)", True, "saltato")

    t0 = time.time()
    await asyncio.sleep(20)
    v = await settle_verify(c, "office")
    hs = await asyncio.gather(*[c.get(f"{API}/health") for _ in range(10)])
    record("F5", "robustezza", "fine suite: ufficio verde, /health sotto carico risponde",
           v.get("ok") and all(h.status_code == 200 for h in hs),
           {"verifica": v.get("ok"), "health": [h.status_code for h in hs][:3]}, t0)


async def main() -> int:
    t_all = time.time()
    async with httpx.AsyncClient(timeout=120) as c:
        for part in (robustness_offline, office_suite, corridor_suite, datacenter_suite, lifecycle_suite):
            try:
                await part(c)
            except Exception as exc:  # un blocco che esplode non ferma gli altri
                record(f"ERR-{part.__name__}", "suite", f"eccezione in {part.__name__}", False, repr(exc))
    print(f"\n{sum(r['ok'] for r in RESULTS)}/{len(RESULTS)} test passati in {round((time.time() - t_all) / 60, 1)} min")
    save()
    return 0 if all(r["ok"] for r in RESULTS) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
