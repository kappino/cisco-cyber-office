"""Offline unit and integration tests for HTTP Console Session (Milestone 1 - A10).

Verifies:
- ConsoleSession lifecycle (create, send, long-polling read, delete)
- Raw input preservation without intrusive resets (\\x03\\x15\\r or enable)
- ANSI escape sequence stripping on read
- Inactivity TTL expiration and automatic cleanup
- Concurrency integration with OPEN_CONSOLES and OPEN_BRIDGES
- FastAPI routes: POST /api/console-session/{room}/{node}, /send, /read, DELETE
- Legacy /api/terminal/command compatibility
"""
from __future__ import annotations

import asyncio
import time
from typing import Any, List, Optional
from unittest.mock import AsyncMock, MagicMock, patch

from starlette.testclient import TestClient

from backend.console_session import ConsoleSession, ConsoleSessionManager, console_session_manager
from backend.main import app
from backend.room_labs import CONSOLE_LOCKS, OPEN_BRIDGES, OPEN_CONSOLES, ConsoleBridge, room_manager


class MockBridge:
    """Mock di ConsoleBridge per test offline senza SSH o CML."""

    def __init__(self, lab_title: str, node_label: str, cml_def: str = "ioll2-xe") -> None:
        self.lab_title = lab_title
        self.node_label = node_label
        self.cml_def = cml_def
        self.queue: "asyncio.Queue[Optional[bytes]]" = asyncio.Queue()
        self.sent: List[str] = []
        self._closed = False
        self._registered = False

    def open(self) -> None:
        k = (self.lab_title, self.node_label)
        OPEN_CONSOLES[k] = OPEN_CONSOLES.get(k, 0) + 1
        OPEN_BRIDGES.setdefault(k, []).append(self)  # type: ignore
        self._registered = True

    def send(self, data: str) -> None:
        self.sent.append(data)

    def close(self) -> None:
        self._closed = True
        if self._registered:
            k = (self.lab_title, self.node_label)
            OPEN_CONSOLES[k] = max(0, OPEN_CONSOLES.get(k, 1) - 1)
            if not OPEN_CONSOLES[k]:
                OPEN_CONSOLES.pop(k, None)
            if self in OPEN_BRIDGES.get(k, []):
                OPEN_BRIDGES[k].remove(self)  # type: ignore
                if not OPEN_BRIDGES[k]:
                    OPEN_BRIDGES.pop(k, None)
            self._registered = False


def test_console_session_send_preserves_keystrokes_without_resets():
    bridge = MockBridge("lab_office", "SW-PIANO1")
    bridge.open()
    session = ConsoleSession("test-s1", "office", "SW-PIANO1", bridge)  # type: ignore

    # Send commands including configure terminal and interactive inputs
    n1 = session.send("configure terminal\r")
    assert n1 == len("configure terminal\r".encode("utf-8"))
    n2 = session.send("interface Ethernet0/1\r")
    assert n2 == len("interface Ethernet0/1\r".encode("utf-8"))
    n3 = session.send("?\r")
    assert n3 == len("?\r".encode("utf-8"))

    # Verify that NO \x03\x15\r or \x1a\renable\r was injected!
    assert bridge.sent == ["configure terminal\r", "interface Ethernet0/1\r", "?\r"]
    for sent_item in bridge.sent:
        assert "\x03" not in sent_item
        assert "\x15" not in sent_item
        assert "\x1a" not in sent_item
        assert "enable" not in sent_item
    session.close()


