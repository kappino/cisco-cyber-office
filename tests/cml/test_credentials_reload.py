"""Offline unit and integration tests for IOS Password Support (A11) and Autosave & Reload (A3).

Verifies:
- Credentials parsing in room specs and per-node overrides
- _ios_auth handshake state machine (user EXEC, priv EXEC, console pwd, enable secret, local auth)
- Fast failure via IOSAuthError on bad passwords, repeated prompts, or missing credentials
- IOSAuthError handling in verify() and ports() without 20s timeouts
- Autosave suppression when autosave: false
- RoomManager.reload for single node or entire room without calling /wipe
- FastAPI route POST /api/room/{room_id}/reload
"""
from __future__ import annotations

import asyncio
import inspect
import time
from typing import Any, Dict, List, Optional, Tuple
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
from starlette.testclient import TestClient

from backend.main import app
from backend.room_labs import (
    IOSAuthError,
    ROOMS,
    _credentials_for,
    _ios_auth,
    _save_ios_config,
    room_manager,
    room_spec,
)


class MockChannel:
    """Mock di paramiko.Channel per simulare risposte IOS su console seriale."""

    def __init__(self, script: List[Tuple[Optional[str], str]]) -> None:
        self.script = script
        self.sent: List[str] = []
        self.buffer = b""
        self.step = 0
        if self.script and self.script[0][0] is None:
            self.buffer += self.script[0][1].encode("utf-8")
            self.step += 1

    def send(self, data: str) -> int:
        self.sent.append(data)
        if self.step < len(self.script):
            pattern, resp = self.script[self.step]
            if pattern is None or pattern in data:
                self.buffer += resp.encode("utf-8")
                self.step += 1
        return len(data)

    def recv(self, n: int = 65535) -> bytes:
        data = self.buffer[:n]
        self.buffer = self.buffer[n:]
        return data


# ---------------------------------------------------------------------------
# 1. Credentials resolution tests
# ---------------------------------------------------------------------------
def test_credentials_for_resolution():
    with patch.dict(ROOMS, {
        "test_room": {
            "lab_title": "lab_test_title",
            "credentials": {"enable": "Secret123", "console": "ConPass123"},
            "nodes": [
                {"label": "SW-1"},
                {"label": "SW-2", "credentials": {"enable": "SecretSW2", "console": "ConSW2"}},
            ],
        }
    }):
        # Room-level credentials resolved for SW-1
        c1 = _credentials_for("lab_test_title", "SW-1")
        assert c1 == {"enable": "Secret123", "console": "ConPass123"}

        # Node-level credentials override resolved for SW-2
        c2 = _credentials_for("lab_test_title", "SW-2")
        assert c2 == {"enable": "SecretSW2", "console": "ConSW2"}

        # Unknown lab returns empty dict
        c_unknown = _credentials_for("lab_non_esiste", "SW-1")
        assert c_unknown == {}


def test_credentials_for_none_handling():
    with patch.dict(ROOMS, {
        "room_none": {
            "lab_title": "lab_none_title",
            "credentials": None,
            "nodes": [
                {"label": "SW-1", "credentials": None},
                {"label": "SW-2", "credentials": {"enable": "Secret2"}},
            ],
        }
    }):
        # spec.credentials is None -> should not raise TypeError
        c1 = _credentials_for("lab_none_title", "SW-1")
        assert c1 == {}

        # node has credentials, spec has None -> should not raise TypeError
        c2 = _credentials_for("lab_none_title", "SW-2")
        assert c2 == {"enable": "Secret2"}


# ---------------------------------------------------------------------------
# 2. IOS Authentication Handshake Tests (A11)
# ---------------------------------------------------------------------------
def test_ios_auth_already_at_priv_exec():
    # Prompt is already Switch#
    chan = MockChannel([("\r", "\r\nSwitch#")])
    out = _ios_auth(chan, creds={}, timeout=2.0)  # type: ignore
    assert "Switch#" in out
    assert chan.sent == ["\r"]


def test_ios_auth_user_exec_to_priv_exec_no_password():
    # Prompt starts at Switch>, enable brings it directly to Switch#
    chan = MockChannel([
        ("\r", "\r\nSwitch>"),
        ("enable", "\r\nSwitch#"),
    ])
    out = _ios_auth(chan, creds={}, timeout=2.0)  # type: ignore
    assert "Switch#" in out
    assert "enable\r" in chan.sent


