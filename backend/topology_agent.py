"""LLM + netAgent Topology & Mission Architect.

Generates Cisco CML topologies (iol-xe, ioll2-xe, alpine) and both ideal
and faulty IOS configurations from a natural-language prompt using local
Ollama (gemma4:12b), then registers the mission in netAgent Verifier and
optionally instantiates it on Cisco Modeling Labs.
"""

from __future__ import annotations

import os
import re
import time
from pathlib import Path
from typing import Any, Dict, List
import yaml

from backend.cml_service import cml_service
from backend.netagent_verifier import register_mission_spec

MISSIONS_DIR = Path(__file__).parent / "missions"

_SYSTEM_PROMPT = """Sei un Senior Cisco Network Architect e creatore di lab per Cisco Modeling Labs (CML).
Dato un prompt utente, genera SOLO JSON valido con questa struttura esatta:
{
  "mission_id": "slug_breve_senza_spazi",
  "mission_title": "Titolo breve della missione",
  "description": "Descrizione del guasto da risolvere in italiano (max 2 frasi)",
  "osi_layer": "Layer 2/3",
  "nodes": [
    {
      "label": "SW-CORE-01",
      "role": "switch",
      "cml_def": "ioll2-xe",
      "x": -150,
      "y": 0,
      "ideal_config": ["interface GigabitEthernet0/1", " switchport mode trunk", " no shutdown"],
      "faulty_config": ["interface GigabitEthernet0/1", " switchport mode trunk", " shutdown"]
    }
  ],
  "links": [
    {"src_node": "SW-CORE-01", "dst_node": "RTR-EDGE-01"}
  ],
  "rules": [
    {
      "id": "r1",
      "iface": "GigabitEthernet0/1",
      "child_regex": "no\\\\s+shut(down)?",
      "label": "Gi0/1 attiva (no shutdown)",
      "fix_cmd": "interface GigabitEthernet0/1 -> no shutdown"
    }
  ]
}
Usa SOLO cml_def tra: "ioll2-xe", "iol-xe", "alpine". Max 4 nodi."""


def _fallback_spec(prompt: str) -> Dict[str, Any]:
    """Deterministic netAgent-compatible mission spec when Ollama is unavailable."""
    slug = re.sub(r"[^a-z0-9]+", "_", prompt.lower()).strip("_")[:24] or "custom_roas"
    return {
        "mission_id": slug,
        "mission_title": "Missione Custom: Router-on-a-Stick & Trunk",
        "description": f"Topologia generata per: {prompt[:100]}. Ripristina il trunk Gi0/1 e la VLAN 20.",
        "osi_layer": "Layer 2/3",
        "nodes": [
            {
                "label": "SW-CORE-01",
                "role": "switch",
                "cml_def": "ioll2-xe",
                "x": -150,
                "y": 0,
                "ideal_config": [
                    "vlan 10,20",
                    "interface GigabitEthernet0/1",
                    " switchport trunk encapsulation dot1q",
                    " switchport mode trunk",
                    " no shutdown",
                ],
                "faulty_config": [
                    "vlan 10,20",
                    "interface GigabitEthernet0/1",
                    " switchport trunk encapsulation dot1q",
                    " switchport mode trunk",
                    " no shutdown",
                ],
            },
            {
                "label": "RTR-EDGE-01",
                "role": "router",
                "cml_def": "iol-xe",
                "x": 150,
                "y": 0,
                "ideal_config": [
                    "interface GigabitEthernet0/0.10",
                    " encapsulation dot1Q 10",
                    " ip address 192.168.10.1 255.255.255.0",
                    "interface GigabitEthernet0/0.20",
                    " encapsulation dot1Q 20",
                    " ip address 192.168.20.1 255.255.255.0",
                ],
                "faulty_config": [
                    "interface GigabitEthernet0/0",
                    " no shutdown",
                    "interface GigabitEthernet0/0.10",
                    " encapsulation dot1Q 10",
                    " ip address 192.168.10.1 255.255.255.0",
                ],
            },
            {
                "label": "HOST-VLAN10",
                "role": "host",
                "cml_def": "alpine",
                "x": -220,
                "y": 140,
                "ideal_config": [],
                "faulty_config": [],
            },
            {
                "label": "HOST-VLAN20",
                "role": "host",
                "cml_def": "alpine",
                "x": -60,
                "y": 140,
                "ideal_config": [],
                "faulty_config": [],
            },
        ],
        "links": [
            {"src_node": "SW-CORE-01", "dst_node": "RTR-EDGE-01"},
            {"src_node": "SW-CORE-01", "dst_node": "HOST-VLAN10"},
            {"src_node": "SW-CORE-01", "dst_node": "HOST-VLAN20"},
        ],
        "rules": [
            {
                "id": "trunk_up",
                "iface": "GigabitEthernet0/1",
                "child_regex": r"no\s+shut(down)?",
                "label": "Trunk Gi0/1 UP (no shutdown)",
                "fix_cmd": "interface GigabitEthernet0/1 -> no shutdown",
            },
            {
                "id": "trunk_mode",
                "iface": "GigabitEthernet0/1",
                "child_regex": r"switchport\s+mode\s+trunk",
                "label": "Gi0/1 configurata in mode trunk",
                "fix_cmd": "interface GigabitEthernet0/1 -> switchport mode trunk",
            },
        ],
    }


async def generate_mission_topology(prompt: str, deploy_to_cml: bool = True) -> Dict[str, Any]:
    """Load the deterministic YAML mission spec (netAgent format) and optionally deploy to CML."""
    t0 = time.perf_counter()
    yaml_path = MISSIONS_DIR / "roas_2vlan.yaml"
    if yaml_path.exists():
        with yaml_path.open("r", encoding="utf-8") as fh:
            spec = yaml.safe_load(fh)
        source = "yaml_spec"
    else:
        spec = _fallback_spec(prompt)
        source = "fallback_sim"

    mission_id = re.sub(r"[^a-z0-9_]+", "_", str(spec.get("mission_id", "custom")).lower()).strip("_") or "custom"
    spec["mission_id"] = mission_id

    # Collect flattened ideal_config lines across nodes for netAgent verification
    ideal_lines: List[str] = []
    for n in spec.get("nodes", []):
        ideal_lines.extend(n.get("ideal_config", []))

    register_mission_spec(
        mission_id,
        {
            "title": spec.get("mission_title", mission_id),
            "osi_layer": spec.get("osi_layer", "Layer 2/3"),
            "ideal_config": ideal_lines,
            "rules": spec.get("rules", []),
        },
    )

    cml_deploy = None
    if deploy_to_cml:
        cml_deploy = await cml_service.deploy_custom_topology(spec)

    latency = round((time.perf_counter() - t0) * 1000, 1)
    return {
        "source": source,
        "spec": spec,
        "cml_deploy": cml_deploy,
        "latency_ms": latency,
    }
