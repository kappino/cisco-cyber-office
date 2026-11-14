"""Async client for Cisco Modeling Labs (CML 2.x) REST API + Terminal Server SSH.

Supports:
- Per-room realistic YAML topologies (staying within CML-Free's 5-node license limit)
- 1-to-1 physical link & interface toggling (start/stop) for PatchRackGame
- Persistent SSH console redirection (CML2 termserv port 22) for CrtTerminalGame
- Deterministic fallback (`fallback_sim`) when CML is unreachable
"""

from __future__ import annotations

import asyncio
import os
import re
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import httpx
import paramiko
import yaml

CML_URL = os.getenv("CML_URL", "https://192.168.122.110").rstrip("/")
CML_HOST = CML_URL.replace("https://", "").replace("http://", "").split(":")[0]
CML_SSH_PORT = int(os.getenv("CML_SSH_PORT", "22"))
CML_USER = os.getenv("CML_USER", "admin")
CML_PASS = os.getenv("CML_PASS", "changeme")
CML_LAB_TITLE = os.getenv("CML_LAB_TITLE", "FuoriRete_Room_Corridor")
INFRA_TIMEOUT_SEC = float(os.getenv("INFRA_TIMEOUT_MS", "1500")) / 1000.0
MISSIONS_DIR = Path(__file__).parent / "missions"

# 1-to-1 mapping between PatchRackGame port IDs and CML IOL-L2 physical interface labels
PORT_IFACE_MAP: Dict[str, str] = {
    "sw-g1": "Ethernet0/0",
    "sw-1": "Ethernet0/1",
    "sw-2": "Ethernet0/2",
    "sw-3": "Ethernet0/3",
}

# 1-to-1 mapping between game rooms and CML labs (each room <= 5 active nodes)
ROOM_LAB_MAP: Dict[str, str] = {
    "office": "FuoriRete_Room_Office",
    "corridor": "FuoriRete_Room_Corridor",
    "datacenter_vault": "FuoriRete_Room_Datacenter",
}