def test_ios_auth_console_password_then_enable_secret():
    # Full handshake: Password: -> ConPass -> Switch> -> enable -> Password: -> EnableSec -> Switch#
    chan = MockChannel([
        ("\r", "\r\nUser Access Verification\r\nPassword: "),
        ("ConPass", "\r\nSwitch>"),
        ("enable", "\r\nPassword: "),
        ("EnableSec", "\r\nSwitch#"),
    ])
    creds = {"console": "ConPass", "enable": "EnableSec"}
    out = _ios_auth(chan, creds=creds, timeout=2.0)  # type: ignore
    assert "Switch#" in out
    assert "ConPass\r" in chan.sent
    assert "enable\r" in chan.sent
    assert "EnableSec\r" in chan.sent


def test_ios_auth_local_username_and_password():
    # Username: -> admin -> Password: -> AdminPass -> Switch> -> enable -> Switch#
    chan = MockChannel([
        ("\r", "\r\nUser Access Verification\r\nUsername: "),
        ("admin", "\r\nPassword: "),
        ("AdminPass", "\r\nSwitch>"),
        ("enable", "\r\nSwitch#"),
    ])
    creds = {"username": "admin", "password": "AdminPass"}
    out = _ios_auth(chan, creds=creds, timeout=2.0)  # type: ignore
    assert "Switch#" in out
    assert "admin\r" in chan.sent
    assert "AdminPass\r" in chan.sent


def test_ios_auth_bad_console_password_raises_immediately():
    # Bad console password returns % Bad passwords
    chan = MockChannel([
        ("\r", "\r\nUser Access Verification\r\nPassword: "),
        ("WrongPass", "\r\n% Bad passwords\r\nPassword: "),
    ])
    creds = {"console": "WrongPass"}
    try:
        _ios_auth(chan, creds=creds, timeout=2.0)  # type: ignore
        assert False, "Should have raised IOSAuthError"
    except IOSAuthError as exc:
        assert "accesso negato con le password della scheda" in str(exc)


def test_ios_auth_bad_enable_secret_raises_immediately():
    # Bad enable secret returns % Bad passwords
    chan = MockChannel([
        ("\r", "\r\nSwitch>"),
        ("enable", "\r\nPassword: "),
        ("WrongEnable", "\r\n% Bad passwords\r\nPassword: "),
    ])
    creds = {"enable": "WrongEnable"}
    try:
        _ios_auth(chan, creds=creds, timeout=2.0)  # type: ignore
        assert False, "Should have raised IOSAuthError"
    except IOSAuthError as exc:
        assert "accesso negato con le password della scheda" in str(exc)


def test_ios_auth_missing_credentials_raises_immediately():
    # Prompt asks for Password: but creds dictionary has no password
    chan = MockChannel([("\r", "\r\nUser Access Verification\r\nPassword: ")])
    try:
        _ios_auth(chan, creds={}, timeout=2.0)  # type: ignore
        assert False, "Should have raised IOSAuthError"
    except IOSAuthError as exc:
        assert "accesso negato con le password della scheda" in str(exc)


def test_ios_auth_repeated_password_prompt_raises_immediately():
    # Console asks for Password: again without explicit '% Bad passwords'
    chan = MockChannel([
        ("\r", "\r\nPassword: "),
        ("SomePass", "\r\nPassword: "),
    ])
    creds = {"console": "SomePass"}
    try:
        _ios_auth(chan, creds=creds, timeout=2.0)  # type: ignore
        assert False, "Should have raised IOSAuthError"
    except IOSAuthError as exc:
        assert "accesso negato con le password della scheda" in str(exc)


# ---------------------------------------------------------------------------
# 3. verify() and ports() error handling on IOSAuthError
# ---------------------------------------------------------------------------
async def test_verify_catches_ios_auth_error_and_fails_fast():
    # Mock run_console_commands to raise IOSAuthError
    with patch.dict(room_manager.status, {"office": {"phase": "ready", "message": "Accesa"}}), \
         patch("backend.room_labs.run_console_commands") as mock_cmds:
        mock_cmds.side_effect = IOSAuthError("accesso negato con le password della scheda")
        res = await room_manager.verify("office")
        assert res["ok"] is False
        assert res["summary"] == "accesso negato con le password della scheda"
        # Check that devices report the exact error message
        for dev in res["devices"]:
            assert dev["ok"] is False
            assert dev["error"] == "accesso negato con le password della scheda"


async def test_ports_catches_ios_auth_error():
    with patch.dict(room_manager.status, {"office": {"phase": "ready", "message": "Accesa"}}), \
         patch("backend.room_labs.read_port_leds") as mock_leds:
        mock_leds.side_effect = IOSAuthError("accesso negato con le password della scheda")
        res = await room_manager.ports("office", fresh=True)
        assert res["ready"] is True
        for node_label, node_ports in res["ports"].items():
            assert node_ports["_error"] == "accesso negato con le password della scheda"


