"""FastAPI Orchestrator for Cisco Cyber Office (Milestone M4).

Bridges the Phaser/React frontend with:
- Cisco Modeling Labs (CML 2.x) REST API for live L1/L2/L3 lab control
- Local Ollama (gemma4:12b) for real-time NPC dialogue and Socratic hints

Both integrations degrade gracefully to deterministic simulation (`fallback_sim`)
whenever local infrastructure is unreachable or times out.
"""

from pathlib import Path
from typing import Any, Dict, List

from dotenv import load_dotenv
import asyncio
import json

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

# Load backend/.env before importing services that read os.getenv() at module import time.
load_dotenv(Path(__file__).parent / ".env")

from backend.ai_service import ai_service  # noqa: E402
from backend.cml_service import cml_service  # noqa: E402
from backend.room_labs import ROOMS, ConsoleBridge, node_spec, room_manager, room_spec  # noqa: E402
from backend.netagent_verifier import MISSION_SPECS, verify_mission  # noqa: E402
from backend.topology_agent import generate_mission_topology  # noqa: E402
from backend.models import (  # noqa: E402
    AiInteractRequest,
    CableRequest,
    MissionGenerateRequest,
    MissionVerifyRequest,
    PatchRequest,
    RoomSyncRequest,
    SocSinkholeRequest,
    TerminalCommandRequest,
)

