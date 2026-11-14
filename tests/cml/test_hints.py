"""
Unit tests for 3-Level Diff Hints (B1) and Mentor IA integration (C6).
Validates:
- generate_hints Level 1 (Device / High-level)
- generate_hints Level 2 (Section / Scope)
- generate_hints Level 3 (Exact command)
- Device filter in generate_hints
- GET /api/room/{room_id}/hint endpoint
- Aligned personas (alessia, davide, luca, gaia) and diff grounding in ai_service
- POST /api/ai/interact route
"""

from fastapi.testclient import TestClient
import pytest

from backend.ai_service import FALLBACK_NPC, NPC_PERSONAS, ai_service
from backend.config_diff import generate_hints
from backend.main import app

client = TestClient(app)


SAMPLE_DIFF = {
    "devices": [
        {
            "label": "SW-PIANO1",
            "diff": {
                "missing": [
                    {"section": "interface Ethernet0/1", "line": "switchport access vlan 10"},
                    {"section": "", "line": "vlan 10"},
                ],
                "extra": [
                    {"section": "interface Ethernet0/0", "line": "shutdown"},
                    {"section": "interface Ethernet0/2", "line": "switchport access vlan 99"},
                ],
            },
        },
        {
            "label": "RTR-UFFICIO",
            "diff": {
                "missing": [
                    {"section": "ip dhcp pool MARKETING", "line": "network 10.10.10.0 255.255.255.0"}
                ],
                "extra": [],
            },
        },
    ]
}


def test_generate_hints_level_1():
    hints = generate_hints(SAMPLE_DIFF, level=1)
    assert len(hints) == 2

    sw_hint = next(h for h in hints if h["device"] == "SW-PIANO1")
    assert sw_hint["level"] == 1
    assert "SW-PIANO1" in sw_hint["hint"]
    assert "interfacce di rete" in sw_hint["hint"] or "VLAN" in sw_hint["hint"]

    rtr_hint = next(h for h in hints if h["device"] == "RTR-UFFICIO")
    assert rtr_hint["level"] == 1
    assert "DHCP" in rtr_hint["hint"]


def test_generate_hints_level_2():
    hints = generate_hints(SAMPLE_DIFF, level=2)
    # Check that sections are identified
    sw_sections = [h.get("section") for h in hints if h["device"] == "SW-PIANO1"]
    assert "interface Ethernet0/1" in sw_sections
    assert "interface Ethernet0/0" in sw_sections
    assert "global" in sw_sections

    for h in hints:
        assert h["level"] == 2
        assert "discrepanze" in h["hint"].lower() or "impostazioni" in h["hint"].lower()


def test_generate_hints_level_3():
    hints = generate_hints(SAMPLE_DIFF, level=3)
    sw_hints = [h for h in hints if h["device"] == "SW-PIANO1"]

    # Missing line in section -> enters section and executes command
    missing_cmd = next(h for h in sw_hints if "switchport access vlan 10" in h.get("command", ""))
    assert "configure terminal" in missing_cmd["command"]
    assert "interface Ethernet0/1" in missing_cmd["command"]
    assert "switchport access vlan 10" in missing_cmd["command"]

    # Extra shutdown -> no shutdown
    shut_cmd = next(h for h in sw_hints if "shutdown" in h.get("command", ""))
    assert "no shutdown" in shut_cmd["command"]


def test_generate_hints_device_filter():
    rtr_only = generate_hints(SAMPLE_DIFF, level=1, device_filter="RTR-UFFICIO")
    assert len(rtr_only) == 1
    assert rtr_only[0]["device"] == "RTR-UFFICIO"


def test_api_room_hint_endpoint():
    resp = client.get("/api/room/office/hint?level=1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["room_id"] == "office"
    assert data["level"] == 1
    assert isinstance(data["hints"], list)

    resp_invalid_level = client.get("/api/room/office/hint?level=99")
    assert resp_invalid_level.status_code == 400

    resp_unknown_room = client.get("/api/room/unknown_room/hint?level=1")
    assert resp_unknown_room.status_code == 404


@pytest.mark.asyncio
async def test_ai_service_aligned_personas_and_grounding():
    # Verify all 4 aligned personas exist
    for p in ("alessia", "davide", "luca", "gaia"):
        assert p in NPC_PERSONAS
        assert p in FALLBACK_NPC

    # Test grounding with diff hints in ask_npc fallback
    infra_state = {"diff": SAMPLE_DIFF}
    res_luca = await ai_service.ask_npc("luca", "Cosa c'e' che non va nello switch?", infra_state)
    assert res_luca["npc_id"] == "luca"
    assert res_luca["reply"] is not None

    res_gaia = await ai_service.ask_npc("gaia", "La rete e' pronta per il collaudo?", infra_state)
    assert res_gaia["npc_id"] == "gaia"
    assert res_gaia["reply"] is not None


def test_api_ai_interact_endpoint():
    payload = {
        "mode": "npc",
        "npc_id": "gaia",
        "prompt": "Stato collaudo?",
    }
    resp = client.post("/api/ai/interact", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["npc_id"] == "gaia"
    assert "reply" in data
