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

from backend.config_diff import diff_config, parse_ping

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


class IOSAuthError(Exception):
    """Sollevata quando l'autenticazione console o enable fallisce per credenziali errate o mancanti."""
    pass


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


def _credentials_for(lab_title: str, node_label: str) -> Dict[str, str]:
    """Cerca le credenziali per il lab o per il singolo nodo nelle specifiche delle stanze."""
    for spec in ROOMS.values():
        if spec.get("lab_title") == lab_title:
            for n in spec.get("nodes", []):
                if n.get("label") == node_label and n.get("credentials"):
                    creds = dict(spec.get("credentials") or {})
                    creds.update(n["credentials"])
                    return creds
            return dict(spec.get("credentials") or {})
    return {}


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
_NODE_LOCKS: Dict[Tuple[str, str], threading.Lock] = {}
_NODE_LOCKS_GUARD = threading.Lock()


def node_lock(lab_title: str, node_label: str) -> threading.Lock:
    """Un'operazione automatica alla volta per nodo: la console seriale e' una linea sola e due
    letture contemporanee (es. LED e Verifica) mescolerebbero i loro output."""
    with _NODE_LOCKS_GUARD:
        return _NODE_LOCKS.setdefault((lab_title, node_label), threading.Lock())


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


# messaggi di syslog di IOS sulla console, es. "*Nov 14 15:01:02.123: %LINK-3-UPDOWN: ..."
SYSLOG_LINE = re.compile(r"^\s*(\*?[A-Z][a-z]{2}\s+\d+\s+[\d:.]+:\s*)?%[A-Z0-9_]+-\d-[A-Z0-9_]+:")

# sequenze di controllo del terminale (es. ESC[6n che la shell di Alpine manda dopo il prompt)
ANSI_ESC = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]|\x1b[()][A-Z0-9]")


def _read_until(chan: paramiko.Channel, pred: Callable[[str], bool], timeout: float) -> str:
    """Legge finche' `pred` (applicato al testo SENZA sequenze di controllo) e' vera, o fino al timeout."""
    out = ""
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            data = chan.recv(65535)
        except Exception:
            data = b""
        if data:
            out += data.decode(errors="ignore")
            if pred(ANSI_ESC.sub("", out)):
                break
    return ANSI_ESC.sub("", out)


def _linux_login(chan: paramiko.Channel, out: str) -> str:
    if "login:" in out[-60:]:
        chan.send(LINUX_USER + "\r")
        out += _read_until(chan, lambda s: "Password:" in s[-40:], 5)
        chan.send(LINUX_PASS + "\r")
        out += _read_until(chan, lambda s: bool(LINUX_PROMPT.search(s.splitlines()[-1] if s else "")), 6)
    return out


IOS_USER_PROMPT = re.compile(r"(?:Username|login):\s*$", re.IGNORECASE)
IOS_PASS_PROMPT = re.compile(r"Password:\s*$", re.IGNORECASE)
IOS_EXEC_PROMPT = re.compile(r"[\w\-.]+(\([\w\-.]+\))?>\s*$")
IOS_PRIV_PROMPT = re.compile(r"[\w\-.]+(\([\w\-.]+\))?#\s*$")
IOS_AUTH_ERROR = re.compile(r"(% Bad passwords|% Access denied|% Authentication failed|% Login invalid)", re.IGNORECASE)


def _ios_auth(chan: paramiko.Channel, creds: Optional[Dict[str, str]] = None, timeout: float = 10.0) -> str:
    creds = creds or {}
    t0 = time.time()
    buf = ""
    sent_user = False
    sent_pass = False
    sent_enable = False
    sent_enable_pass = False
    last_wake = 0.0

    while time.time() - t0 < timeout:
        now = time.time()
        if not buf and (now - last_wake > 1.2):
            chan.send("\r")
            last_wake = now

        try:
            data = chan.recv(65535)
        except Exception:
            data = b""

        if data:
            buf += data.decode(errors="ignore")

        clean = ANSI_ESC.sub("", buf)
        last_line = clean.rstrip("\r\n").splitlines()[-1] if clean.strip() else clean.strip()

        if IOS_AUTH_ERROR.search(clean):
            raise IOSAuthError("accesso negato con le password della scheda")

        if IOS_PRIV_PROMPT.search(last_line):
            if "(config" in last_line:
                chan.send("end\r")
                buf = ""
                time.sleep(0.15)
                continue
            return clean

        if IOS_USER_PROMPT.search(last_line):
            if sent_user:
                raise IOSAuthError("accesso negato con le password della scheda")
            user = creds.get("username")
            if not user:
                raise IOSAuthError("accesso negato con le password della scheda")
            chan.send(user + "\r")
            sent_user = True
            buf = ""
            time.sleep(0.15)
            continue

        if IOS_PASS_PROMPT.search(last_line):
            if not sent_enable:
                if sent_pass:
                    raise IOSAuthError("accesso negato con le password della scheda")
                pwd = creds.get("console") or creds.get("password")
                if not pwd:
                    raise IOSAuthError("accesso negato con le password della scheda")
                chan.send(pwd + "\r")
                sent_pass = True
                buf = ""
                time.sleep(0.15)
                continue
            else:
                if sent_enable_pass:
                    raise IOSAuthError("accesso negato con le password della scheda")
                pwd = creds.get("enable")
                if not pwd:
                    raise IOSAuthError("accesso negato con le password della scheda")
                chan.send(pwd + "\r")
                sent_enable_pass = True
                buf = ""
                time.sleep(0.15)
                continue

        if IOS_EXEC_PROMPT.search(last_line):
            chan.send("enable\r")
            sent_enable = True
            buf = ""
            time.sleep(0.15)
            continue

        time.sleep(0.05)

    clean = ANSI_ESC.sub("", buf)
    last_line = clean.rstrip("\r\n").splitlines()[-1] if clean.strip() else clean.strip()
    if IOS_PASS_PROMPT.search(last_line) or IOS_USER_PROMPT.search(last_line) or IOS_AUTH_ERROR.search(clean):
        raise IOSAuthError("accesso negato con le password della scheda")
    raise TimeoutError(f"Handshake console IOS oltre il tempo massimo: {clean[-200:]}")


