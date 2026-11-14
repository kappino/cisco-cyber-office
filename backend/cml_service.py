import os
import time
from typing import Any, Dict, List, Optional
import httpx
import paramiko

CML_URL = os.getenv("CML_URL", "https://192.168.122.110").rstrip("/")
CML_HOST = CML_URL.replace("https://", "").replace("http://", "").split(":")[0]
CML_SSH_PORT = int(os.getenv("CML_SSH_PORT", "1122"))
CML_USER = os.getenv("CML_USER", "admin")
CML_PASS = os.getenv("CML_PASS", "changeme")
CML_LAB_TITLE = os.getenv("CML_LAB_TITLE", "FuoriRete_Office")
INFRA_TIMEOUT_SEC = float(os.getenv("INFRA_TIMEOUT_MS", "1500")) / 1000.0

# 1-to-1 mapping between PatchRackGame port IDs and CML IOL-L2 physical interface labels
PORT_IFACE_MAP: Dict[str, str] = {
    "sw-g1": "Ethernet0/0",
    "sw-1": "Ethernet0/1",
    "sw-2": "Ethernet0/2",
    "sw-3": "Ethernet0/3",
}

# 1-to-1 mapping between game rooms and CML labs (keeps <= 5 active nodes per room)
ROOM_LAB_MAP: Dict[str, str] = {
    "office": "FuoriRete_Room_Office",
    "corridor": "FuoriRete_Room_Corridor",
    "datacenter_vault": "FuoriRete_Room_Datacenter",
}