async def test_console_session_read_long_polling_and_ansi_stripping():
    bridge = MockBridge("lab_office", "SW-PIANO1")
    bridge.open()
    session = ConsoleSession("test-s2", "office", "SW-PIANO1", bridge)  # type: ignore

    # Put raw output with ANSI color codes, cursor sequences, and carriage returns into the queue
    ansi_data = b"\x1b[32mSW-PIANO1(config)#\x1b[0m \x1b[?25hshow run\r\n"
    await bridge.queue.put(ansi_data)

    out = await session.read(wait=1.0)
    # Verify ANSI escape sequences are completely stripped
    assert "\x1b[32m" not in out
    assert "\x1b[0m" not in out
    assert "\x1b[?25h" not in out
    assert "SW-PIANO1(config)# show run" in out

    # Empty queue test: wait 0.05s, must return empty string without hanging
    t0 = time.time()
    empty_out = await session.read(wait=0.05)
    t_elapsed = time.time() - t0
    assert empty_out == ""
    assert 0.04 <= t_elapsed < 0.5
    session.close()


def test_console_session_inactivity_ttl_and_cleanup():
    manager = ConsoleSessionManager()
    bridge1 = MockBridge("lab_office", "SW-PIANO1")
    bridge1.open()
    s1 = manager.create_session("office", "SW-PIANO1", bridge1)  # type: ignore

    # Fresh session is not expired
    assert not s1.is_expired(ttl=600.0)
    assert manager.get_session(s1.session_id) is s1

    # Simulate inactivity by backdating last_activity
    s1.last_activity = time.time() - 601.0
    assert s1.is_expired(ttl=600.0)

    # get_session automatically evicts and closes expired sessions
    assert manager.get_session(s1.session_id) is None
    assert bridge1._closed is True

    # Test cleanup_expired
    bridge2 = MockBridge("lab_office", "RTR-UFFICIO")
    bridge2.open()
    s2 = manager.create_session("office", "RTR-UFFICIO", bridge2)  # type: ignore
    s2.last_activity = time.time() - 650.0

    count = manager.cleanup_expired(ttl=600.0)
    assert count == 1
    assert manager.get_session(s2.session_id) is None
    assert bridge2._closed is True


def test_concurrency_open_consoles_and_bridges_tracking():
    k = ("lab_test", "SW-1")
    bridge = MockBridge("lab_test", "SW-1")
    assert OPEN_CONSOLES.get(k, 0) == 0
    assert k not in OPEN_BRIDGES

    bridge.open()
    assert OPEN_CONSOLES.get(k) == 1
    assert bridge in OPEN_BRIDGES.get(k, [])

    session = ConsoleSession("test-s-conc", "office", "SW-1", bridge)  # type: ignore
    session.close()

    assert OPEN_CONSOLES.get(k, 0) == 0
    assert k not in OPEN_BRIDGES


def test_http_api_routes_lifecycle():
    client = TestClient(app)

    # 1. 404 on invalid room
    r_bad_room = client.post("/api/console-session/stanza_inesistente/SW-PIANO1")
    assert r_bad_room.status_code == 404

    # 2. 404 on invalid node in room
    r_bad_node = client.post("/api/console-session/office/NODO-NON-ESISTE")
    assert r_bad_node.status_code == 404

    # 3. 404 if room not ready
    with patch.dict(room_manager.status, {"office": {"phase": "stopping", "message": "Spento"}}):
        r_not_ready = client.post("/api/console-session/office/SW-PIANO1")
        assert r_not_ready.status_code == 404

    # 4. Successful session creation
    with patch.dict(room_manager.status, {"office": {"phase": "ready", "message": "Accesa"}}), \
         patch("backend.main.ConsoleBridge") as mock_bridge_cls:
        mock_instance = MockBridge("lab_office", "SW-PIANO1")
        mock_bridge_cls.return_value = mock_instance

        r_create = client.post("/api/console-session/office/SW-PIANO1")
        assert r_create.status_code == 200
        data = r_create.json()
        assert "session_id" in data
        assert data["room_id"] == "office"
        assert data["node"] == "SW-PIANO1"
        sid = data["session_id"]

        # 5. Send command
        r_send = client.post(f"/api/console-session/{sid}/send", json={"data": "show version\r"})
        assert r_send.status_code == 200
        assert r_send.json()["bytes_written"] == len("show version\r".encode("utf-8"))
        assert mock_instance.sent == ["show version\r"]

        # 6. Read command output
        mock_instance.queue.put_nowait(b"\x1b[31mCisco IOS Software\x1b[0m\r\nSW-PIANO1#")
        r_read = client.get(f"/api/console-session/{sid}/read?wait=0.5")
        assert r_read.status_code == 200
        output = r_read.json()["output"]
        assert "Cisco IOS Software" in output
        assert "\x1b[31m" not in output
        assert "SW-PIANO1#" in output

        # 7. Delete session
        r_del = client.delete(f"/api/console-session/{sid}")
        assert r_del.status_code == 200
        assert r_del.json() == {"status": "closed"}
        assert mock_instance._closed is True

        # 8. Subsequent access to deleted session returns 404
        r_after = client.get(f"/api/console-session/{sid}/read")
        assert r_after.status_code == 404
        r_send_after = client.post(f"/api/console-session/{sid}/send", json={"data": "test"})
        assert r_send_after.status_code == 404