def run_console_command(lab_title: str, node_label: str, cml_def: str, command: str, timeout: float = 10,
                        credentials: Optional[Dict[str, str]] = None) -> str:
    """Esegue un comando sulla console vera e restituisce l'output completo (fino al prompt)."""
    return run_console_commands(lab_title, node_label, cml_def, [command], timeout, credentials)[0]


def run_console_commands(lab_title: str, node_label: str, cml_def: str, commands: List[str],
                         timeout: float = 10, credentials: Optional[Dict[str, str]] = None) -> List[str]:
    """Piu' comandi nella stessa sessione console (una sola connessione)."""
    with node_lock(lab_title, node_label):
        return _run_console_commands(lab_title, node_label, cml_def, commands, timeout, credentials)


def _run_console_commands(lab_title: str, node_label: str, cml_def: str, commands: List[str],
                          timeout: float, credentials: Optional[Dict[str, str]] = None) -> List[str]:
    ssh, chan, _ = open_console(lab_title, node_label)
    try:
        linux = cml_def in LINUX_DEFS
        if linux:
            woke = lambda s: bool(s.strip()) and (  # noqa: E731
                "login:" in s[-60:] or bool(LINUX_PROMPT.search(s.rstrip("\r\n").splitlines()[-1])))
            out = ""
            for wake in ("\x03\x15\r", "\r", "\r"):
                chan.send(wake)
                out += _read_until(chan, woke, 4)
                if woke(out):
                    break
            _linux_login(chan, out)
        else:
            creds = credentials if credentials is not None else _credentials_for(lab_title, node_label)
            _ios_auth(chan, creds, timeout=timeout)
            chan.send("terminal length 0\r")
            _read_until(chan, lambda s: bool(IOS_PROMPT.search(s.rstrip().splitlines()[-1] if s.strip() else "")), 3)
        prompt = LINUX_PROMPT if linux else IOS_PROMPT
        results = []
        for command in commands:
            # quello che e' rimasto sulla linea (syslog, prompt ristampati da `logging synchronous`)
            # non deve essere scambiato per la fine del comando: si scarta prima di inviare
            _read_until(chan, lambda s: False, 0.3)
            head = command.strip()[:20]  # IOS accorcia l'eco dei comandi lunghi con '$'

            def done(s: str, head: str = head) -> bool:
                i = s.find(head)
                if i < 0:
                    return False
                lines = s[i:].rstrip("\r\n ").splitlines()
                return len(lines) > 1 and bool(prompt.search(lines[-1]))
            chan.send(command + "\r")
            out = _read_until(chan, done, timeout).replace("\r", "")
            i = out.find(head)
            lines = out[i:].splitlines()[1:] if i >= 0 else out.splitlines()
            results.append("\n".join(lines).rstrip())
        return results
    finally:
        ssh.close()


def save_ios_config(lab_title: str, node_label: str) -> bool:
    """`write memory` dalla console: la configurazione resta dopo stop/start (verificato su CML 2.10)."""
    with node_lock(lab_title, node_label):
        return _save_ios_config(lab_title, node_label)


def _save_ios_config(lab_title: str, node_label: str) -> bool:
    ssh, chan, _ = open_console(lab_title, node_label)
    try:
        creds = _credentials_for(lab_title, node_label)
        _ios_auth(chan, creds, timeout=10)
        chan.send("write memory\r")
        out = _read_until(chan, lambda s: "[OK]" in s or "Invalid" in s or "Error" in s, 15)
        return "[OK]" in out
    finally:
        ssh.close()


def console_configure(lab_title: str, node_label: str, lines: List[str]) -> str:
    """Applica righe di configurazione dalla console vera e salva (write memory)."""
    with node_lock(lab_title, node_label):
        return _console_configure(lab_title, node_label, lines)


def _console_configure(lab_title: str, node_label: str, lines: List[str]) -> str:
    ssh, chan, _ = open_console(lab_title, node_label)
    try:
        creds = _credentials_for(lab_title, node_label)
        _ios_auth(chan, creds, timeout=10)
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


def bounce_port(lab_title: str, node_label: str, iface: str) -> str:
    """Simula l'inserimento fisico di un cavo: IOL non rileva il cambio di link, quindi la porta va giu' e
    risale (shutdown / no shutdown) e STP riparte come su uno switch vero. Niente `write memory`: la
    configurazione salvata resta quella del giocatore. Se la porta e' in shutdown per scelta, non si tocca."""
    with node_lock(lab_title, node_label):
        ssh, chan, _ = open_console(lab_title, node_label)
        try:
            creds = _credentials_for(lab_title, node_label)
            _ios_auth(chan, creds, timeout=10)
            _read_until(chan, lambda s: False, 0.3)
            chan.send(f"show running-config interface {iface}\r")
            cfg = _read_until(chan, lambda s: bool(re.search(r"^end\s*$", s, re.M)), 6)
            if re.search(r"^\s+shutdown\s*$", cfg, re.M):
                return "porta in shutdown: non toccata"
            for c in ("configure terminal", f"interface {iface}", "shutdown"):
                chan.send(c + "\r")
                _read_until(chan, lambda s: s.rstrip().endswith("#"), 3)
            time.sleep(1.0)
            for c in ("no shutdown", "end"):
                chan.send(c + "\r")
                _read_until(chan, lambda s: s.rstrip().endswith("#"), 3)
            return "porta rimbalzata"
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
# LED delle porte, come il LED STAT degli switch Catalyst (2960/9200):
#   spento            nessun link, shutdown, cavo staccato
#   verde fisso       link su, inoltra, nessun traffico
#   verde lampeggiante  traffico (oltre il rumore di controllo: BPDU, keepalive)
#   ambra fisso       STP non ancora in inoltro (listening/learning), err-disabled, membro EtherChannel sospeso
#   ambra lampeggiante  porta bloccata da STP (alternate/backup, BLK)
#   verde/ambra alternato  errori sul link (CRC, input/output errors in aumento)
# ---------------------------------------------------------------------------
ACTIVITY_PPS = 5.0  # pacchetti/s sopra i quali la porta "lampeggia" (BPDU, LACP e keepalive stanno sotto)