class CMLService:
    """Async client for Cisco Modeling Labs (CML 2.x) REST API with deterministic fallback."""

    def __init__(self) -> None:
        self._token: Optional[str] = None
        self._lab_id: Optional[str] = None

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

    async def _find_lab_id(self, client: httpx.AsyncClient, headers: Dict[str, str]) -> Optional[str]:
        resp = await client.get("/api/v0/labs", headers=headers)
        if resp.status_code != 200:
            return None
        lab_ids: List[str] = resp.json()
        for lid in lab_ids:
            detail = await client.get(f"/api/v0/labs/{lid}", headers=headers)
            if detail.status_code == 200 and detail.json().get("lab_title") == CML_LAB_TITLE:
                self._lab_id = lid
                return lid
        return None

    async def get_status(self) -> Dict[str, Any]:
        t0 = time.perf_counter()
        try:
            async with self._client() as client:
                headers = await self._headers(client)
                lab_id = await self._find_lab_id(client, headers)
                nodes_active = 0
                if lab_id:
                    n_resp = await client.get(f"/api/v0/labs/{lab_id}/nodes", headers=headers)
                    if n_resp.status_code == 200:
                        nodes_active = len(n_resp.json())
                latency = round((time.perf_counter() - t0) * 1000, 1)
                return {
                    "status": "online",
                    "mode": "live_cml",
                    "ip": CML_URL.replace("https://", "").replace("http://", ""),
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
                "ip": CML_URL.replace("https://", "").replace("http://", ""),
                "lab_title": CML_LAB_TITLE,
                "lab_found": False,
                "lab_id": None,
                "nodes_active": 0,
                "latency_ms": latency,
                "detail": str(exc),
            }

    async def ensure_demo_lab(self) -> Dict[str, Any]:
        t0 = time.perf_counter()
        try:
            async with self._client(timeout=5.0) as client:
                headers = await self._headers(client)
                lab_id = await self._find_lab_id(client, headers)
                created = False
                if not lab_id:
                    create_resp = await client.post(
                        "/api/v0/labs",
                        headers=headers,
                        json={"title": CML_LAB_TITLE, "description": "FuoriRete Office Demo Lab"},
                    )
                    create_resp.raise_for_status()
                    lab_id = create_resp.json()["id"]
                    self._lab_id = lab_id
                    created = True

                    # Create SW-CORE-01 (ioll2-xe) and RTR-EDGE-01 (iol-xe)
                    sw_resp = await client.post(
                        f"/api/v0/labs/{lab_id}/nodes",
                        headers=headers,
                        json={
                            "label": "SW-CORE-01",
                            "node_definition": "ioll2-xe",
                            "x": -120,
                            "y": 0,
                        },
                    )
                    rtr_resp = await client.post(
                        f"/api/v0/labs/{lab_id}/nodes",
                        headers=headers,
                        json={
                            "label": "RTR-EDGE-01",
                            "node_definition": "iol-xe",
                            "x": 120,
                            "y": 0,
                        },
                    )
                    if sw_resp.status_code in (200, 201) and rtr_resp.status_code in (200, 201):
                        sw_id = sw_resp.json()["id"]
                        rtr_id = rtr_resp.json()["id"]
                        sw_ifaces = await client.get(f"/api/v0/labs/{lab_id}/nodes/{sw_id}/interfaces", headers=headers)
                        rtr_ifaces = await client.get(f"/api/v0/labs/{lab_id}/nodes/{rtr_id}/interfaces", headers=headers)
                        if sw_ifaces.status_code == 200 and rtr_ifaces.status_code == 200:
                            sw_if_list = sw_ifaces.json()
                            rtr_if_list = rtr_ifaces.json()
                            if sw_if_list and rtr_if_list:
                                await client.post(
                                    f"/api/v0/labs/{lab_id}/links",
                                    headers=headers,
                                    json={"src_int": sw_if_list[0], "dst_int": rtr_if_list[0]},
                                )
                    await client.put(f"/api/v0/labs/{lab_id}/start", headers=headers)

                latency = round((time.perf_counter() - t0) * 1000, 1)
                return {
                    "mode": "live_cml",
                    "lab_id": lab_id,
                    "lab_title": CML_LAB_TITLE,
                    "created": created,
                    "latency_ms": latency,
                }
        except Exception as exc:
            latency = round((time.perf_counter() - t0) * 1000, 1)
            return {
                "mode": "fallback_sim",
                "lab_id": None,
                "lab_title": CML_LAB_TITLE,
                "created": False,
                "latency_ms": latency,
                "detail": str(exc),
            }

    async def toggle_interface(
        self, node_label: str, slot_or_iface: str, state_up: bool
    ) -> Dict[str, Any]:
        """Toggle a 1-to-1 mapped physical interface on CML (start/stop) for PatchRackGame."""
        t0 = time.perf_counter()
        target_iface_label = PORT_IFACE_MAP.get(slot_or_iface, slot_or_iface)
        try:
            async with self._client(timeout=3.0) as client:
                headers = await self._headers(client)
                lab_id = self._lab_id or await self._find_lab_id(client, headers)
                if not lab_id:
                    raise RuntimeError("Active room lab not found")
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
                if target_node_id:
                    if_resp = await client.get(
                        f"/api/v0/labs/{lab_id}/nodes/{target_node_id}/interfaces",
                        headers=headers,
                    )
                    if if_resp.status_code == 200:
                        for if_id in if_resp.json():
                            d = await client.get(
                                f"/api/v0/labs/{lab_id}/interfaces/{if_id}",
                                headers=headers,
                            )
                            if d.status_code == 200 and d.json().get("label") == target_iface_label:
                                toggled_iface_id = if_id
                                break
                    action = "start" if state_up else "stop"
                    if toggled_iface_id:
                        await client.put(
                            f"/api/v0/labs/{lab_id}/interfaces/{toggled_iface_id}/state/{action}",
                            headers=headers,
                        )
                    else:
                        await client.put(
                            f"/api/v0/labs/{lab_id}/nodes/{target_node_id}/state/{action}",
                            headers=headers,
                        )

                latency = round((time.perf_counter() - t0) * 1000, 1)
                return {
                    "mode": "live_cml",
                    "node": node_label,
                    "interface": target_iface_label,
                    "iface_id": toggled_iface_id,
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

    def _ssh_exec_sync(self, lab_title: str, node_label: str, command: str) -> str:
        """Execute a CLI command on a CML node via Terminal Server SSH (port 1122)."""
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        try:
            ssh.connect(
                CML_HOST,
                port=CML_SSH_PORT,
                username=CML_USER,
                password=CML_PASS,
                timeout=3.0,
                look_for_keys=False,
                allow_agent=False,
            )
            chan = ssh.invoke_shell()
            time.sleep(0.3)
            chan.send(f"open /{lab_title}/{node_label}/0\n")
            time.sleep(0.4)
            chan.send(f"{command}\n")
            time.sleep(0.5)
            out = chan.recv(4096).decode("utf-8", errors="ignore")
            chan.close()
            return out.strip() or f"[{node_label}] {command} -> OK"
        finally:
            ssh.close()

    async def exec_ios_command(self, node_label: str, command: str) -> Dict[str, Any]:
        t0 = time.perf_counter()
        try:
            async with self._client() as client:
                headers = await self._headers(client)
                lab_id = self._lab_id or await self._find_lab_id(client, headers)
                if not lab_id:
                    raise RuntimeError("Demo lab not found")
                lab_info = await client.get(f"/api/v0/labs/{lab_id}", headers=headers)
                lab_title = lab_info.json().get("lab_title", CML_LAB_TITLE) if lab_info.status_code == 200 else CML_LAB_TITLE
                import asyncio
                ssh_output = await asyncio.to_thread(self._ssh_exec_sync, lab_title, node_label, command)
                latency = round((time.perf_counter() - t0) * 1000, 1)
                return {
                    "source": "live_cml",
                    "node": node_label,
                    "command": command,
                    "output": f"[CML SSH {node_label}] {ssh_output[-300:]}",
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

    async def sync_room_lab(self, room_id: str) -> Dict[str, Any]:
        """Stop other labs and start/ensure the CML lab mapped to the player's current room."""
        t0 = time.perf_counter()
        target_title = ROOM_LAB_MAP.get(room_id, CML_LAB_TITLE)
        try:
            async with self._client(timeout=8.0) as client:
                headers = await self._headers(client)
                labs_resp = await client.get("/api/v0/labs", headers=headers)
                labs_resp.raise_for_status()
                target_lab_id = None
                for lid in labs_resp.json():
                    detail = await client.get(f"/api/v0/labs/{lid}", headers=headers)
                    if detail.status_code == 200 and detail.json().get("lab_title") == target_title:
                        target_lab_id = lid
                    else:
                        await client.put(f"/api/v0/labs/{lid}/stop", headers=headers)

                if not target_lab_id:
                    c_resp = await client.post(
                        "/api/v0/labs",
                        headers=headers,
                        json={"title": target_title, "description": f"Room lab: {room_id}"},
                    )
                    c_resp.raise_for_status()
                    target_lab_id = c_resp.json()["id"]
                    await client.post(
                        f"/api/v0/labs/{target_lab_id}/nodes?populate_interfaces=true",
                        headers=headers,
                        json={"label": "SW-CORE-01", "node_definition": "ioll2-xe", "x": -120, "y": 0},
                    )
                    await client.post(
                        f"/api/v0/labs/{target_lab_id}/nodes?populate_interfaces=true",
                        headers=headers,
                        json={"label": "RTR-EDGE-01", "node_definition": "iol-xe", "x": 120, "y": 0},
                    )

                self._lab_id = target_lab_id
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

    async def _get_physical_interfaces(
        self, client: httpx.AsyncClient, headers: Dict[str, str], lab_id: str, node_id: str
    ) -> List[str]:
        """Return only physical interface IDs for a CML node (skipping loopback0)."""
        resp = await client.get(f"/api/v0/labs/{lab_id}/nodes/{node_id}/interfaces", headers=headers)
        if resp.status_code != 200:
            return []
        physical: List[str] = []
        for if_id in resp.json():
            d = await client.get(
                f"/api/v0/labs/{lab_id}/interfaces/{if_id}",
                headers=headers,
            )
            if d.status_code == 200 and d.json().get("type") == "physical":
                physical.append(if_id)
        return physical

    async def deploy_custom_topology(self, spec: Dict[str, Any]) -> Dict[str, Any]:
        """Instantiate an LLM/netAgent-generated topology spec onto Cisco Modeling Labs."""
        t0 = time.perf_counter()
        lab_title = f"FuoriRete_{spec.get('mission_id', 'custom')}"
        try:
            async with self._client(timeout=12.0) as client:
                headers = await self._headers(client)

                # Stop other labs first so CML-Free's 5-node license limit is freed
                existing_labs = await client.get("/api/v0/labs", headers=headers)
                if existing_labs.status_code == 200:
                    for old_id in existing_labs.json():
                        await client.put(f"/api/v0/labs/{old_id}/stop", headers=headers)

                create_resp = await client.post(
                    "/api/v0/labs",
                    headers=headers,
                    json={
                        "title": lab_title,
                        "description": spec.get("description", "Generated by netAgent + YAML"),
                    },
                )
                create_resp.raise_for_status()
                lab_id = create_resp.json()["id"]

                node_map: Dict[str, str] = {}
                for idx, node in enumerate(spec.get("nodes", [])):
                    label = node.get("label", f"NODE-{idx+1}")
                    cml_def = node.get("cml_def", "iol-xe")
                    if cml_def not in ("iol-xe", "ioll2-xe", "alpine"):
                        cml_def = "iol-xe"
                    cfg_lines = node.get("faulty_config") or node.get("ideal_config") or []
                    payload: Dict[str, Any] = {
                        "label": label,
                        "node_definition": cml_def,
                        "x": int(node.get("x", (idx - 1) * 160)),
                        "y": int(node.get("y", 0)),
                    }
                    if cfg_lines and cml_def != "alpine":
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
                    src_label = link.get("src_node", "")
                    dst_label = link.get("dst_node", "")
                    src_id = node_map.get(src_label)
                    dst_id = node_map.get(dst_label)
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

                await client.put(f"/api/v0/labs/{lab_id}/start", headers=headers)
                latency = round((time.perf_counter() - t0) * 1000, 1)
                return {
                    "mode": "live_cml",
                    "lab_id": lab_id,
                    "lab_title": lab_title,
                    "nodes_created": len(node_map),
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


cml_service = CMLService()