# ---------------------------------------------------------------------------
# 4. Autosave & Reload Tests (A3)
# ---------------------------------------------------------------------------
async def test_autosave_suppression_when_flag_false():
    # When spec has autosave: false, save_ios_config must NOT be called in _activate
    with patch.object(room_manager, "provision", new_callable=AsyncMock) as mock_prov, \
         patch.object(room_manager.api, "get", new_callable=AsyncMock) as mock_api_get, \
         patch.object(room_manager.api, "put", new_callable=AsyncMock) as mock_api_put, \
         patch.object(room_manager, "_wait_nodes", new_callable=AsyncMock) as mock_wait, \
         patch("backend.room_labs.asyncio.sleep", new_callable=AsyncMock), \
         patch("backend.room_labs.save_ios_config") as mock_save:

        mock_prov.return_value = "lab_target_lid"
        # Simulate another lab currently running
        mock_api_get.side_effect = lambda path: (
            ["lab_prev_lid"] if path == "/labs" else
            [{"id": "n1", "label": "SW-PREV", "state": "BOOTED", "node_definition": "ioll2-xe"}] if "nodes" in path else
            {"lab_title": "lab_prev_title", "lab_notes": "fr-init-done:xxx"}
        )
        mock_wait.return_value = True

        # Room specs: previous running lab with autosave: false, and target lab with autosave: false
        with patch.dict(ROOMS, {
            "room_prev": {
                "room_id": "room_prev",
                "lab_title": "lab_prev_title",
                "autosave": False,
                "nodes": [{"label": "SW-PREV", "cml_def": "ioll2-xe"}],
                "links": [],
                "hash": "000000",
            },
            "room_no_save": {
                "room_id": "room_no_save",
                "lab_title": "lab_target_title",
                "autosave": False,
                "nodes": [{"label": "SW-1", "cml_def": "ioll2-xe"}],
                "links": [],
                "hash": "123456",
            }
        }):
            room_manager.status["room_no_save"] = {"phase": "queued", "ready_nodes": 0}
            room_manager._wanted = "room_no_save"
            await room_manager._activate("room_no_save")

            # Verify save_ios_config was NOT called (suppressed because room_prev has autosave: false)
            assert mock_save.call_count == 0

            # Verify previous lab was stopped via PUT /labs/lab_prev_lid/stop (Step 3 decoupled from autosave)
            put_calls = [c.args[0] for c in mock_api_put.call_args_list]
            assert "/labs/lab_prev_lid/stop" in put_calls


async def test_room_manager_reload_single_node_no_wipe():
    with patch.object(room_manager, "find_lab", new_callable=AsyncMock) as mock_find, \
         patch.object(room_manager, "_nodes", new_callable=AsyncMock) as mock_nodes, \
         patch.object(room_manager.api, "put", new_callable=AsyncMock) as mock_put, \
         patch("backend.room_labs.asyncio.sleep", new_callable=AsyncMock):

        mock_find.return_value = "lab_office_lid"
        # 3 calls: 1) lookup node, 2) wait for STOPPED, 3) wait for BOOTED
        states = ["BOOTED", "STOPPED", "BOOTED"]
        def fake_nodes(lid):
            curr_state = states.pop(0) if states else "BOOTED"
            return [{"id": "nid_sw1", "label": "SW-PIANO1", "node_definition": "ioll2-xe", "state": curr_state}]
        mock_nodes.side_effect = fake_nodes

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_put.return_value = mock_resp

        # Set cache to verify invalidation
        room_manager._ports_cache["office"] = (time.time(), {"ports": {}})

        res = await room_manager.reload("office", node="SW-PIANO1")
        assert res == {"status": "reloading", "room_id": "office", "node": "SW-PIANO1"}
        assert "office" not in room_manager._ports_cache

        # Check API calls: stop node, then start node. NO /wipe called!
        put_urls = [call.args[0] for call in mock_put.call_args_list]
        assert "/labs/lab_office_lid/nodes/nid_sw1/state/stop" in put_urls
        assert "/labs/lab_office_lid/nodes/nid_sw1/state/start" in put_urls
        for url in put_urls:
            assert "/wipe" not in url