def _short_to_full(port: str) -> str:
    return re.sub(r"^Et(?=\d)", "Ethernet", re.sub(r"^Po(?=\d)", "Port-channel", port))


def parse_interface_counters(text: str) -> Dict[str, Dict[str, Any]]:
    """`show interfaces | include ...` -> {porta: {up, proto, extra, pkts, errs}}."""
    res: Dict[str, Dict[str, Any]] = {}
    cur = None
    for line in text.splitlines():
        m = re.match(r"^(\S+) is (administratively down|up|down), line protocol is (up|down)\s*(?:\((\S+)\))?", line)
        if m:
            cur = m.group(1)
            res[cur] = {"status": m.group(2), "proto": m.group(3), "extra": m.group(4) or "", "pkts": 0, "errs": 0}
            continue
        if not cur:
            continue
        m = re.search(r"(\d+) packets (input|output)", line)
        if m:
            res[cur]["pkts"] += int(m.group(1))
        m = re.search(r"(\d+) (input|output) errors", line)
        if m:
            res[cur]["errs"] += int(m.group(1))
    return res


def parse_stp(text: str) -> Dict[str, List[Tuple[str, str, str]]]:
    """`show spanning-tree` -> {porta: [(vlan, ruolo, stato), ...]}."""
    res: Dict[str, List[Tuple[str, str, str]]] = {}
    vlan = ""
    for line in text.splitlines():
        m = re.match(r"^VLAN0*(\d+)", line)
        if m:
            vlan = m.group(1)
            continue
        m = re.match(r"^((?:Et|Po)\S+)\s+(Root|Desg|Altn|Back|Mstr|Shr)\s+(\w+)", line)
        if m:
            res.setdefault(_short_to_full(m.group(1)), []).append((vlan, m.group(2), m.group(3)))
    return res


def parse_etherchannel(text: str) -> Tuple[Dict[str, str], Dict[str, str]]:
    """`show etherchannel summary` -> ({membro: flag}, {membro: Port-channelN})."""
    flags: Dict[str, str] = {}
    owner: Dict[str, str] = {}
    for line in text.splitlines():
        m = re.match(r"^\s*\d+\s+(Po\d+)\(\w+\)\s+\S+\s+(.*)$", line)
        if m:
            for mm in re.finditer(r"(Et\S+?)\((\w+)\)", m.group(2)):
                full = _short_to_full(mm.group(1))
                flags[full] = mm.group(2)
                owner[full] = _short_to_full(m.group(1))
    return flags, owner


