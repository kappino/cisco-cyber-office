"""Accoppiamento 1:1 tra le stanze del gioco e i lab CML.

Ogni stanza ha un file `backend/rooms/<room_id>.yaml` che descrive la rete corretta
(nodi, configurazioni, collegamenti) e dove compare ogni dispositivo nel gioco.
Il gioco disegna esattamente i nodi del lab: stessi nomi, stesso numero.

Ciclo di vita (licenza CML da 5 nodi, "soluzione 1"):
  entrando in una stanza -> salva la configurazione degli apparati IOS accesi
  (`write memory`), spegne gli altri lab SENZA cancellarli (stop, non wipe),
  aspetta che siano davvero spenti, accende il lab della stanza e aspetta che
  tutti i nodi siano BOOTED. Lo stato e' sempre leggibile da /api/room/<id>/status.
"""
from __future__ import annotations

import asyncio
import hashlib
import os
import re
import threading
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

import httpx
import paramiko
import yaml

ROOMS_DIR = Path(__file__).parent / "rooms"

CML_URL = os.getenv("CML_URL", "https://192.168.122.110").rstrip("/")
CML_USER = os.getenv("CML_USER", "admin")
CML_PASS = os.getenv("CML_PASS", "changeme")
_CML_HOST = re.sub(r"^https?://", "", CML_URL).split("/")[0].split(":")[0]
# Console server di CML ("termserv"): porta 22 della VM CML (NON la 1122, che e' la shell di sistema).
CONSOLE_HOST = os.getenv("CML_CONSOLE_HOST", _CML_HOST)
CONSOLE_PORT = int(os.getenv("CML_CONSOLE_PORT", "22"))
LINUX_USER = os.getenv("CML_LINUX_USER", "cisco")
LINUX_PASS = os.getenv("CML_LINUX_PASS", "cisco")

STOP_TIMEOUT_S = 90
BOOT_TIMEOUT_S = 300
OFF_STATES = {"STOPPED", "DEFINED_ON_CORE"}  # nodo spento (mai acceso o fermato)
IOS_DEFS = {"iol-xe", "ioll2-xe", "iosv", "iosvl2", "csr1000v", "cat8000v"}
LINUX_DEFS = {"alpine", "ubuntu", "desktop", "server", "net-tools"}
IOS_PROMPT = re.compile(r"[\w\-.]+(\([\w\-.]+\))?[>#]\s*$")
LINUX_PROMPT = re.compile(r"[\w\-.@:~/ ]*[$#]\s*$")


# ---------------------------------------------------------------------------
# Specifiche delle stanze
# ---------------------------------------------------------------------------
def load_rooms() -> Dict[str, Dict[str, Any]]:
    rooms: Dict[str, Dict[str, Any]] = {}
    for f in sorted(ROOMS_DIR.glob("*.yaml")):
        text = f.read_text(encoding="utf-8")
        spec = yaml.safe_load(text)
        cml_part = {"nodes": [{k: n.get(k) for k in ("label", "cml_def", "config", "min_interfaces")}
                              for n in spec["nodes"]], "links": spec["links"]}
        spec["hash"] = hashlib.sha1(yaml.safe_dump(cml_part, sort_keys=True).encode()).hexdigest()[:12]
        if len(spec.get("nodes", [])) > 5:
            raise ValueError(f"{f.name}: piu' di 5 nodi, oltre la licenza CML")
        rooms[spec["room_id"]] = spec
    return rooms


ROOMS = load_rooms()


def room_spec(room_id: str) -> Dict[str, Any]:
    if room_id not in ROOMS:
        raise KeyError(f"stanza sconosciuta: {room_id}")
    return ROOMS[room_id]


def node_spec(room_id: str, label: str) -> Optional[Dict[str, Any]]:
    return next((n for n in room_spec(room_id)["nodes"] if n["label"] == label), None)


def day0_config(spec: Dict[str, Any], node: Dict[str, Any]) -> str:
    """Configurazione iniziale del nodo, cosi' com'e' nel file della stanza (comandi IOS classici).
    Le interfacce dei router senza IP vengono accese al primo avvio da console: vedi first_boot_fixups."""
    return node.get("config", "") or ""