def test_legacy_terminal_command_preserved():
    client = TestClient(app)
    with patch.object(room_manager, "exec_command", new_callable=AsyncMock) as mock_exec:
        mock_exec.return_value = "SW-PIANO1# show clock\n*00:00:00.000 UTC"
        resp = client.post("/api/terminal/command", json={"node": "SW-PIANO1", "command": "show clock"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["source"] == "live_cml"
        assert data["node"] == "SW-PIANO1"
        assert data["output"] == "SW-PIANO1# show clock\n*00:00:00.000 UTC"


def test_console_bridge_send_flushes_queued_keystrokes_on_unlock():
    loop = asyncio.new_event_loop()
    try:
        bridge = ConsoleBridge("lab_office", "SW-PIANO1", "ioll2-xe", loop)
        mock_chan = MagicMock()
        mock_chan.closed = False
        bridge.chan = mock_chan

        k = ("lab_office", "SW-PIANO1")
        # 1. Lock the console
        CONSOLE_LOCKS[k] = "VERIFY"
        try:
            assert bridge.locked() == "VERIFY"
            bridge.send("conf t\r")
            # Should be queued, not sent yet
            assert bridge.queued == "conf t\r"
            assert mock_chan.send.call_count == 0

            bridge.send("int eth0/1\r")
            assert bridge.queued == "conf t\rint eth0/1\r"
            assert mock_chan.send.call_count == 0
        finally:
            # 2. Release lock
            CONSOLE_LOCKS.pop(k, None)

        assert bridge.locked() is None
        # 3. Next send should flush queued keys prepended to the new keys
        bridge.send("no shut\r")
        assert bridge.queued == ""
        # mock_chan.send must have received "conf t\rint eth0/1\rno shut\r"
        sent_data = "".join(call.args[0] for call in mock_chan.send.call_args_list)
        assert sent_data == "conf t\rint eth0/1\rno shut\r"
    finally:
        loop.close()


async def test_ports_cleans_up_expired_console_sessions():
    bridge = MockBridge("lab_office", "SW-PIANO1")
    bridge.open()
    k = ("lab_office", "SW-PIANO1")
    assert OPEN_CONSOLES.get(k) == 1

    session = console_session_manager.create_session("office", "SW-PIANO1", bridge)  # type: ignore
    sid = session.session_id
    assert console_session_manager.get_session(sid) is session

    # Backdate activity past TTL (600s)
    session.last_activity = time.time() - 650.0

    # Calling room_manager.ports() triggers cleanup_expired()
    with patch.dict(room_manager.status, {"office": {"phase": "idle"}}):
        await room_manager.ports("office")

    # Session must be evicted and bridge closed, decrementing OPEN_CONSOLES
    assert console_session_manager.get_session(sid) is None
    assert bridge._closed is True
    assert OPEN_CONSOLES.get(k, 0) == 0


if __name__ == "__main__":
    import inspect
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            if inspect.iscoroutinefunction(fn):
                asyncio.run(fn())
            else:
                fn()
            print("ok", name)