def read_port_leds(lab_title: str, n: Dict[str, Any],
                   counters: Dict[Tuple[str, str], Tuple[float, int, int]]) -> Dict[str, Any]:
    """Legge lo stato vero delle porte di uno switch o router e lo traduce nei LED Cisco."""
    is_switch = n.get("kind") == "switch"
    cmds = ["show interfaces | include line protocol|packets input|packets output|input errors|output errors"]
    if is_switch:
        cmds += ["show interfaces status", "show spanning-tree", "show etherchannel summary"]
    outs = run_console_commands(lab_title, n["label"], n["cml_def"], cmds, timeout=10)
    ifs = parse_interface_counters(outs[0])
    status: Dict[str, Tuple[str, str]] = {}
    stp: Dict[str, List[Tuple[str, str, str]]] = {}
    ec_flags: Dict[str, str] = {}
    ec_owner: Dict[str, str] = {}
    if is_switch:
        for m in re.finditer(r"^((?:Et|Po)\S+)\s.*?\s(connected|notconnect|disabled|err-disabled|inactive|suspended)\s+(\S+)",
                             outs[1], re.M):
            status[_short_to_full(m.group(1))] = (m.group(2), m.group(3))
        stp = parse_stp(outs[2])
        ec_flags, ec_owner = parse_etherchannel(outs[3])

    now = time.time()
    res: Dict[str, Any] = {}
    syst_fault = False
    for port, c in ifs.items():
        if not port.startswith("Ethernet") or "." in port:
            continue  # sottointerfacce e SVI non hanno LED
        key = (n["label"], port)
        prev = counters.get(key)
        counters[key] = (now, c["pkts"], c["errs"])
        dt = (now - prev[0]) if prev else 0
        pps = (c["pkts"] - prev[1]) / dt if prev and dt > 0 else 0.0
        new_errs = (c["errs"] - prev[2]) if prev else 0
        st, vlan = status.get(port, ("connected" if c["status"] == "up" else "disabled" if "admin" in c["status"] else "notconnect",
                                     ""))
        if not is_switch:
            vlan = ""
        reason = st
        if c["status"] == "administratively down" or st == "disabled":
            led, reason = "off", "shutdown"
        elif st == "err-disabled" or c["extra"] == "err-disabled":
            led, reason = "amber", "err-disabled"
            syst_fault = True
        elif c["status"] != "up" or c["proto"] != "up" or st == "notconnect":
            led, reason = "off", "nessun link"
        elif ec_flags.get(port) in ("s", "I", "w", "D"):
            led, reason = "amber", f"EtherChannel: membro non nel canale ({ec_flags[port]})"
        else:
            states = stp.get(ec_owner.get(port, port), [])
            fwd = [x for x in states if x[2] == "FWD"]
            blk = [x for x in states if x[2] in ("BLK", "DIS", "BKN")]
            lrn = [x for x in states if x[2] in ("LRN", "LIS")]
            alt = [x for x in blk if x[1] in ("Altn", "Back")]
            if states and not fwd and alt and len(alt) == len(blk):
                # porta alternata/di riserva bloccata da STP: ambra lampeggiante
                led = "amber_blink"
                reason = "STP: bloccata (" + ", ".join(f"VLAN {v} {r} {s}" for v, r, s in alt[:3]) + ")"
            elif states and not fwd and (lrn or blk):
                # appena collegata, STP non ha ancora messo la porta in inoltro (discarding/learning): ambra fisso
                led = "amber"
                reason = "STP: in verifica (" + ", ".join(f"VLAN {v} {r} {s}" for v, r, s in (lrn or blk)[:3]) + ")"
            elif new_errs > 0:
                led, reason = "green_amber", f"errori sul link (+{new_errs})"
                syst_fault = True
            elif pps > ACTIVITY_PPS or (vlan.isdigit() and prev and dt < 6 and c["pkts"] - prev[1] >= 4):
                # traffico continuo, oppure breve picco su una porta d'accesso (DHCP/ARP di un PC appena collegato)
                led, reason = "green_blink", f"traffico ({c['pkts'] - prev[1] if prev else 0} pacchetti in {dt:.0f} s)"
            else:
                led, reason = "green", "link su, inoltro"
            if blk and fwd:
                reason += " · bloccata in " + ", ".join(f"VLAN {v}" for v, r, s in blk[:3])
        res[port] = {"led": led, "status": reason, "vlan": vlan or ("trunk" if ec_owner.get(port) else "")}
    res["_syst"] = "amber" if syst_fault else "green"
    return res


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

                # 2) salva le configurazioni IOS (solo lab delle stanze, nodi avviati) se autosave e' abilitato
                if running:
                    room_titles = {s["lab_title"] for s in ROOMS.values()}
                    jobs = []
                    for _, title, nodes in running:
                        if title in room_titles:
                            prev_spec = next((s for s in ROOMS.values() if s.get("lab_title") == title), None)
                            if prev_spec and not prev_spec.get("autosave", True):
                                continue
                            for n in nodes:
                                if n["state"] == "BOOTED" and n["node_definition"] in IOS_DEFS:
                                    jobs.append(asyncio.to_thread(save_ios_config, title, n["label"]))
                    if jobs:
                        self._set(room_id, "saving", "Salvo le configurazioni della stanza precedente")
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
                # CML non segnala l'errore sull'avvio del lab: lo cerco nodo per nodo. Le licenze dei
                # nodi appena spenti si liberano qualche secondo dopo lo stato STOPPED: si riprova.
                deadline = time.time() + 45
                while True:
                    last_err = None
                    for n in await self._nodes(lid):
                        if n["state"] in OFF_STATES:
                            r = await self.api.put(f"/labs/{lid}/nodes/{n['id']}/state/start")
                            if r.status_code >= 400:
                                last_err = f"{n['label']}: {r.json().get('description', r.text)}"
                    if not last_err:
                        break
                    if "license" not in last_err.lower() or time.time() > deadline:
                        raise RuntimeError(last_err)
                    self._set(room_id, "starting", "Attendo che CML liberi le licenze dei nodi")
                    await asyncio.sleep(3)

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
        if self.status[room_id]["phase"] == "idle" and nodes and all(n["state"] == "BOOTED" for n in nodes) \
                and f"fr-init-done:{spec['hash']}" in ((await self.api.get(f"/labs/{lid}")).get("lab_notes") or ""):
            # lab gia' acceso (es. dopo un riavvio del backend): la stanza e' pronta
            self.active_room = room_id
            self._wanted = room_id
            self._set(room_id, "ready", "Rete della stanza accesa", ready_nodes=len(nodes), total_nodes=len(nodes))
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
        if action in ("connect", "move", "plug"):
            ends = [(node, iface)] + ([(to_node, to_iface)] if action in ("connect", "move") else [])
            if action == "plug" and link:
                other = link["interface_b"] if link["interface_a"] == src else link["interface_a"]
                oi = next((i for i in ifaces if i["id"] == other), None)
                if oi:
                    ends.append((next(n["label"] for n in nodes if n["id"] == oi["node"]), oi["label"]))
            asyncio.create_task(self._bounce(spec, [(n, i) for n, i in ends if n]))
        return await self.topology(room_id)

    async def _bounce(self, spec: Dict[str, Any], ends: List[Tuple[str, str]]) -> None:
        """Rimbalzo delle porte IOS appena cablate, in silenzio per le console aperte dai giocatori."""
        for label, iface in ends:
            ns = next((n for n in spec["nodes"] if n["label"] == label), None)
            if not ns or ns["cml_def"] not in IOS_DEFS or not iface.startswith("Ethernet"):
                continue
            try:
                with console_lock(spec["lab_title"], [label], "LED"):
                    await asyncio.sleep(0.5)
                    await asyncio.to_thread(bounce_port, spec["lab_title"], label, iface)
            except Exception:
                pass  # se la console non risponde il cavo resta comunque collegato

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
    _counters: Dict[Tuple[str, str], Tuple[float, int, int]] = {}  # (nodo, porta) -> (t, pacchetti, errori)
    _last_good: Dict[str, Dict[str, Dict[str, Any]]] = {}             # stanza -> nodo -> ultima lettura valida

    async def ports(self, room_id: str, fresh: bool = False) -> Dict[str, Any]:
        """Stato reale delle porte: switch `show interfaces status` + porte bloccate da STP,
        router `show ip interface brief`. LED: green / amber / off. Cache di 4 s."""
        try:
            from backend.console_session import console_session_manager
            console_session_manager.cleanup_expired()
        except Exception:
            pass
        hit = self._ports_cache.get(room_id)
        if hit and time.time() - hit[0] < (1.5 if fresh else 7):
            return hit[1]
        spec = room_spec(room_id)
        if self.status[room_id]["phase"] != "ready":
            return {"room_id": room_id, "ready": False, "ports": {}}

        def read(n: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
            try:
                return n["label"], read_port_leds(spec["lab_title"], n, self._counters)
            except IOSAuthError as exc:
                return n["label"], {"_error": str(exc), "ok": False}
            except Exception as exc:  # porta senza dati: il gioco usa lo stato del cavo
                return n["label"], {"_error": str(exc)}

        nodes = [n for n in spec["nodes"] if n.get("kind") in ("switch", "router") and n["cml_def"] in IOS_DEFS]
        title = spec["lab_title"]

        def can_freeze(n: Dict[str, Any]) -> bool:
            bridges = OPEN_BRIDGES.get((title, n["label"]), [])
            return bool(bridges) and all(b.idle() for b in bridges) and (title, n["label"]) not in CONSOLE_LOCKS

        async def read_frozen(n: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
            # mini-freeze trasparente: blocco silenzioso, lettura, ripristino di modalita' e riga del giocatore
            with console_lock(title, [n["label"]], "LED"):
                await asyncio.sleep(0.5)  # il ponte annota la modalita' prima che partano i comandi
                return await asyncio.to_thread(read, n)

        busy = [n for n in nodes if (OPEN_CONSOLES.get((title, n["label"])) and not can_freeze(n))
                or (title, n["label"]) in CONSOLE_LOCKS]
        frozen = [n for n in nodes if n not in busy and OPEN_CONSOLES.get((title, n["label"]))]
        free = [n for n in nodes if n not in busy and n not in frozen]
        pairs = dict(await asyncio.gather(*[asyncio.to_thread(read, n) for n in free],
                                          *[read_frozen(n) for n in frozen]))
        previous = (hit[1]["ports"] if hit else self._last_good.get(room_id, {}))
        for n in busy:  # console in uso da un giocatore: nessun comando automatico, ultimo valore noto
            pairs[n["label"]] = {**previous.get(n["label"], {}), "_console_in_use": True}
        for label, res in list(pairs.items()):
            if label in [b["label"] for b in busy]:
                continue
            if "_error" in res or not any(k.startswith("Ethernet") for k in res):
                # lettura fallita o incompleta: meglio l'ultimo valore valido che porte vuote (LED spenti)
                pairs[label] = {**previous.get(label, {}), "_stale": True, "_error": res.get("_error", "lettura vuota")}
            else:
                self._last_good.setdefault(room_id, {})[label] = res
        out = {"room_id": room_id, "ready": True, "ports": pairs, "read_at": time.time()}
        self._ports_cache[room_id] = (time.time(), out)
        return out

    # ---- verifica: diff delle configurazioni + controlli funzionali ------
    async def verify(self, room_id: str) -> Dict[str, Any]:
        """Per ogni apparato IOS: diff tra running-config vera e target del file della stanza.
        Per gli host: i controlli `checks` del file (DHCP, ping) eseguiti dalle loro console."""
        t0 = time.time()
        spec = room_spec(room_id)
        if self.status[room_id]["phase"] != "ready":
            raise RuntimeError("la rete della stanza non e' accesa")
        title = spec["lab_title"]

        def device_diff(n: Dict[str, Any]) -> Dict[str, Any]:
            try:
                (run,) = run_console_commands(title, n["label"], n["cml_def"], ["show running-config"], timeout=20)
                if "Building configuration" not in run or not re.search(r"^end\s*$", run, re.M):
                    return {"node": n["label"], "kind": n.get("kind"), "missing": [], "extra": [], "ok": False,
                            "error": "lettura della running-config incompleta: riprova la verifica"}
                # syslog arrivati durante la lettura (es. %LINK-3-UPDOWN) non fanno parte della configurazione
                run = "\n".join(ln for ln in run.splitlines() if not SYSLOG_LINE.match(ln))
                from backend.config_diff import diff_config, verify_acl_order
                d = diff_config(n.get("config", ""), run)

                # Gaia Verification: Controllo ordinamento ACL top-down
                acl_ok = verify_acl_order(n.get("config", ""), run)

                # Gaia Verification: SSH abilitato e Telnet disabilitato se richiesto o presente
                has_telnet = bool(re.search(r"transport input\s+(?:all|telnet\b)", run, re.IGNORECASE))
                has_ssh = bool(re.search(r"transport input\s+(?:ssh\b)", run, re.IGNORECASE))
                ssh_telnet_ok = True
                if n.get("check_ssh") or spec.get("check_ssh"):
                    ssh_telnet_ok = has_ssh and not has_telnet

                # Gaia Verification: Startup-config vs running persistence
                persistence_ok = True
                if n.get("check_persistence") or spec.get("check_persistence"):
                    try:
                        (startup,) = run_console_commands(title, n["label"], n["cml_def"], ["show startup-config"], timeout=15)
                        if "Non-volatile memory is not present" in startup or "NVRAM config" not in startup:
                            persistence_ok = False
                        else:
                            s_diff = diff_config(run, startup)
                            persistence_ok = not s_diff["missing"] and not s_diff["extra"]
                    except Exception:
                        persistence_ok = False

                is_ok = not d["missing"] and not d["extra"] and acl_ok and ssh_telnet_ok and persistence_ok
                return {"node": n["label"], "kind": n.get("kind"), **d,
                        "acl_ok": acl_ok, "ssh_telnet_ok": ssh_telnet_ok, "persistence_ok": persistence_ok,
                        "ok": is_ok, "error": None}
            except IOSAuthError as exc:
                return {"node": n["label"], "kind": n.get("kind"), "missing": [], "extra": [], "ok": False,
                        "error": str(exc)}
            except Exception as exc:
                return {"node": n["label"], "kind": n.get("kind"), "missing": [], "extra": [], "ok": False,
                        "error": f"console non disponibile: {exc}"}

        def host_checks(host: str, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
            ns = node_spec(room_id, host) or {}
            cmds = []
            for c in items:
                if "dhcp" in c:
                    cmds.append("ip -4 addr show eth0")
                elif "traceroute" in c:
                    target = c["traceroute"]
                    hops = c.get("hops", 10)
                    cmds.append(f"traceroute -n -m {hops} -w 1 {target}")
                else:
                    cmds.append(f"ping -c 3 -W 1 {c['ping']}")
            try:
                outs = run_console_commands(title, host, ns.get("cml_def", "alpine"), cmds, timeout=12)
            except Exception as exc:
                return [{**c, "ok": False, "detail": f"console non disponibile: {exc}"} for c in items]
            res = []
            for c, out in zip(items, outs):
                if "dhcp" in c:
                    m = re.search(r"inet (\d+\.\d+\.\d+\.\d+)/", out)
                    ip = m.group(1) if m else None
                    ok = bool(ip and ip.startswith(c["dhcp"]))
                    res.append({**c, "ok": ok, "detail": f"indirizzo {ip}" if ip else "nessun indirizzo IPv4"})
                elif "traceroute" in c:
                    target = c["traceroute"]
                    hop_matches = re.findall(r"^\s*(\d+)\s+([0-9.]+)", out, re.M)
                    reached = any(h[1] == target for h in hop_matches)
                    hops_count = len(hop_matches)
                    max_allowed = c.get("max_hops")
                    ok = reached and (max_allowed is None or hops_count <= max_allowed)
                    res.append({**c, "ok": ok, "detail": f"raggiunto {target} in {hops_count} hop" if ok else f"traceroute verso {target} fallito"})
                else:
                    p = parse_ping(out)
                    res.append({**c, "ok": p["success"], "detail": f"{p['received']}/{p['sent']} risposte, perdita {p['loss']:.0f}%"})
            return res

        ios = [n for n in spec["nodes"] if n["cml_def"] in IOS_DEFS]
        by_host: Dict[str, List[Dict[str, Any]]] = {}
        for c in spec.get("checks", []):
            by_host.setdefault(c["from"], []).append(c)
        jobs = [asyncio.to_thread(device_diff, n) for n in ios] + \
               [asyncio.to_thread(host_checks, h, items) for h, items in by_host.items()]
        touched = [n["label"] for n in ios] + list(by_host)
        with console_lock(title, touched, "Verifica in corso"):
            results = await asyncio.gather(*jobs)
            await asyncio.sleep(0.5)  # le ultime righe dell'output arrivano ancora durante il blocco
        devices = results[:len(ios)]
        checks = [c for group in results[len(ios):] for c in group]

        # Gaia Verification: Port STAT LEDs se richiesto
        if spec.get("check_leds", False):
            try:
                ports_res = await self.ports(room_id)
                for pair in ports_res.get("ports", []):
                    color = pair.get("color", "off")
                    p_ok = color in ("green", "amber")
                    checks.append({
                        "label": f"Port LED {pair.get('node')}:{pair.get('iface')}",
                        "ok": p_ok,
                        "detail": f"LED status: {color}",
                    })
            except Exception as exc:
                checks.append({
                    "label": "Port LEDs verification",
                    "ok": False,
                    "detail": f"Lettura LED fallita: {exc}",
                })

        checks.sort(key=lambda c: next((i for i, sc in enumerate(spec.get("checks", []))
                                        if sc.get("label") == c.get("label")), 99))
        auth_error = next((d["error"] for d in devices if d.get("error") == "accesso negato con le password della scheda"), None)
        ok = all(d["ok"] for d in devices) and all(c["ok"] for c in checks)
        summary = auth_error or ("Verifica completata con successo" if ok else "Verifica fallita")
        return {"room_id": room_id, "lab_title": title,
                "ok": ok, "summary": summary,
                "devices": devices, "checks": checks, "took_s": round(time.time() - t0, 1)}

    # ---- ricarica apparati / stanza (A3) -------------------------------
    async def reload(self, room_id: str, node: Optional[str] = None) -> Dict[str, Any]:
        """Ricarica (stop -> start SENZA wipe) un singolo nodo o l'intera stanza.
        Preserva la startup-config salvata in NVRAM."""
        if room_id not in ROOMS:
            raise KeyError(f"stanza sconosciuta: {room_id}")
        spec = room_spec(room_id)
        lid = await self.find_lab(spec["lab_title"])
        if not lid:
            raise RuntimeError(f"lab {spec['lab_title']} non trovato in CML")

        self._set(room_id, "reloading", f"Ricarica in corso di {node or 'tutti i nodi'}")
        self._ports_cache.pop(room_id, None)

        if node:
            ns = node_spec(room_id, node)
            if not ns:
                raise ValueError(f"nodo {node} non trovato nella stanza {room_id}")
            nodes = await self._nodes(lid)
            cml_node = next((n for n in nodes if n["label"] == node), None)
            if not cml_node:
                raise RuntimeError(f"nodo {node} non trovato nel lab CML {lid}")
            nid = cml_node["id"]

            r = await self.api.put(f"/labs/{lid}/nodes/{nid}/state/stop")
            if r.status_code >= 400:
                raise RuntimeError(f"errore stop nodo {node}: {r.text}")

            async def wait_node_state(pred: Callable[[str], bool], timeout: float) -> bool:
                t0 = time.time()
                while time.time() - t0 < timeout:
                    curr = await self._nodes(lid)
                    curr_n = next((x for x in curr if x["id"] == nid), None)
                    if curr_n and pred(curr_n["state"]):
                        return True
                    await asyncio.sleep(1)
                return False

            if not await wait_node_state(lambda st: st in OFF_STATES, STOP_TIMEOUT_S):
                raise RuntimeError(f"il nodo {node} non si e' spento")

            r = await self.api.put(f"/labs/{lid}/nodes/{nid}/state/start")
            if r.status_code >= 400:
                raise RuntimeError(f"errore start nodo {node}: {r.text}")

            if not await wait_node_state(lambda st: st == "BOOTED", BOOT_TIMEOUT_S):
                raise RuntimeError(f"il nodo {node} non si e' avviato")

            n_tot = len(spec["nodes"])
            self.active_room = room_id
            self._wanted = room_id
            self._set(room_id, "ready", "Rete della stanza accesa", ready_nodes=n_tot, total_nodes=n_tot)
            return {"status": "reloading", "room_id": room_id, "node": node}
        else:
            r = await self.api.put(f"/labs/{lid}/stop")
            if r.status_code >= 400:
                raise RuntimeError(f"errore stop lab: {r.text}")
            if not await self._wait_nodes(lid, lambda n: n["state"] in OFF_STATES, STOP_TIMEOUT_S):
                raise RuntimeError(f"il lab {spec['lab_title']} non si spegne")

            r = await self.api.put(f"/labs/{lid}/start")
            if r.status_code >= 400:
                raise RuntimeError(f"errore start lab: {r.text}")
            if not await self._wait_nodes(lid, lambda n: n["state"] == "BOOTED", BOOT_TIMEOUT_S):
                raise RuntimeError(f"il lab {spec['lab_title']} non si avvia")

            n_tot = len(spec["nodes"])
            self.active_room = room_id
            self._wanted = room_id
            self._set(room_id, "ready", "Rete della stanza accesa", ready_nodes=n_tot, total_nodes=n_tot)
            return {"status": "reloading", "room_id": room_id, "node": "all"}

    # ---- comandi singoli (vecchio terminale) ----------------------------
    async def exec_command(self, node_label: str, command: str, room_id: Optional[str] = None) -> str:
        room_id = room_id or self.active_room or self._room_of(node_label)
        if not room_id:
            raise RuntimeError("nessuna stanza attiva")
        ns = node_spec(room_id, node_label)
        if not ns:
            raise ValueError(f"{node_label} non e' nella stanza {room_id}")

        cml_def = ns["cml_def"]
        cmd_to_run = command
        formatter = None
        if cml_def in ("alpine", "ubuntu", "server") or ns.get("kind") in ("pc", "server", "printer"):
            from backend.windows_translator import translate_windows_command
            res = translate_windows_command(command)
            if res:
                cmd_to_run, formatter = res

        out = await asyncio.to_thread(run_console_command, room_spec(room_id)["lab_title"],
                                       node_label, cml_def, cmd_to_run)
        if formatter:
            try:
                out = formatter(out)
            except Exception:
                pass
        return out

    def _room_of(self, node_label: str) -> Optional[str]:
        return next((r for r in ROOMS if node_spec(r, node_label)), None)


room_manager = RoomManager()


# ---------------------------------------------------------------------------
# Ponte console <-> WebSocket
# ---------------------------------------------------------------------------
# console bloccate da un'operazione automatica (es. Verifica): (lab, nodo) -> motivo.
# Mentre un nodo e' bloccato il ponte WebSocket non inoltra al giocatore ne' l'output ne' i tasti.
CONSOLE_LOCKS: Dict[Tuple[str, str], str] = {}


class console_lock:
    """Blocca le console di alcuni nodi per la durata del blocco `with`."""

    def __init__(self, lab_title: str, nodes: List[str], reason: str) -> None:
        self.keys = [(lab_title, n) for n in nodes]
        self.reason = reason

    def __enter__(self) -> "console_lock":
        for k in self.keys:
            CONSOLE_LOCKS[k] = self.reason
        return self

    def __exit__(self, *exc: Any) -> None:
        for k in self.keys:
            CONSOLE_LOCKS.pop(k, None)


# blocchi brevi che il giocatore non deve vedere (nessun avviso, tasti messi in coda)
SILENT_LOCKS = {"LED"}
# ponti WebSocket aperti per nodo (per sapere se il terminale del giocatore e' inattivo)
OPEN_BRIDGES: Dict[Tuple[str, str], List["ConsoleBridge"]] = {}

# console aperte dai giocatori: (lab, nodo) -> numero di sessioni. La console seriale e' una linea
# condivisa: su questi nodi il backend non manda comandi automatici (es. lettura dei LED).
OPEN_CONSOLES: Dict[Tuple[str, str], int] = {}


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
        # modalita' IOS del giocatore, ricavata dall'eco della console (per ripristinarla dopo la Verifica)
        self._text = ""
        self.last_prompt: Optional[re.Match] = None
        self.submode_cmd: Optional[str] = None
        self._saved: Optional[Tuple[str, Optional[str]]] = None
        self._suppress = False
        self.pending = ""        # riga che il giocatore sta scrivendo (tasti non ancora inviati con Invio)
        self.queued = ""         # tasti arrivati durante un blocco: si inviano dopo
        self.last_key = 0.0
        self.last_output = 0.0
        self.net_changed = False  # un comando appena dato puo' aver cambiato porte/VLAN/STP

    def open(self) -> None:
        self.ssh, self.chan, rest = open_console(self.lab_title, self.node_label, self.cols, self.rows)
        k = (self.lab_title, self.node_label)
        OPEN_CONSOLES[k] = OPEN_CONSOLES.get(k, 0) + 1
        OPEN_BRIDGES.setdefault(k, []).append(self)
        self._registered = True
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
                if (self.lab_title, self.node_label) in CONSOLE_LOCKS or self._suppress:
                    continue  # output di un'operazione automatica: il giocatore non lo vede
                self._track(data)
                self.last_output = time.time()
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

    # ---- modalita' IOS: tracciamento e ripristino ----------------------------
    _PROMPT = re.compile(r"([\w\-.]+)(?:\((config[^)]*)\))?([>#])\s*$")
    _CFG_LINE = re.compile(r"^[\w\-.]+\((config[^)]*)\)#\s*(\S.*)$")
    _SUBMODE = re.compile(r"^(int|interface|vlan|line|ip dhcp pool|ip dhcp|router|ip access-list|ip acc|spanning-tree mst conf)",
                          re.IGNORECASE)

    def _track(self, data: bytes) -> None:
        if self.cml_def not in IOS_DEFS:
            return
        text = ANSI_ESC.sub("", data.decode(errors="ignore")).replace("\r", "")
        chars: List[str] = []
        for ch in self._text + text:  # applica i backspace dell'eco ("\b \b")
            if ch == "\x08":
                if chars and chars[-1] != "\n":
                    chars.pop()
            else:
                chars.append(ch)
        lines = "".join(chars).split("\n")
        for done in lines[:-1]:  # righe complete: comandi dati in configurazione
            m = self._CFG_LINE.match(done.strip())
            if m and self._SUBMODE.match(m.group(2)) and not m.group(2).lower().startswith("no "):
                self.submode_cmd = m.group(2).strip()
        self._text = lines[-1][-300:]
        m = self._PROMPT.search(self._text)
        if m:
            self.last_prompt = m

    def snapshot_mode(self) -> None:
        """Annota la modalita' attuale del giocatore (prima della Verifica)."""
        if self.cml_def not in IOS_DEFS or not self.last_prompt:
            self._saved = None
            return
        cfg, sign = self.last_prompt.group(2), self.last_prompt.group(3)
        mode = "exec" if sign == ">" else "priv" if not cfg else "config" if cfg == "config" else "submode"
        self._saved = (mode, self.submode_cmd if mode == "submode" else None)

    def restore_mode(self, silent: bool = False) -> None:
        """Dopo un blocco: rientra nella modalita' annotata senza mostrarlo e rimette la riga che il
        giocatore stava scrivendo. `silent` (lettura LED): lo schermo mostra ancora il prompt di prima,
        quindi niente prompt nuovo e la riga viene riscritta sul dispositivo senza eco."""
        saved, self._saved = self._saved, None
        if not (self.chan and not self.chan.closed):
            return
        typed, self.queued = self.pending, self.queued
        self.pending = ""
        if typed and "\x1b" in typed:
            typed = ""  # frecce e sequenze di escape non si possono rigiocare in modo sicuro
        self._suppress = True
        try:
            if saved and saved[0] != "priv":
                mode, sub = saved
                cmds = ["disable"] if mode == "exec" else ["configure terminal"] + ([sub] if mode == "submode" and sub else [])
                for c in cmds:
                    self.chan.send(c + "\r")
                    time.sleep(0.4)
            if silent:
                time.sleep(0.4)
                if typed:
                    self._note_keys(typed)
                    self.chan.send(typed)  # riga del giocatore, gia' visibile sul suo schermo
                time.sleep(0.4)
            else:
                time.sleep(0.4)
        finally:
            self._suppress = False
        if not silent:
            self.chan.send("\r")  # prompt nuovo dopo la Verifica
            if typed:
                time.sleep(0.3)
                self._note_keys(typed)
                self.chan.send(typed)
        queued, self.queued = self.queued, ""
        if queued:
            self._note_keys(queued)
            self.chan.send(queued)

    def locked(self) -> Optional[str]:
        return CONSOLE_LOCKS.get((self.lab_title, self.node_label))

    def idle(self, quiet_s: float = 3.0) -> bool:
        """Il giocatore non digita e il terminale e' fermo al prompt (nessun comando in corso)."""
        now = time.time()
        at_prompt = bool(self.last_prompt) and bool(self._PROMPT.search(self._text)) if self.cml_def in IOS_DEFS else True
        return now - self.last_key > quiet_s and now - self.last_output > 1.5 and at_prompt

    _CHANGING_EXEC = re.compile(r"^\s*(clear|shut|no shut|reload|copy|write|wr\b)", re.IGNORECASE)

    def send(self, data: str) -> None:
        self.last_key = time.time()
        if self.locked():
            self.queued += data  # tasti durante un blocco: inviati appena finisce
            return
        if not self.locked() and self.queued:
            data = self.queued + data
            self.queued = ""
        if "\r" in data and self.cml_def in IOS_DEFS:
            line = (self.pending + data.split("\r")[0]).strip()
            in_config = bool(self.last_prompt and self.last_prompt.group(2))
            if line and (in_config or self._CHANGING_EXEC.match(line)):
                self.net_changed = True
        self._note_keys(data)
        if self.chan and not self.chan.closed:
            self.chan.send(data)

    def replay(self, echoed: str, raw: str) -> None:
        """Tasti scritti nel gioco durante un blocco silenzioso: `echoed` e' gia' sullo schermo del
        giocatore (eco locale), quindi va al dispositivo con l'eco nascosta; `raw` va inviato normalmente."""
        if not (self.chan and not self.chan.closed):
            return
        if echoed:
            self._suppress = True
            try:
                self._note_keys(echoed)
                self.chan.send(echoed)
                time.sleep(0.5)  # l'eco del dispositivo arriva entro questo tempo
            finally:
                self._suppress = False
        if raw:
            self.send(raw)

    def _note_keys(self, data: str) -> None:
        for ch in data:
            if ch in "\r\n\x03\x15\x1a":
                self.pending = ""
            elif ch in "\x7f\x08":
                self.pending = self.pending[:-1]
            else:
                self.pending += ch

    def redraw_prompt(self) -> None:
        if self.chan and not self.chan.closed:
            self.chan.send("\r")

    def resize(self, cols: int, rows: int) -> None:
        if self.chan and not self.chan.closed:
            self.chan.resize_pty(width=cols, height=rows)

    def close(self) -> None:
        self._stop.set()
        if getattr(self, "_registered", False):
            k = (self.lab_title, self.node_label)
            OPEN_CONSOLES[k] = max(0, OPEN_CONSOLES.get(k, 1) - 1)
            if not OPEN_CONSOLES[k]:
                OPEN_CONSOLES.pop(k, None)
            if self in OPEN_BRIDGES.get(k, []):
                OPEN_BRIDGES[k].remove(self)
                if not OPEN_BRIDGES[k]:
                    OPEN_BRIDGES.pop(k, None)
            self._registered = False
        try:
            if self.ssh:
                self.ssh.close()
        except Exception:
            pass