app = FastAPI(title="Cisco Cyber Office - M4 Orchestrator", version="0.5.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BLOCKED_HOSTS_FILE = Path(__file__).parent / "blocked.hosts"

# In-memory session telemetry injected into AI prompts so NPCs know what the player did.
SESSION_TELEMETRY: Dict[str, Any] = {
    "patched_ports": {},
    "commands": [],
    "blocked_domains": [],
}


@app.get("/api/health")
async def health() -> Dict[str, Any]:
    """Return live connectivity status for CML and Ollama plus session counters."""
    cml_status = await cml_service.get_status()
    ai_status = await ai_service.get_status()
    return {
        "ok": True,
        "cml": cml_status,
        "ollama": ai_status,
        "rooms": {"active": room_manager.active_room, "status": room_manager.status},
        "telemetry": {
            "patched_count": len(SESSION_TELEMETRY["patched_ports"]),
            "commands_count": len(SESSION_TELEMETRY["commands"]),
            "blocked_count": len(SESSION_TELEMETRY["blocked_domains"]),
        },
    }


@app.post("/api/cml/bootstrap-demo")
async def bootstrap_demo() -> Dict[str, Any]:
    """Accende la rete della stanza attiva (o dell'ufficio). Non crea piu' lab di prova fuori dalle stanze."""
    room = room_manager.active_room or "office"
    st = room_manager.activate(room)
    return {"mode": "live_cml", "room_id": room, "lab_title": room_spec(room)["lab_title"], "status": st,
            "created": False, "latency_ms": 0}


@app.post("/api/cml/room-sync")
async def room_sync(req: RoomSyncRequest) -> Dict[str, Any]:
    """Non bloccante: salva, spegne gli altri lab (stop, non wipe) e accende quello della stanza."""
    try:
        st = room_manager.activate(req.room_id)
    except KeyError as exc:
        raise HTTPException(404, str(exc))
    return {"mode": "live_cml", "room_id": req.room_id, "lab_title": room_spec(req.room_id)["lab_title"],
            "status": st, "latency_ms": 0}


@app.get("/api/rooms")
async def list_rooms() -> Dict[str, Any]:
    return {"active": room_manager.active_room,
            "rooms": [{"room_id": r, "lab_title": s["lab_title"], "description": s.get("description", ""),
                       "nodes": [n["label"] for n in s["nodes"]]} for r, s in ROOMS.items()]}


@app.post("/api/rooms/provision")
async def provision_rooms(force: bool = False) -> Dict[str, Any]:
    """Crea (o ricrea, se il file YAML e' cambiato) i lab di tutte le stanze. Non li accende."""
    return {"labs": await room_manager.provision_all(force)}


@app.get("/api/room/{room_id}/status")
async def room_status(room_id: str) -> Dict[str, Any]:
    if room_id not in ROOMS:
        raise HTTPException(404, "stanza sconosciuta")
    return room_manager.status[room_id]


@app.get("/api/room/{room_id}/topology")
async def room_topology(room_id: str) -> Dict[str, Any]:
    if room_id not in ROOMS:
        raise HTTPException(404, "stanza sconosciuta")
    return await room_manager.topology(room_id)


@app.post("/api/room/{room_id}/cable")
async def room_cable(room_id: str, req: CableRequest) -> Dict[str, Any]:
    """Stacca, ricollega o sposta un cavo: la modifica avviene sul lab CML della stanza."""
    if room_id not in ROOMS:
        raise HTTPException(404, "stanza sconosciuta")
    SESSION_TELEMETRY["patched_ports"][f"{req.node}:{req.iface}"] = req.action != "unplug"
    try:
        return await room_manager.cable(room_id, req.action, req.node, req.iface, req.to_node, req.to_iface)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(400, str(exc))


@app.websocket("/api/console/{room_id}/{node}")
async def console_ws(ws: WebSocket, room_id: str, node: str) -> None:
    """Console vera del nodo CML (termserv) dentro il browser. Testo in ingresso = tasti;
    JSON {"type":"resize","cols":..,"rows":..} = ridimensionamento."""
    await ws.accept()
    ns = node_spec(room_id, node) if room_id in ROOMS else None
    if not ns:
        await ws.send_text(f"\r\n[dispositivo {node} non presente nella stanza {room_id}]\r\n")
        await ws.close(code=4404)
        return
    if room_manager.status[room_id]["phase"] != "ready":
        st = room_manager.status[room_id]
        await ws.send_text(f"\r\n[la rete della stanza non e' ancora accesa: {st['message'] or st['phase']}]\r\n")
        await ws.close(code=4409)
        return
    bridge = ConsoleBridge(room_spec(room_id)["lab_title"], node, ns["cml_def"], asyncio.get_running_loop())
    try:
        await asyncio.to_thread(bridge.open)
    except Exception as exc:
        await ws.send_text(f"\r\n[{exc}]\r\n")
        await ws.close(code=4500)
        return

    async def to_browser() -> None:
        while True:
            data = await bridge.queue.get()
            if data is None:
                break
            await ws.send_bytes(data)

    async def from_browser() -> None:
        while True:
            msg = await ws.receive()
            if msg["type"] == "websocket.disconnect":
                break
            text = msg.get("text")
            if text is None and msg.get("bytes") is not None:
                text = msg["bytes"].decode(errors="ignore")
            if not text:
                continue
            if text.startswith("{") and '"resize"' in text:
                try:
                    d = json.loads(text)
                    bridge.resize(int(d["cols"]), int(d["rows"]))
                    continue
                except Exception:
                    pass
            bridge.send(text)

    tasks = [asyncio.create_task(to_browser()), asyncio.create_task(from_browser())]
    try:
        await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
    except WebSocketDisconnect:
        pass
    finally:
        for t in tasks:
            t.cancel()
        bridge.close()
        try:
            await ws.close()
        except Exception:
            pass


LEGACY_RACK_PORTS = {"sw-g1": "Ethernet0/0", "sw-1": "Ethernet0/1", "sw-2": "Ethernet0/2", "sw-3": "Ethernet0/3"}


@app.post("/api/rack/patch")
async def rack_patch(req: PatchRequest) -> Dict[str, Any]:
    """Vecchio minigioco del rack: la porta viene mappata sul primo switch della stanza attiva."""
    SESSION_TELEMETRY["patched_ports"][req.port_id] = req.connected
    room = room_manager.active_room
    iface = LEGACY_RACK_PORTS.get(req.port_id, req.port_id)
    sw = next((n["label"] for n in room_spec(room)["nodes"] if n["kind"] == "switch"), None) if room else None
    if not sw:
        return {"mode": "fallback_sim", "port_id": req.port_id, "cable_id": req.cable_id, "up": req.connected,
                "detail": "nessuna stanza attiva"}
    try:
        await room_manager.cable(room, "plug" if req.connected else "unplug", sw, iface)
        mode = "live_cml"
    except Exception as exc:  # porta senza cavo nel lab: il minigioco continua in simulazione
        return {"mode": "fallback_sim", "port_id": req.port_id, "cable_id": req.cable_id, "up": req.connected,
                "node": sw, "interface": iface, "detail": str(exc)}
    return {"mode": mode, "port_id": req.port_id, "cable_id": req.cable_id, "up": req.connected,
            "node": sw, "interface": iface}


@app.post("/api/terminal/command")
async def terminal_command(req: TerminalCommandRequest) -> Dict[str, Any]:
    """Esegue un comando sulla console vera del nodo (stanza attiva) e restituisce l'output completo."""
    SESSION_TELEMETRY["commands"].append({"node": req.node, "command": req.command})
    SESSION_TELEMETRY["commands"] = SESSION_TELEMETRY["commands"][-30:]
    import time as _t
    t0 = _t.perf_counter()
    try:
        out = await room_manager.exec_command(req.node, req.command)
        return {"source": "live_cml", "node": req.node, "command": req.command, "output": out,
                "latency_ms": round((_t.perf_counter() - t0) * 1000, 1)}
    except Exception as exc:
        return {"source": "fallback_sim", "node": req.node, "command": req.command,
                "output": f"[SIM] {req.node}# {req.command}", "detail": str(exc),
                "latency_ms": round((_t.perf_counter() - t0) * 1000, 1)}


@app.post("/api/soc/sinkhole")
async def soc_sinkhole(req: SocSinkholeRequest) -> Dict[str, Any]:
    """Update the local DNS sinkhole blocklist (`backend/blocked.hosts`) and telemetry."""
    domain = req.domain.strip().lower()
    blocked: List[str] = SESSION_TELEMETRY["blocked_domains"]
    if req.action == "block" and domain and domain not in blocked:
        blocked.append(domain)
        with BLOCKED_HOSTS_FILE.open("a", encoding="utf-8") as fh:
            fh.write(f"0.0.0.0 {domain}\n")
    elif req.action == "unblock" and domain in blocked:
        blocked.remove(domain)
    return {
        "ok": True,
        "domain": domain,
        "action": req.action,
        "blocked_domains": blocked,
        "hosts_file": str(BLOCKED_HOSTS_FILE.name),
    }


@app.post("/api/ai/interact")
async def ai_interact(req: AiInteractRequest) -> Dict[str, Any]:
    """Generate live NPC dialogue or structured Socratic hints using cached infra state."""
    infra_state = {
        "cml_lab_synced": cml_service._lab_id is not None,
        "patched_ports": SESSION_TELEMETRY["patched_ports"],
        "recent_commands": SESSION_TELEMETRY["commands"][-5:],
        "blocked_domains": SESSION_TELEMETRY["blocked_domains"],
    }
    if req.mode == "hint":
        return await ai_service.ask_mentor_hint(req.minigame, req.context, infra_state)
    return await ai_service.ask_npc(req.npc_id, req.prompt, infra_state)


@app.get("/api/mission/specs")
async def list_mission_specs() -> Dict[str, Any]:
    """List all registered mission specs (built-in + LLM-generated)."""
    return {
        "missions": [
            {
                "mission_id": mid,
                "title": spec.get("title", mid),
                "osi_layer": spec.get("osi_layer", "Layer 1-7"),
            }
            for mid, spec in MISSION_SPECS.items()
        ]
    }


@app.post("/api/mission/verify")
async def mission_verify(req: MissionVerifyRequest) -> Dict[str, Any]:
    """Verify player-produced config/state against ideal netAgent mission spec."""
    merged_state = {
        "patched_ports": SESSION_TELEMETRY["patched_ports"],
        "blocked_domains": SESSION_TELEMETRY["blocked_domains"],
        **req.player_state,
    }
    commands = req.player_commands or [c["command"] for c in SESSION_TELEMETRY["commands"]]
    return verify_mission(req.mission_id, commands, merged_state)


@app.post("/api/mission/generate")
async def mission_generate(req: MissionGenerateRequest) -> Dict[str, Any]:
    """Generate a new mission topology + configs from prompt via Ollama & netAgent, then deploy to CML."""
    res = await generate_mission_topology(req.prompt, deploy_to_cml=req.deploy_to_cml)
    if req.deploy_to_cml:  # il deploy spegne i lab delle stanze: lo stato va riallineato
        room_manager.active_room = None
        room_manager._wanted = None
        for st in room_manager.status.values():
            st.update({"phase": "idle", "message": "spenta da una missione generata", "ready_nodes": 0})
    return res
