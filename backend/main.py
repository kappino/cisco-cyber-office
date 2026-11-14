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
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load backend/.env before importing services that read os.getenv() at module import time.
load_dotenv(Path(__file__).parent / ".env")

from backend.ai_service import ai_service  # noqa: E402
from backend.cml_service import cml_service  # noqa: E402
from backend.netagent_verifier import MISSION_SPECS, verify_mission  # noqa: E402
from backend.topology_agent import generate_mission_topology  # noqa: E402
from backend.models import (  # noqa: E402
    AiInteractRequest,
    MissionGenerateRequest,
    MissionVerifyRequest,
    PatchRequest,
    RoomSyncRequest,
    SocSinkholeRequest,
    TerminalCommandRequest,
)

app = FastAPI(title="Cisco Cyber Office - M4 Orchestrator", version="0.4.0")

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
        "telemetry": {
            "patched_count": len(SESSION_TELEMETRY["patched_ports"]),
            "commands_count": len(SESSION_TELEMETRY["commands"]),
            "blocked_count": len(SESSION_TELEMETRY["blocked_domains"]),
        },
    }


@app.post("/api/cml/bootstrap-demo")
async def bootstrap_demo() -> Dict[str, Any]:
    """Ensure the FuoriRete_Office demo lab exists and is started on CML."""
    return await cml_service.ensure_demo_lab()


@app.post("/api/cml/room-sync")
async def room_sync(req: RoomSyncRequest) -> Dict[str, Any]:
    """Stop other room labs and activate the CML lab matching the player's current room."""
    return await cml_service.sync_room_lab(req.room_id)


@app.post("/api/rack/patch")
async def rack_patch(req: PatchRequest) -> Dict[str, Any]:
    """Handle physical cabling events from PatchRackGame and toggle CML node/port state."""
    SESSION_TELEMETRY["patched_ports"][req.port_id] = req.connected
    res = await cml_service.toggle_interface("SW-CORE-01", req.port_id, req.connected)
    return {**res, "port_id": req.port_id, "cable_id": req.cable_id}


@app.post("/api/terminal/command")
async def terminal_command(req: TerminalCommandRequest) -> Dict[str, Any]:
    """Record IOS CLI commands and query/execute against the live CML lab."""
    SESSION_TELEMETRY["commands"].append({"node": req.node, "command": req.command})
    SESSION_TELEMETRY["commands"] = SESSION_TELEMETRY["commands"][-30:]
    return await cml_service.exec_ios_command(req.node, req.command)


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
    return await generate_mission_topology(req.prompt, deploy_to_cml=req.deploy_to_cml)