_ANSI_RE = re.compile(r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")


class CMLService:
    """Async client for Cisco Modeling Labs (CML 2.x) REST API + TermServ SSH."""

    def __init__(self) -> None:
        self._token: Optional[str] = None
        self._lab_id: Optional[str] = None
        self._ssh_sessions: Dict[Tuple[str, str], Tuple[paramiko.SSHClient, paramiko.Channel]] = {}

    def _client(self, timeout: Optional[float] = None) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=CML_URL,
            verify=False,
            timeout=timeout or INFRA_TIMEOUT_SEC,
        )

    async def _authenticate(self, client: httpx.AsyncClient) -> Optional[str]:
        if self._token:
            return self._token
        resp = await client.post(
            "/api/v0/authenticate",
            json={"username": CML_USER, "password": CML_PASS},
        )
        if resp.status_code == 200:
            self._token = resp.text.strip().strip('"')
            return self._token
        return None

    async def _headers(self, client: httpx.AsyncClient) -> Dict[str, str]:
        token = await self._authenticate(client)
        if not token:
            raise RuntimeError("CML authentication failed")
        return {"Authorization": f"Bearer {token}"}

    async def _find_started_or_named_lab(
        self, client: httpx.AsyncClient, headers: Dict[str, str], preferred_title: Optional[str] = None
    ) -> Optional[str]:
        resp = await client.get("/api/v0/labs", headers=headers)
        if resp.status_code != 200:
            return None
        started_id: Optional[str] = None
        for lid in resp.json():
            detail = await client.get(f"/api/v0/labs/{lid}", headers=headers)
            if detail.status_code != 200:
                continue
            info = detail.json()
            if preferred_title and info.get("lab_title") == preferred_title:
                self._lab_id = lid
                return lid
            if info.get("state") == "STARTED" and not started_id:
                started_id = lid
        if started_id:
            self._lab_id = started_id
        return started_id

    async def _get_physical_interfaces(
        self, client: httpx.AsyncClient, headers: Dict[str, str], lab_id: str, node_id: str
    ) -> List[str]:
        """Return physical interface IDs for a CML node (skipping Loopback0)."""
        resp = await client.get(f"/api/v0/labs/{lab_id}/nodes/{node_id}/interfaces", headers=headers)
        if resp.status_code != 200:
            return []
        physical: List[str] = []
        for if_id in resp.json():
            d = await client.get(f"/api/v0/labs/{lab_id}/interfaces/{if_id}", headers=headers)
            if d.status_code == 200 and d.json().get("type") == "physical":
                physical.append(if_id)
        return physical

    async def _build_lab_from_spec(
        self, client: httpx.AsyncClient, headers: Dict[str, str], lab_title: str, spec: Dict[str, Any]
    ) -> Tuple[str, int, int]:
        """Create a lab on CML from a YAML/JSON topology spec, wire links, and return (lab_id, nodes, links)."""
        create_resp = await client.post(
            "/api/v0/labs",
            headers=headers,
            json={"title": lab_title, "description": spec.get("description", "Cisco Cyber Office Lab")},
        )
        create_resp.raise_for_status()
        lab_id = create_resp.json()["id"]

        node_map: Dict[str, str] = {}
        for idx, node in enumerate(spec.get("nodes", [])):
            label = node.get("label", f"NODE-{idx+1}")
            cml_def = node.get("cml_def", "iol-xe")
            if cml_def not in ("iol-xe", "ioll2-xe", "alpine"):
                cml_def = "iol-xe"
            payload: Dict[str, Any] = {
                "label": label,
                "node_definition": cml_def,
                "x": int(node.get("x", (idx - 1) * 160)),
                "y": int(node.get("y", 0)),
            }
            if cml_def == "alpine" and node.get("ip_config"):
                ip_cfg = node["ip_config"]
                lines = [
                    f"hostname {label}",
                    "ip link set eth0 up",
                    f"ip addr add {ip_cfg['ip']} dev eth0",
                    f"ip route add default via {ip_cfg['gw']}",
                ]
                for port in node.get("exposed_ports", []):
                    lines.append(f"(while true; do nc -lk -p {int(port)} -e /bin/true 2>/dev/null || nc -l -p {int(port)} >/dev/null 2>&1; done) &")
                if node.get("http_panel"):
                    lines.append(
                        "(while true; do printf 'HTTP/1.1 200 OK\\r\\nContent-Type: text/html\\r\\n\\r\\n<h1>Admin Panel (default: admin/admin)</h1>' | nc -l -p 80 >/dev/null 2>&1; done) &"
                    )
                payload["configuration"] = "\n".join(lines) + "\n"
            else:
                cfg_lines = node.get("faulty_config") or node.get("ideal_config") or []
                if cfg_lines:
                    payload["configuration"] = "\n".join(cfg_lines)

            n_resp = await client.post(
                f"/api/v0/labs/{lab_id}/nodes?populate_interfaces=true",
                headers=headers,
                json=payload,
            )
            if n_resp.status_code in (200, 201):
                node_map[label] = n_resp.json()["id"]

        links_created = 0
        node_ifaces: Dict[str, List[str]] = {}
        used_ifaces: Dict[str, int] = {}
        for link in spec.get("links", []):
            src_id = node_map.get(link.get("src_node", ""))
            dst_id = node_map.get(link.get("dst_node", ""))
            if not src_id or not dst_id:
                continue
            if src_id not in node_ifaces:
                node_ifaces[src_id] = await self._get_physical_interfaces(client, headers, lab_id, src_id)
            if dst_id not in node_ifaces:
                node_ifaces[dst_id] = await self._get_physical_interfaces(client, headers, lab_id, dst_id)
            s_list = node_ifaces[src_id]
            d_list = node_ifaces[dst_id]
            s_idx = used_ifaces.get(src_id, 0)
            d_idx = used_ifaces.get(dst_id, 0)
            if s_idx < len(s_list) and d_idx < len(d_list):
                l_resp = await client.post(
                    f"/api/v0/labs/{lab_id}/links",
                    headers=headers,
                    json={"src_int": s_list[s_idx], "dst_int": d_list[d_idx]},
                )
                if l_resp.status_code in (200, 201):
                    used_ifaces[src_id] = s_idx + 1
                    used_ifaces[dst_id] = d_idx + 1
                    links_created += 1

        return lab_id, len(node_map), links_created

    async def get_status(self) -> Dict[str, Any]:
        t0 = time.perf_counter()
        try:
            async with self._client() as client:
                headers = await self._headers(client)
                lab_id = await self._find_started_or_named_lab(client, headers, CML_LAB_TITLE)
                nodes_active = 0
                if lab_id:
                    n_resp = await client.get(f"/api/v0/labs/{lab_id}/nodes", headers=headers)
                    if n_resp.status_code == 200:
                        nodes_active = len(n_resp.json())
                latency = round((time.perf_counter() - t0) * 1000, 1)
                return {
                    "status": "online",
                    "mode": "live_cml",
                    "ip": CML_HOST,
                    "lab_title": CML_LAB_TITLE,
                    "lab_found": lab_id is not None,
                    "lab_id": lab_id,
                    "nodes_active": nodes_active,
                    "latency_ms": latency,
                }
        except Exception as exc:
            latency = round((time.perf_counter() - t0) * 1000, 1)
            return {
                "status": "fallback",
                "mode": "fallback_sim",
                "ip": CML_HOST,
                "lab_title": CML_LAB_TITLE,
                "lab_found": False,
                "lab_id": None,
                "nodes_active": 0,
                "latency_ms": latency,
                "detail": str(exc),
            }

    async def ensure_demo_lab(self) -> Dict[str, Any]:
        return await self.sync_room_lab("corridor")

    async def sync_room_lab(self, room_id: str) -> Dict[str, Any]:
        """Stop other labs and ensure/start the realistic YAML lab mapped to the player's room."""
        t0 = time.perf_counter()
        target_title = ROOM_LAB_MAP.get(room_id, ROOM_LAB_MAP["corridor"])
        yaml_file = MISSIONS_DIR / f"room_{room_id}.yaml"
        if not yaml_file.exists():
            yaml_file = MISSIONS_DIR / "room_corridor.yaml"

        try:
            async with self._client(timeout=12.0) as client:
                headers = await self._headers(client)
                labs_resp = await client.get("/api/v0/labs", headers=headers)
                labs_resp.raise_for_status()

                target_lab_id: Optional[str] = None
                for lid in labs_resp.json():
                    detail = await client.get(f"/api/v0/labs/{lid}", headers=headers)
                    if detail.status_code == 200 and detail.json().get("lab_title") == target_title:
                        # Rebuild if it was an old empty lab with 0 links
                        links_r = await client.get(f"/api/v0/labs/{lid}/links", headers=headers)
                        if links_r.status_code == 200 and len(links_r.json()) > 0:
                            target_lab_id = lid
                        else:
                            await client.put(f"/api/v0/labs/{lid}/stop", headers=headers)
                            await client.put(f"/api/v0/labs/{lid}/wipe", headers=headers)
                            await client.delete(f"/api/v0/labs/{lid}", headers=headers)
                    else:
                        await client.put(f"/api/v0/labs/{lid}/stop", headers=headers)

                if not target_lab_id:
                    with yaml_file.open("r", encoding="utf-8") as fh:
                        spec = yaml.safe_load(fh)
                    target_lab_id, _, _ = await self._build_lab_from_spec(client, headers, target_title, spec)

                self._lab_id = target_lab_id
                self._close_all_ssh()
                await client.put(f"/api/v0/labs/{target_lab_id}/start", headers=headers)
                latency = round((time.perf_counter() - t0) * 1000, 1)
                return {
                    "mode": "live_cml",
                    "room_id": room_id,
                    "lab_title": target_title,
                    "lab_id": target_lab_id,
                    "latency_ms": latency,
                }
        except Exception as exc:
            latency = round((time.perf_counter() - t0) * 1000, 1)
            return {
                "mode": "fallback_sim",
                "room_id": room_id,
                "lab_title": target_title,
                "lab_id": None,
                "latency_ms": latency,
                "detail": str(exc),
            }

    async def deploy_custom_topology(self, spec: Dict[str, Any]) -> Dict[str, Any]:
        """Instantiate a YAML/LLM topology spec onto Cisco Modeling Labs."""
        t0 = time.perf_counter()
        lab_title = f"FuoriRete_{spec.get('mission_id', 'custom')}"
        try:
            async with self._client(timeout=12.0) as client:
                headers = await self._headers(client)
                existing = await client.get("/api/v0/labs", headers=headers)
                if existing.status_code == 200:
                    for old_id in existing.json():
                        await client.put(f"/api/v0/labs/{old_id}/stop", headers=headers)

                lab_id, nodes_created, links_created = await self._build_lab_from_spec(
                    client, headers, lab_title, spec
                )
                self._lab_id = lab_id
                self._close_all_ssh()
                await client.put(f"/api/v0/labs/{lab_id}/start", headers=headers)
                latency = round((time.perf_counter() - t0) * 1000, 1)
                return {
                    "mode": "live_cml",
                    "lab_id": lab_id,
                    "lab_title": lab_title,
                    "nodes_created": nodes_created,
                    "links_created": links_created,
                    "latency_ms": latency,
                }
        except Exception as exc:
            latency = round((time.perf_counter() - t0) * 1000, 1)
            return {
                "mode": "fallback_sim",
                "lab_id": None,
                "lab_title": lab_title,
                "nodes_created": 0,
                "links_created": 0,
                "latency_ms": latency,
                "detail": str(exc),
            }

    async def toggle_interface(
        self, node_label: str, slot_or_iface: str, state_up: bool
    ) -> Dict[str, Any]:
        """Toggle both the physical interface and its attached CML link (1-to-1 with PatchRackGame)."""
        t0 = time.perf_counter()
        target_iface_label = PORT_IFACE_MAP.get(slot_or_iface, slot_or_iface)
        try:
            async with self._client(timeout=4.0) as client:
                headers = await self._headers(client)
                lab_id = self._lab_id or await self._find_started_or_named_lab(client, headers)
                if not lab_id:
                    raise RuntimeError("No active CML lab found")

                nodes_resp = await client.get(f"/api/v0/labs/{lab_id}/nodes", headers=headers)
                nodes_resp.raise_for_status()
                target_node_id = None
                for nid in nodes_resp.json():
                    nd = await client.get(f"/api/v0/labs/{lab_id}/nodes/{nid}", headers=headers)
                    if nd.status_code == 200 and nd.json().get("label") == node_label:
                        target_node_id = nid
                        break
                if not target_node_id:
                    target_node_id = nodes_resp.json()[0] if nodes_resp.json() else None

                toggled_iface_id = None
                toggled_link_id = None
                if target_node_id:
                    if_resp = await client.get(
                        f"/api/v0/labs/{lab_id}/nodes/{target_node_id}/interfaces",
                        headers=headers,
                    )
                    if if_resp.status_code == 200:
                        for if_id in if_resp.json():
                            d = await client.get(f"/api/v0/labs/{lab_id}/interfaces/{if_id}", headers=headers)
                            if d.status_code == 200 and d.json().get("label") == target_iface_label:
                                toggled_iface_id = if_id
                                break

                    action = "start" if state_up else "stop"
                    if toggled_iface_id:
                        await client.put(
                            f"/api/v0/labs/{lab_id}/interfaces/{toggled_iface_id}/state/{action}",
                            headers=headers,
                        )
                        links_resp = await client.get(f"/api/v0/labs/{lab_id}/links", headers=headers)
                        if links_resp.status_code == 200:
                            for lid_link in links_resp.json():
                                ld = await client.get(
                                    f"/api/v0/labs/{lab_id}/links/{lid_link}",
                                    headers=headers,
                                )
                                if ld.status_code == 200:
                                    ldata = ld.json()
                                    if toggled_iface_id in (ldata.get("interface_a"), ldata.get("interface_b")):
                                        toggled_link_id = lid_link
                                        await client.put(
                                            f"/api/v0/labs/{lab_id}/links/{lid_link}/state/{action}",
                                            headers=headers,
                                        )
                                        break

                latency = round((time.perf_counter() - t0) * 1000, 1)
                return {
                    "mode": "live_cml",
                    "node": node_label,
                    "interface": target_iface_label,
                    "link_id": toggled_link_id,
                    "up": state_up,
                    "latency_ms": latency,
                }
        except Exception as exc:
            latency = round((time.perf_counter() - t0) * 1000, 1)
            return {
                "mode": "fallback_sim",
                "node": node_label,
                "interface": target_iface_label,
                "up": state_up,
                "latency_ms": latency,
                "detail": str(exc),
            }

    def _close_all_ssh(self) -> None:
        for ssh, chan in self._ssh_sessions.values():
            try:
                chan.close()
                ssh.close()
            except Exception:
                pass
        self._ssh_sessions.clear()

    def _get_or_open_ssh(self, lab_title: str, node_label: str) -> paramiko.Channel:
        key = (lab_title, node_label)
        if key in self._ssh_sessions:
            _, chan = self._ssh_sessions[key]
            if not chan.closed:
                return chan

        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(
            CML_HOST,
            port=CML_SSH_PORT,
            username=CML_USER,
            password=CML_PASS,
            timeout=4.0,
            look_for_keys=False,
            allow_agent=False,
        )
        chan = ssh.invoke_shell(width=120, height=40)
        time.sleep(0.35)
        if chan.recv_ready():
            chan.recv(4096)
        chan.send(f"open /{lab_title}/{node_label}/0\r")
        time.sleep(0.9)
        chan.send("\r")
        time.sleep(0.4)
        if chan.recv_ready():
            chan.recv(8192)
        self._ssh_sessions[key] = (ssh, chan)
        return chan

    def _ssh_exec_sync(self, lab_title: str, node_label: str, command: str) -> str:
        chan = self._get_or_open_ssh(lab_title, node_label)
        if chan.recv_ready():
            chan.recv(4096)
        chan.send(f"{command}\r")
        buf = ""
        deadline = time.time() + 1.8
        while time.time() < deadline:
            time.sleep(0.15)
            if chan.recv_ready():
                chunk = chan.recv(8192).decode("utf-8", errors="ignore")
                buf += chunk
                if buf.rstrip().endswith((">", "#", "(config)#", "(config-if)#", "(config-subif)#")):
                    break
        cleaned = _ANSI_RE.sub("", buf).replace("\r", "")
        # Strip echoed command on first line if present
        lines = cleaned.splitlines()
        if lines and command.strip() in lines[0]:
            lines = lines[1:]
        return "\n".join(lines).strip()

    async def exec_ios_command(self, node_label: str, command: str) -> Dict[str, Any]:
        """Redirect CLI input/output directly to the live CML node console via TermServ port 22."""
        t0 = time.perf_counter()
        try:
            async with self._client(timeout=4.0) as client:
                headers = await self._headers(client)
                lab_id = self._lab_id or await self._find_started_or_named_lab(client, headers)
                if not lab_id:
                    raise RuntimeError("No active CML lab found")
                lab_info = await client.get(f"/api/v0/labs/{lab_id}", headers=headers)
                lab_title = lab_info.json().get("lab_title", CML_LAB_TITLE) if lab_info.status_code == 200 else CML_LAB_TITLE
                output = await asyncio.to_thread(self._ssh_exec_sync, lab_title, node_label, command)
                latency = round((time.perf_counter() - t0) * 1000, 1)
                return {
                    "source": "live_cml",
                    "node": node_label,
                    "command": command,
                    "output": output or f"{node_label}# (OK)",
                    "latency_ms": latency,
                }
        except Exception as exc:
            latency = round((time.perf_counter() - t0) * 1000, 1)
            return {
                "source": "fallback_sim",
                "node": node_label,
                "command": command,
                "output": f"[SIM] {node_label}# {command} -> OK",
                "latency_ms": latency,
                "detail": str(exc),
            }


cml_service = CMLService()