async def test_room_manager_reload_entire_room_no_wipe():
    with patch.object(room_manager, "find_lab", new_callable=AsyncMock) as mock_find, \
         patch.object(room_manager, "_wait_nodes", new_callable=AsyncMock) as mock_wait, \
         patch.object(room_manager.api, "put", new_callable=AsyncMock) as mock_put:

        mock_find.return_value = "lab_office_lid"
        mock_wait.return_value = True

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_put.return_value = mock_resp

        room_manager._ports_cache["office"] = (time.time(), {"ports": {}})

        res = await room_manager.reload("office")
        assert res == {"status": "reloading", "room_id": "office", "node": "all"}
        assert "office" not in room_manager._ports_cache

        put_urls = [call.args[0] for call in mock_put.call_args_list]
        assert "/labs/lab_office_lid/stop" in put_urls
        assert "/labs/lab_office_lid/start" in put_urls
        for url in put_urls:
            assert "/wipe" not in url


def test_api_reload_endpoint():
    client = TestClient(app)

    # 1. Unknown room -> 404
    r_bad_room = client.post("/api/room/stanza_sconosciuta/reload")
    assert r_bad_room.status_code == 404

    # 2. Unknown node -> 404
    r_bad_node = client.post("/api/room/office/reload", json={"node": "NODO_INESISTENTE"})
    assert r_bad_node.status_code == 404

    # 3. Successful node reload
    with patch.object(room_manager, "reload", new_callable=AsyncMock) as mock_reload:
        mock_reload.return_value = {"status": "reloading", "room_id": "office", "node": "SW-PIANO1"}
        r_ok_node = client.post("/api/room/office/reload", json={"node": "SW-PIANO1"})
        assert r_ok_node.status_code == 200
        assert r_ok_node.json() == {"status": "reloading", "room_id": "office", "node": "SW-PIANO1"}

    # 4. Successful full room reload (empty body)
    with patch.object(room_manager, "reload", new_callable=AsyncMock) as mock_reload:
        mock_reload.return_value = {"status": "reloading", "room_id": "office", "node": "all"}
        r_ok_all = client.post("/api/room/office/reload", json={})
        assert r_ok_all.status_code == 200
        assert r_ok_all.json() == {"status": "reloading", "room_id": "office", "node": "all"}


async def test_room_manager_reload_status_phase_transitions():
    """Verifica che durante reload() lo stato sia 'reloading' e che al termine ritorni 'ready'
    con active_room e _wanted ripristinati, evitando che topology() imposti 'error'."""
    with patch.object(room_manager, "find_lab", new_callable=AsyncMock) as mock_find, \
         patch.object(room_manager, "_nodes", new_callable=AsyncMock) as mock_nodes, \
         patch.object(room_manager.api, "put", new_callable=AsyncMock) as mock_put, \
         patch("backend.room_labs.asyncio.sleep", new_callable=AsyncMock):

        mock_find.return_value = "lab_office_lid"
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_put.return_value = mock_resp

        phase_during_reload = None
        topology_status_during_reload = None
        states = ["BOOTED", "STOPPED", "BOOTED"]

        async def fake_nodes(lid):
            nonlocal phase_during_reload, topology_status_during_reload
            curr_state = states.pop(0) if states else "BOOTED"
            if curr_state == "STOPPED" and phase_during_reload is None:
                phase_during_reload = room_manager.status["office"]["phase"]
                # Simula chiamata concorrente a topology() durante il reload mentre il nodo e' spento
                with patch.object(room_manager.api, "get", new_callable=AsyncMock) as mock_get:
                    mock_get.side_effect = lambda path: (
                        {"lab_title": "lab_office_title", "lab_notes": ""} if path.startswith("/labs/") and "interfaces" not in path and "links" not in path else
                        []
                    )
                    top_res = await room_manager.topology("office")
                    topology_status_during_reload = top_res["status"]["phase"]
            return [{"id": "nid_sw1", "label": "SW-PIANO1", "node_definition": "ioll2-xe", "state": curr_state}]

        mock_nodes.side_effect = fake_nodes

        room_manager.active_room = "office"
        room_manager._wanted = "office"
        room_manager._set("office", "ready", "Rete pronta", ready_nodes=1, total_nodes=1)

        res = await room_manager.reload("office", node="SW-PIANO1")
        assert res["status"] == "reloading"
        assert res["node"] == "SW-PIANO1"

        # 1. Durante reload lo stato deve essere "reloading"
        assert phase_during_reload == "reloading"
        # 2. topology() concorrente NON deve declassare lo stato ad "error"
        assert topology_status_during_reload == "reloading"
        # 3. Al completamento, active_room, _wanted e fase "ready" sono ripristinati
        assert room_manager.status["office"]["phase"] == "ready"
        assert room_manager.active_room == "office"
        assert room_manager._wanted == "office"
        assert room_manager.status["office"]["ready_nodes"] == len(room_spec("office")["nodes"])


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            if inspect.iscoroutinefunction(fn):
                asyncio.run(fn())
            else:
                fn()
            print("ok", name)
