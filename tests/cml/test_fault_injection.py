"""
Unit tests for Fault Injection Engine (C3).
Validates:
- Injection of vlan_mismatch
- Injection of interface_shutdown
- Injection of missing_static_route
- Injection of trunk_vlan_exclusion
- Random fault injection
- Error handling for invalid fault types and unknown rooms
- POST /api/room/{room_id}/inject-fault API endpoint
"""

from fastapi.testclient import TestClient
import pytest

from backend.fault_injection import (
    SUPPORTED_FAULTS,
    clear_active_faults,
    get_active_faults,
    get_fault_plan,
    inject_fault,
)
from backend.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_faults():
    clear_active_faults()
    yield
    clear_active_faults()


def test_supported_fault_plans():
    for f in SUPPORTED_FAULTS:
        plan = get_fault_plan("office", f)
        assert "node" in plan
        assert "commands" in plan
        assert len(plan["commands"]) > 0
        assert "description" in plan


@pytest.mark.asyncio
async def test_inject_vlan_mismatch():
    res = await inject_fault("office", "vlan_mismatch")
    assert res["status"] == "injected"
    assert res["fault"] == "vlan_mismatch"
    assert "node" in res
    assert any("vlan 999" in cmd for cmd in res["commands"])
    assert len(get_active_faults("office")) == 1


@pytest.mark.asyncio
async def test_inject_interface_shutdown():
    res = await inject_fault("office", "interface_shutdown")
    assert res["status"] == "injected"
    assert res["fault"] == "interface_shutdown"
    assert any("shutdown" in cmd for cmd in res["commands"])


@pytest.mark.asyncio
async def test_inject_missing_static_route():
    res = await inject_fault("office", "missing_static_route")
    assert res["status"] == "injected"
    assert res["fault"] == "missing_static_route"


@pytest.mark.asyncio
async def test_inject_trunk_vlan_exclusion():
    res = await inject_fault("office", "trunk_vlan_exclusion")
    assert res["status"] == "injected"
    assert res["fault"] == "trunk_vlan_exclusion"
    assert any("remove" in cmd for cmd in res["commands"])


@pytest.mark.asyncio
async def test_inject_random_fault():
    res = await inject_fault("office", "random")
    assert res["status"] == "injected"
    assert res["fault"] in SUPPORTED_FAULTS


@pytest.mark.asyncio
async def test_invalid_fault_and_room_raise():
    with pytest.raises(ValueError):
        await inject_fault("office", "non_existent_fault")

    with pytest.raises(KeyError):
        await inject_fault("non_existent_room", "vlan_mismatch")


def test_api_inject_fault_endpoint():
    resp = client.post("/api/room/office/inject-fault", json={"fault_type": "interface_shutdown"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "injected"
    assert data["fault"] == "interface_shutdown"
    assert data["room_id"] == "office"
    assert "node" in data

    # Test random injection via empty payload
    resp_rnd = client.post("/api/room/office/inject-fault", json={})
    assert resp_rnd.status_code == 200
    assert resp_rnd.json()["fault"] in SUPPORTED_FAULTS

    # Test 400 on invalid fault
    resp_bad = client.post("/api/room/office/inject-fault", json={"fault_type": "invalid_xyz"})
    assert resp_bad.status_code == 400

    # Test 404 on unknown room
    resp_404 = client.post("/api/room/unknown_room/inject-fault", json={})
    assert resp_404.status_code == 404