# ---------------------------------------------------------------------------
# Client REST CML
# ---------------------------------------------------------------------------
class CmlApi:
    def __init__(self) -> None:
        self._token: Optional[str] = None
        self._client: Optional[httpx.AsyncClient] = None

    def _c(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(base_url=f"{CML_URL}/api/v0", verify=False, timeout=20.0)
        return self._client

    async def _auth(self) -> None:
        r = await self._c().post("/authenticate", json={"username": CML_USER, "password": CML_PASS})
        r.raise_for_status()
        self._token = r.text.strip().strip('"')

    async def req(self, method: str, path: str, **kw: Any) -> httpx.Response:
        if not self._token:
            await self._auth()
        for attempt in range(2):
            r = await self._c().request(method, path, headers={"Authorization": f"Bearer {self._token}"}, **kw)
            if r.status_code == 401 and attempt == 0:
                await self._auth()
                continue
            return r
        return r

    async def get(self, path: str) -> Any:
        r = await self.req("GET", path)
        r.raise_for_status()
        return r.json()

    async def put(self, path: str) -> httpx.Response:
        return await self.req("PUT", path)


# ---------------------------------------------------------------------------
# Console (termserv di CML via SSH)
# ---------------------------------------------------------------------------
def open_console(lab_title: str, node_label: str, width: int = 120, height: int = 32
                 ) -> Tuple[paramiko.SSHClient, paramiko.Channel, bytes]:
    """Apre la console seriale del nodo. Ritorna (ssh, canale, testo gia' ricevuto dopo il preambolo)."""
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(CONSOLE_HOST, port=CONSOLE_PORT, username=CML_USER, password=CML_PASS,
                timeout=8, look_for_keys=False, allow_agent=False)
    chan = ssh.invoke_shell(term="xterm", width=width, height=height)
    chan.settimeout(0.3)
    chan.send(f"open /{lab_title}/{node_label}/0\r")
    buf = b""
    marker = b"Escape character is '^]'."
    t0 = time.time()
    while time.time() - t0 < 10:
        try:
            data = chan.recv(65535)
        except Exception:
            data = b""
        if data:
            buf += data
            if marker in buf:
                rest = buf.split(marker, 1)[1]
                return ssh, chan, rest
            if b"not found" in buf.lower() or b"error" in buf.lower():
                break
    ssh.close()
    raise RuntimeError(f"console di {node_label} non disponibile: {buf[-200:].decode(errors='ignore')}")


def _read_until(chan: paramiko.Channel, pred: Callable[[str], bool], timeout: float) -> str:
    out = ""
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            data = chan.recv(65535)
        except Exception:
            data = b""
        if data:
            out += data.decode(errors="ignore")
            if pred(out):
                break
    return out


def _linux_login(chan: paramiko.Channel, out: str) -> str:
    if "login:" in out[-60:]:
        chan.send(LINUX_USER + "\r")
        out += _read_until(chan, lambda s: "Password:" in s[-40:], 5)
        chan.send(LINUX_PASS + "\r")
        out += _read_until(chan, lambda s: bool(LINUX_PROMPT.search(s.splitlines()[-1] if s else "")), 6)
    return out


def run_console_command(lab_title: str, node_label: str, cml_def: str, command: str, timeout: float = 10) -> str:
    """Esegue un comando sulla console vera e restituisce l'output completo (fino al prompt)."""
    return run_console_commands(lab_title, node_label, cml_def, [command], timeout)[0]


def run_console_commands(lab_title: str, node_label: str, cml_def: str, commands: List[str],
                         timeout: float = 10) -> List[str]:
    """Piu' comandi nella stessa sessione console (una sola connessione)."""
    ssh, chan, _ = open_console(lab_title, node_label)
    try:
        linux = cml_def in LINUX_DEFS
        chan.send("\r")
        out = _read_until(chan, lambda s: bool(s.strip()) and (
            "login:" in s[-60:] or bool((LINUX_PROMPT if linux else IOS_PROMPT).search(s.rstrip("\r\n").splitlines()[-1]))), 4)
        if linux:
            _linux_login(chan, out)
        else:
            chan.send("\x1a\renable\r")  # comandi privilegiati (show run, ecc.); nessuna enable secret nei lab
            _read_until(chan, lambda s: s.rstrip().endswith("#"), 3)
            chan.send("terminal length 0\r")
            _read_until(chan, lambda s: bool(IOS_PROMPT.search(s.rstrip().splitlines()[-1] if s.strip() else "")), 3)
        prompt = LINUX_PROMPT if linux else IOS_PROMPT

        def done(s: str) -> bool:
            lines = s.rstrip("\r\n ").splitlines()
            return len(lines) > 1 and bool(prompt.search(lines[-1]))
        results = []
        for command in commands:
            chan.send(command + "\r")
            out = _read_until(chan, done, timeout)
            lines = out.replace("\r", "").splitlines()
            if lines and command.strip() in lines[0]:
                lines = lines[1:]
            results.append("\n".join(lines).rstrip())
        return results
    finally:
        ssh.close()


def save_ios_config(lab_title: str, node_label: str) -> bool:
    """`write memory` dalla console: la configurazione resta dopo stop/start (verificato su CML 2.10)."""
    ssh, chan, _ = open_console(lab_title, node_label)
    try:
        chan.send("\r\x1a\r")  # Ctrl+Z: esce da eventuale modalita' configurazione
        _read_until(chan, lambda s: s.rstrip().endswith(("#", ">")), 3)
        chan.send("enable\r")
        _read_until(chan, lambda s: s.rstrip().endswith(("#", "Password:")), 3)
        chan.send("write memory\r")
        out = _read_until(chan, lambda s: "[OK]" in s or "Invalid" in s, 15)
        return "[OK]" in out
    finally:
        ssh.close()


def console_configure(lab_title: str, node_label: str, lines: List[str]) -> str:
    """Applica righe di configurazione dalla console vera e salva (write memory)."""
    ssh, chan, _ = open_console(lab_title, node_label)
    try:
        chan.send("\r\x1a\renable\r")
        _read_until(chan, lambda s: s.rstrip().endswith("#"), 4)
        chan.send("configure terminal\r")
        _read_until(chan, lambda s: s.rstrip().endswith("(config)#"), 4)
        for ln in lines:
            chan.send(ln + "\r")
            _read_until(chan, lambda s: s.rstrip().endswith("#"), 3)
        chan.send("end\r")
        _read_until(chan, lambda s: s.rstrip().endswith("#"), 3)
        chan.send("write memory\r")
        return _read_until(chan, lambda s: "[OK]" in s, 15)
    finally:
        ssh.close()


def first_boot_fixups(spec: Dict[str, Any]) -> List[Tuple[str, List[str]]]:
    """Righe da applicare al primo avvio: su IOL la `no shutdown` iniziale delle interfacce
    senza indirizzo IP (es. la madre delle sottointerfacce) viene ignorata (verificato su CML 2.10)."""
    out = []
    for n in spec["nodes"]:
        if n["cml_def"] in IOS_DEFS and n.get("kind") == "switch" and "channel-group" in (n.get("config") or ""):
            # al primo avvio IOL sospende il canale LACP: si rinegozia spegnendo e riaccendendo i membri
            members, cur = [], None
            for ln in (n.get("config") or "").splitlines():
                if ln.startswith("interface "):
                    cur = ln[len("interface "):].strip()
                elif "channel-group" in ln and cur:
                    members.append(cur)
            lines = [x for i in members for x in (f"interface {i}", "shutdown", "no shutdown")]
            if lines:
                out.append((n["label"], lines))
        if n["cml_def"] in IOS_DEFS and n.get("kind") == "router":
            linked = [ai for a, ai, b, bi in spec["links"] if a == n["label"]] + \
                     [bi for a, ai, b, bi in spec["links"] if b == n["label"]]
            lines = [x for i in linked for x in (f"interface {i}", "no shutdown")]
            if lines:
                out.append((n["label"], lines))
    return out


# ---------------------------------------------------------------------------
# Gestore delle stanze
# ---------------------------------------------------------------------------
class RoomManager:
    def __init__(self) -> None:
        self.api = CmlApi()
        self.lock = asyncio.Lock()
        self.active_room: Optional[str] = None
        self.status: Dict[str, Dict[str, Any]] = {
            r: {"room_id": r, "phase": "idle", "message": "", "ready_nodes": 0,
                "total_nodes": len(s["nodes"]), "updated": time.time()}
            for r, s in ROOMS.items()
        }
        self._lab_ids: Dict[str, str] = {}
        self._task: Optional[asyncio.Task] = None
        self._wanted: Optional[str] = None

    # ---- utilita' -------------------------------------------------------
    def _set(self, room: str, phase: str, message: str = "", **extra: Any) -> None:
        self.status[room].update({"phase": phase, "message": message, "updated": time.time(), **extra})

    async def find_lab(self, title: str) -> Optional[str]:
        lid = self._lab_ids.get(title)
        if lid:
            r = await self.api.req("GET", f"/labs/{lid}")
            if r.status_code == 200 and r.json().get("lab_title") == title:
                return lid
            self._lab_ids.pop(title, None)
        for lid in await self.api.get("/labs"):
            info = await self.api.get(f"/labs/{lid}")
            self._lab_ids.setdefault(info["lab_title"], lid)
            if info["lab_title"] == title:
                self._lab_ids[title] = lid
                return lid
        return None

    async def _nodes(self, lid: str) -> List[Dict[str, Any]]:
        return await self.api.get(f"/labs/{lid}/nodes?data=true")

    async def _wait_nodes(self, lid: str, pred: Callable[[Dict[str, Any]], bool], timeout: float,
                          on_progress: Optional[Callable[[int, int], None]] = None) -> bool:
        t0 = time.time()
        while time.time() - t0 < timeout:
            nodes = await self._nodes(lid)
            ok = sum(1 for n in nodes if pred(n))
            if on_progress:
                on_progress(ok, len(nodes))
            if nodes and ok == len(nodes):
                return True
            await asyncio.sleep(2)
        return False

    # ---- creazione dei lab dalle specifiche ------------------------------
    async def provision(self, room_id: str, force: bool = False) -> str:
        """Crea il lab della stanza se manca o se il file YAML e' cambiato (impronta nelle note del lab)."""
        spec = room_spec(room_id)
        mark = f"fr-hash:{spec['hash']}"
        lid = await self.find_lab(spec["lab_title"])
        if lid:
            info = await self.api.get(f"/labs/{lid}")
            if mark in (info.get("lab_notes") or "") and not force:
                return lid
            await self.api.put(f"/labs/{lid}/stop")
            await self._wait_nodes(lid, lambda n: n["state"] in OFF_STATES, STOP_TIMEOUT_S)
            await self.api.put(f"/labs/{lid}/wipe")
            await self.api.req("DELETE", f"/labs/{lid}")
            self._lab_ids.pop(spec["lab_title"], None)

        r = await self.api.req("POST", "/labs", json={
            "title": spec["lab_title"], "description": spec.get("description", ""),
            "notes": f"Generato da backend/rooms/{room_id}.yaml - non modificare a mano.\n{mark}"})
        r.raise_for_status()
        lid = r.json()["id"]
        self._lab_ids[spec["lab_title"]] = lid

        iface_ids: Dict[Tuple[str, str], str] = {}
        for n in spec["nodes"]:
            x, y = n.get("cml_xy", [0, 0])
            r = await self.api.req("POST", f"/labs/{lid}/nodes?populate_interfaces=true", json={
                "label": n["label"], "node_definition": n["cml_def"], "x": x, "y": y,
                "configuration": day0_config(spec, n)})
            r.raise_for_status()
            nid = r.json()["id"]
            ifs = [i for i in await self.api.get(f"/labs/{lid}/nodes/{nid}/interfaces?data=true")
                   if i.get("type") == "physical"]
            want = int(n.get("min_interfaces", 0))
            slot = len(ifs)
            while slot < want:
                rr = await self.api.req("POST", f"/labs/{lid}/interfaces", json={"node": nid, "slot": slot})
                rr.raise_for_status()
                slot += 1
            for i in await self.api.get(f"/labs/{lid}/nodes/{nid}/interfaces?data=true"):
                iface_ids[(n["label"], i["label"])] = i["id"]

        for a, ai, b, bi in spec["links"]:
            r = await self.api.req("POST", f"/labs/{lid}/links", json={
                "src_int": iface_ids[(a, ai)], "dst_int": iface_ids[(b, bi)]})
            r.raise_for_status()
        return lid

    async def provision_all(self, force: bool = False) -> Dict[str, str]:
        async with self.lock:
            return {r: await self.provision(r, force) for r in ROOMS}

    # ---- attivazione di una stanza --------------------------------------
    def activate(self, room_id: str) -> Dict[str, Any]:
        """Non bloccante: avvia (o riusa) il cambio stanza e ritorna lo stato attuale."""
        room_spec(room_id)
        st = self.status[room_id]
        if self._wanted == room_id and st["phase"] in ("queued", "saving", "stopping", "starting", "booting", "ready"):
            return dict(st)
        self._wanted = room_id
        self._set(room_id, "queued", "In coda per l'accensione")
        self._task = asyncio.create_task(self._activate(room_id))
        return dict(self.status[room_id])

    async def _activate(self, room_id: str) -> None:
        async with self.lock:
            if self._wanted != room_id:  # nel frattempo il giocatore e' andato altrove
                self._set(room_id, "idle")
                return
            spec = room_spec(room_id)
            try:
                lid = await self.provision(room_id)

                # 1) individua gli altri lab accesi
                running: List[Tuple[str, str, List[Dict[str, Any]]]] = []
                for olid in await self.api.get("/labs"):
                    if olid == lid:
                        continue
                    nodes = await self._nodes(olid)
                    if any(n["state"] not in OFF_STATES for n in nodes):
                        info = await self.api.get(f"/labs/{olid}")
                        running.append((olid, info["lab_title"], nodes))

                # 2) salva le configurazioni IOS (solo lab delle stanze, nodi avviati)
                if running:
                    self._set(room_id, "saving", "Salvo le configurazioni della stanza precedente")
                    room_titles = {s["lab_title"] for s in ROOMS.values()}
                    jobs = [asyncio.to_thread(save_ios_config, title, n["label"])
                            for _, title, nodes in running if title in room_titles
                            for n in nodes if n["state"] == "BOOTED" and n["node_definition"] in IOS_DEFS]
                    if jobs:
                        await asyncio.gather(*jobs, return_exceptions=True)

                    # 3) spegni (stop, NON wipe) e aspetta che i nodi siano spenti davvero
                    self._set(room_id, "stopping", "Spengo la rete della stanza precedente")
                    for olid, _, _ in running:
                        await self.api.put(f"/labs/{olid}/stop")
                    for olid, title, _ in running:
                        if not await self._wait_nodes(olid, lambda n: n["state"] in OFF_STATES, STOP_TIMEOUT_S):
                            raise RuntimeError(f"il lab {title} non si spegne")

                # le altre stanze ora sono spente
                for other_room in ROOMS:
                    if other_room != room_id:
                        self._set(other_room, "idle", "", ready_nodes=0)

                # 4) accendi il lab della stanza
                self._set(room_id, "starting", "Accendo la rete della stanza")
                await self.api.put(f"/labs/{lid}/start")
                await asyncio.sleep(3)
                for n in await self._nodes(lid):
                    if n["state"] in OFF_STATES:  # CML non segnala l'errore sull'avvio del lab: lo cerco nodo per nodo
                        r = await self.api.put(f"/labs/{lid}/nodes/{n['id']}/state/start")
                        if r.status_code >= 400:
                            raise RuntimeError(f"{n['label']}: {r.json().get('description', r.text)}")

                # 5) aspetta che tutti i nodi siano BOOTED
                def prog(ok: int, tot: int) -> None:
                    self._set(room_id, "booting", f"Dispositivi pronti: {ok}/{tot}", ready_nodes=ok, total_nodes=tot)
                if not await self._wait_nodes(lid, lambda n: n["state"] == "BOOTED", BOOT_TIMEOUT_S, prog):
                    raise RuntimeError("avvio dei dispositivi oltre il tempo massimo")
                # 6) solo al primo avvio del lab: accendi le interfacce dei router collegate
                info = await self.api.get(f"/labs/{lid}")
                done_mark = f"fr-init-done:{spec['hash']}"
                if done_mark not in (info.get("lab_notes") or ""):
                    self._set(room_id, "booting", "Prima accensione: preparo gli apparati")
                    await asyncio.sleep(15)  # IOS: il prompt arriva qualche secondo dopo BOOTED
                    for label, lines in first_boot_fixups(spec):
                        await asyncio.to_thread(console_configure, spec["lab_title"], label, lines)
                    await self.api.req("PATCH", f"/labs/{lid}", json={
                        "notes": (info.get("lab_notes") or "") + "\n" + done_mark})
                self.active_room = room_id
                n_tot = len(spec["nodes"])
                self._set(room_id, "ready", "Rete della stanza accesa", ready_nodes=n_tot, total_nodes=n_tot)
            except Exception as exc:  # lo stato d'errore e' visibile al gioco
                self._set(room_id, "error", f"{type(exc).__name__}: {exc}")

    # ---- topologia per il gioco ------------------------------------------
    async def topology(self, room_id: str) -> Dict[str, Any]:
        spec = room_spec(room_id)
        lid = await self.find_lab(spec["lab_title"])
        status = dict(self.status[room_id])
        if not lid:
            return {"room_id": room_id, "lab_title": spec["lab_title"], "lab_id": None, "status": status,
                    "racks": spec.get("racks", []), "devices": [], "links": [], "error": "lab non ancora creato"}
        nodes = await self._nodes(lid)
        if self.status[room_id]["phase"] == "ready" and any(n["state"] in OFF_STATES for n in nodes):
            # qualcun altro (un altro backend, l'interfaccia di CML) ha spento il lab della stanza
            self._set(room_id, "error", "il lab della stanza e' stato spento da fuori: riaccendilo rientrando nella stanza",
                      ready_nodes=sum(1 for n in nodes if n["state"] == "BOOTED"))
            if self.active_room == room_id:
                self.active_room = None
            self._wanted = None
        status = dict(self.status[room_id])
        ifaces = await self.api.get(f"/labs/{lid}/interfaces?data=true")
        links = await self.api.get(f"/labs/{lid}/links?data=true")
        nid2label = {n["id"]: n["label"] for n in nodes}
        if_by_id = {i["id"]: i for i in ifaces}
        peer: Dict[str, Tuple[Dict[str, Any], Dict[str, Any]]] = {}
        out_links = []
        for l in links:
            a, b = if_by_id.get(l["interface_a"]), if_by_id.get(l["interface_b"])
            if not a or not b:
                continue
            peer[a["id"]] = (b, l)
            peer[b["id"]] = (a, l)
            out_links.append({"id": l["id"], "state": l["state"],
                              "a": {"node": nid2label.get(a["node"]), "iface": a["label"]},
                              "b": {"node": nid2label.get(b["node"]), "iface": b["label"]}})

        devices = []
        order = {n["label"]: i for i, n in enumerate(spec["nodes"])}
        for n in sorted(nodes, key=lambda n: order.get(n["label"], 99)):
            ns = node_spec(room_id, n["label"]) or {}
            dev_ifaces = []
            for i in ifaces:
                if i["node"] != n["id"] or i.get("type") != "physical":
                    continue
                p = peer.get(i["id"])
                dev_ifaces.append({
                    "label": i["label"], "slot": i.get("slot"),
                    "connected": p is not None,
                    "link_state": p[1]["state"] if p else None,
                    "peer": {"node": nid2label.get(p[0]["node"]), "iface": p[0]["label"]} if p else None,
                })
            dev_ifaces.sort(key=lambda d: (d["slot"] is None, d["slot"] or 0))
            devices.append({
                "rack": ns.get("rack"), "jack": ns.get("jack"),
                "label": n["label"], "cml_def": n["node_definition"], "state": n["state"],
                "kind": ns.get("kind") or ("switch" if "l2" in n["node_definition"] else
                                           "router" if n["node_definition"] in IOS_DEFS else "pc"),
                "display": ns.get("display", n["label"]),
                "game": ns.get("game"),
                "console": n["state"] == "BOOTED",
                "interfaces": dev_ifaces,
            })
        return {"room_id": room_id, "lab_title": spec["lab_title"], "lab_id": lid, "status": status,
                "racks": spec.get("racks", []), "devices": devices, "links": out_links}

    # ---- cavi -----------------------------------------------------------
    async def cable(self, room_id: str, action: str, node: str, iface: str,
                    to_node: Optional[str] = None, to_iface: Optional[str] = None) -> Dict[str, Any]:
        spec = room_spec(room_id)
        lid = await self.find_lab(spec["lab_title"])
        if not lid:
            raise RuntimeError("lab della stanza non trovato")
        nodes = await self._nodes(lid)
        by_label = {n["label"]: n for n in nodes}
        ifaces = await self.api.get(f"/labs/{lid}/interfaces?data=true")

        def iface_id(nl: str, il: str) -> str:
            n = by_label.get(nl)
            if not n:
                raise ValueError(f"dispositivo {nl} non presente nel lab")
            for i in ifaces:
                if i["node"] == n["id"] and i["label"] == il:
                    return i["id"]
            raise ValueError(f"porta {il} non presente su {nl}")

        src = iface_id(node, iface)
        links = await self.api.get(f"/labs/{lid}/links?data=true")
        link = next((l for l in links if src in (l["interface_a"], l["interface_b"])), None)

        if action == "disconnect":  # il cavo viene tolto: il collegamento sparisce dal lab
            if not link:
                raise ValueError(f"nessun cavo collegato a {node} {iface}")
            await self.api.put(f"/labs/{lid}/links/{link['id']}/state/stop")
            r = await self.api.req("DELETE", f"/labs/{lid}/links/{link['id']}")
            r.raise_for_status()
        elif action == "connect":  # nuovo cavo tra due porte libere
            if not (to_node and to_iface):
                raise ValueError("per collegare servono to_node e to_iface")
            if link:
                raise ValueError(f"{node} {iface} ha gia' un cavo")
            dst = iface_id(to_node, to_iface)
            if dst == src:
                raise ValueError("non si puo' collegare una porta a se stessa")
            if any(dst in (l["interface_a"], l["interface_b"]) for l in links):
                raise ValueError(f"{to_node} {to_iface} e' gia' occupata")
            new_id = await self._create_link(lid, src, dst)
            if not new_id:
                raise RuntimeError(f"CML non ha accettato il cavo {node} {iface} - {to_node} {to_iface}")
            if any(n["state"] not in OFF_STATES for n in nodes):
                await self.api.put(f"/labs/{lid}/links/{new_id}/state/start")
        elif action in ("unplug", "plug"):
            if not link:
                raise ValueError(f"nessun cavo collegato a {node} {iface}")
            r = await self.api.put(f"/labs/{lid}/links/{link['id']}/state/{'stop' if action == 'unplug' else 'start'}")
            r.raise_for_status()
        elif action == "move":
            if not (to_node and to_iface):
                raise ValueError("per spostare un cavo servono to_node e to_iface")
            if not link:
                raise ValueError(f"nessun cavo collegato a {node} {iface}")
            dst = iface_id(to_node, to_iface)
            if any(dst in (l["interface_a"], l["interface_b"]) for l in links):
                raise ValueError(f"{to_node} {to_iface} e' gia' occupata")
            # (node, iface) e' il capo che RESTA; l'altro capo del cavo si sposta su (to_node, to_iface)
            other = link["interface_b"] if link["interface_a"] == src else link["interface_a"]
            if other == dst:
                raise ValueError("il cavo e' gia' su quella porta")
            if dst == src:
                raise ValueError("non si puo' collegare una porta a se stessa")
            await self.api.put(f"/labs/{lid}/links/{link['id']}/state/stop")
            r = await self.api.req("DELETE", f"/labs/{lid}/links/{link['id']}")
            r.raise_for_status()
            new_id = await self._create_link(lid, src, dst)
            if not new_id:  # non lasciare il dispositivo scollegato: rimetti il cavo dov'era
                await self._create_link(lid, src, other)
                raise RuntimeError(f"CML non ha accettato il cavo verso {to_node} {to_iface}; ripristinato il collegamento originale")
            if any(n["state"] not in OFF_STATES for n in nodes):
                await self.api.put(f"/labs/{lid}/links/{new_id}/state/start")
        else:
            raise ValueError(f"azione sconosciuta: {action}")
        return await self.topology(room_id)

    async def _create_link(self, lid: str, a: str, b: str, tries: int = 10) -> Optional[str]:
        """Dopo una DELETE, CML libera l'interfaccia in modo asincrono: riprova per qualche secondo."""
        for _ in range(tries):
            r = await self.api.req("POST", f"/labs/{lid}/links", json={"src_int": a, "dst_int": b})
            if r.status_code < 300:
                return r.json()["id"]
            await asyncio.sleep(1)
        return None

    # ---- LED delle porte, letti dagli apparati -----------------------------
    _ports_cache: Dict[str, Tuple[float, Dict[str, Any]]] = {}

    async def ports(self, room_id: str) -> Dict[str, Any]:
        """Stato reale delle porte: switch `show interfaces status` + porte bloccate da STP,
        router `show ip interface brief`. LED: green / amber / off. Cache di 4 s."""
        hit = self._ports_cache.get(room_id)
        if hit and time.time() - hit[0] < 4:
            return hit[1]
        spec = room_spec(room_id)
        if self.status[room_id]["phase"] != "ready":
            return {"room_id": room_id, "ready": False, "ports": {}}

        def read(n: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
            res: Dict[str, Any] = {}
            try:
                if n.get("kind") == "switch":
                    st, bl = run_console_commands(spec["lab_title"], n["label"], n["cml_def"],
                                                  ["show interfaces status", "show spanning-tree blockedports"])
                    blocked = {m.group(1) for m in re.finditer(r"^VLAN\d+\s+([\w/,\- ]+)$", bl, re.M)}
                    blocked = {p.strip() for b in blocked for p in b.split(",") if p.strip()}
                    for m in re.finditer(r"^((?:Et|Po)\S+)\s.*?\s(connected|notconnect|disabled|err-disabled|inactive)\s+(\S+)",
                                         st, re.M):
                        port, state, vlan = m.groups()
                        full = port.replace("Et", "Ethernet", 1).replace("Po", "Port-channel", 1)
                        led = "green" if state == "connected" else "amber" if state == "err-disabled" else "off"
                        if port in blocked and state == "connected":
                            led, state = "amber", "STP blocking"
                        res[full] = {"led": led, "status": state, "vlan": vlan}
                elif n.get("kind") == "router":
                    (st,) = run_console_commands(spec["lab_title"], n["label"], n["cml_def"], ["show ip interface brief"])
                    for m in re.finditer(r"^(Ethernet\d+/\d+)\s+(\S+)\s+\S+\s+\S+\s+(administratively down|up|down)\s+(up|down)",
                                         st, re.M):
                        iface, ip, status, proto = m.groups()
                        led = "green" if status == "up" and proto == "up" else "off"
                        res[iface] = {"led": led, "status": f"{status}/{proto}", "vlan": ip}
            except Exception as exc:  # porta senza dati: il gioco usa lo stato del cavo
                res["_error"] = str(exc)
            return n["label"], res

        nodes = [n for n in spec["nodes"] if n.get("kind") in ("switch", "router") and n["cml_def"] in IOS_DEFS]
        pairs = await asyncio.gather(*[asyncio.to_thread(read, n) for n in nodes])
        out = {"room_id": room_id, "ready": True, "ports": dict(pairs), "read_at": time.time()}
        self._ports_cache[room_id] = (time.time(), out)
        return out

    # ---- comandi singoli (vecchio terminale) ----------------------------
    async def exec_command(self, node_label: str, command: str, room_id: Optional[str] = None) -> str:
        room_id = room_id or self.active_room or self._room_of(node_label)
        if not room_id:
            raise RuntimeError("nessuna stanza attiva")
        ns = node_spec(room_id, node_label)
        if not ns:
            raise ValueError(f"{node_label} non e' nella stanza {room_id}")
        return await asyncio.to_thread(run_console_command, room_spec(room_id)["lab_title"],
                                       node_label, ns["cml_def"], command)

    def _room_of(self, node_label: str) -> Optional[str]:
        return next((r for r in ROOMS if node_spec(r, node_label)), None)


room_manager = RoomManager()


# ---------------------------------------------------------------------------
# Ponte console <-> WebSocket
# ---------------------------------------------------------------------------
class ConsoleBridge:
    """Collega un canale termserv a una coda asyncio; per i nodi Linux fa il login da solo."""

    def __init__(self, lab_title: str, node_label: str, cml_def: str, loop: asyncio.AbstractEventLoop,
                 cols: int = 120, rows: int = 32) -> None:
        self.lab_title, self.node_label, self.cml_def = lab_title, node_label, cml_def
        self.loop = loop
        self.queue: "asyncio.Queue[Optional[bytes]]" = asyncio.Queue()
        self.cols, self.rows = cols, rows
        self.ssh: Optional[paramiko.SSHClient] = None
        self.chan: Optional[paramiko.Channel] = None
        self._stop = threading.Event()

    def open(self) -> None:
        self.ssh, self.chan, rest = open_console(self.lab_title, self.node_label, self.cols, self.rows)
        self.chan.settimeout(0.5)
        if rest.strip():
            self._emit(rest)
        threading.Thread(target=self._reader, daemon=True).start()
        self.chan.send("\r")

    def _emit(self, data: bytes) -> None:
        self.loop.call_soon_threadsafe(self.queue.put_nowait, data)

    def _reader(self) -> None:
        linux = self.cml_def in LINUX_DEFS
        tail = ""
        logged_in = not linux
        t0 = time.time()
        try:
            while not self._stop.is_set() and self.chan and not self.chan.closed:
                try:
                    data = self.chan.recv(65535)
                except Exception:
                    continue
                if not data:
                    break
                self._emit(data)
                if not logged_in and time.time() - t0 < 30:
                    tail = (tail + data.decode(errors="ignore"))[-80:]
                    if tail.rstrip().endswith("login:"):
                        self.chan.send(LINUX_USER + "\r")
                        tail = ""
                    elif tail.rstrip().endswith("Password:"):
                        self.chan.send(LINUX_PASS + "\r")
                        logged_in = True
        finally:
            self.loop.call_soon_threadsafe(self.queue.put_nowait, None)

    def send(self, data: str) -> None:
        if self.chan and not self.chan.closed:
            self.chan.send(data)

    def resize(self, cols: int, rows: int) -> None:
        if self.chan and not self.chan.closed:
            self.chan.resize_pty(width=cols, height=rows)

    def close(self) -> None:
        self._stop.set()
        try:
            if self.ssh:
                self.ssh.close()
        except Exception:
            pass
