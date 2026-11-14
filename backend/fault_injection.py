"""
Fault Injection Engine for Cisco CML Labs (C3).

Simulates or injects live real-world network faults during testing/collaudo:
- vlan_mismatch: Sets incorrect access VLAN on an edge port
- interface_shutdown: Shuts down a critical trunk or access interface
- missing_static_route: Removes default gateway or static route
- trunk_vlan_exclusion: Excludes critical operational VLANs from trunk link
"""

import random
from typing import Any, Dict, List, Optional
from loguru import logger

from backend.room_labs import ROOMS, node_spec, room_manager, room_spec

SUPPORTED_FAULTS = [
    "vlan_mismatch",
    "interface_shutdown",
    "missing_static_route",
    "trunk_vlan_exclusion",
]

# Track injected faults in memory: room_id -> list of fault records
ACTIVE_FAULTS: Dict[str, List[Dict[str, Any]]] = {}


def get_fault_plan(room_id: str, fault_type: str) -> Dict[str, Any]:
    """Generates the targeted node, commands and description for a specific fault in a room."""
    spec = room_spec(room_id)
    nodes = spec.get("nodes", [])

    sw_node = next((n["label"] for n in nodes if n.get("kind") == "switch"), "SW-PIANO1")
    rtr_node = next((n["label"] for n in nodes if n.get("kind") == "router"), "RTR-UFFICIO")

    if fault_type == "vlan_mismatch":
        return {
            "node": sw_node,
            "commands": [
                "configure terminal",
                "interface Ethernet0/1",
                "switchport access vlan 999",
                "end",
            ],
            "description": f"VLAN mismatch iniettata su {sw_node} Et0/1: spostata su VLAN 999 non instradata",
        }
    elif fault_type == "interface_shutdown":
        return {
            "node": sw_node,
            "commands": [
                "configure terminal",
                "interface Ethernet0/0",
                "shutdown",
                "end",
            ],
            "description": f"Disattivazione interfaccia iniettata: {sw_node} Et0/0 posta in shutdown",
        }
    elif fault_type == "missing_static_route":
        # Check if room has switch with default-gateway or router
        return {
            "node": sw_node,
            "commands": [
                "configure terminal",
                "no ip default-gateway 10.10.99.1",
                "end",
            ],
            "description": f"Rimozione rotta/default-gateway su {sw_node}",
        }
    elif fault_type == "trunk_vlan_exclusion":
        return {
            "node": sw_node,
            "commands": [
                "configure terminal",
                "interface Ethernet0/0",
                "switchport trunk allowed vlan remove 10,20",
                "end",
            ],
            "description": f"Trunk VLAN exclusion iniettata: VLAN 10 e 20 escluse dal trunk di {sw_node} Et0/0",
        }
    else:
        raise ValueError(f"Tipo di guasto '{fault_type}' non supportato. Validi: {SUPPORTED_FAULTS}")


async def inject_fault(room_id: str, fault_type: Optional[str] = None) -> Dict[str, Any]:
    """
    Injects a network fault into the target room.
    If fault_type is not provided or 'random', selects randomly from supported faults.
    Executes commands on live CML if the lab is ready, or tracks in simulation.
    """
    if room_id not in ROOMS:
        raise KeyError(f"Stanza sconosciuta: '{room_id}'")

    if not fault_type or fault_type == "random":
        fault_type = random.choice(SUPPORTED_FAULTS)
    elif fault_type not in SUPPORTED_FAULTS:
        raise ValueError(f"Tipo di guasto '{fault_type}' sconosciuto. Validi: {SUPPORTED_FAULTS}")

    plan = get_fault_plan(room_id, fault_type)
    target_node = plan["node"]
    cmds = plan["commands"]

    execution_mode = "simulated"
    st = room_manager.status.get(room_id, {})
    if st.get("phase") == "ready":
        try:
            for cmd in cmds:
                await room_manager.exec_command(target_node, cmd, room_id=room_id)
            execution_mode = "live_cml"
        except Exception as exc:
            logger.warning(f"Fault injection fallback to simulated for {room_id}: {exc}")
            execution_mode = "fallback_sim"

    fault_record = {
        "status": "injected",
        "fault": fault_type,
        "fault_type": fault_type,
        "room_id": room_id,
        "node": target_node,
        "mode": execution_mode,
        "commands": cmds,
        "description": plan["description"],
    }
    ACTIVE_FAULTS.setdefault(room_id, []).append(fault_record)
    return fault_record


def get_active_faults(room_id: str) -> List[Dict[str, Any]]:
    return ACTIVE_FAULTS.get(room_id, [])


def clear_active_faults(room_id: Optional[str] = None) -> None:
    if room_id:
        ACTIVE_FAULTS.pop(room_id, None)
    else:
        ACTIVE_FAULTS.clear()
