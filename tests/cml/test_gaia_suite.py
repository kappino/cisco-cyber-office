"""
Unit tests for Gaia Verification Capabilities (A4).
Validates:
1. Startup-config vs running persistence check
2. Port STAT LEDs check
3. SSH enabled & Telnet disabled security check
4. Traceroute hops parsing and validation
5. Ordered ACL rules top-down verification
"""

import pytest

from backend.config_diff import diff_config, verify_acl_order
from backend.room_labs import ROOMS, RoomManager, room_spec


def test_acl_order_preservation():
    target = """
ip access-list extended SECURE_IN
 10 permit tcp any host 10.10.10.1 eq 22
 20 permit tcp any host 10.10.10.1 eq 443
 30 deny ip any any
end
"""
    # Exact same order -> PASS
    running_correct = """
ip access-list extended SECURE_IN
 10 permit tcp any host 10.10.10.1 eq 22
 20 permit tcp any host 10.10.10.1 eq 443
 30 deny ip any any
end
"""
    assert verify_acl_order(target, running_correct) is True

    # Inverted order: deny before permit 443 -> FAIL
    running_inverted = """
ip access-list extended SECURE_IN
 10 permit tcp any host 10.10.10.1 eq 22
 30 deny ip any any
 20 permit tcp any host 10.10.10.1 eq 443
end
"""
    assert verify_acl_order(target, running_inverted) is False


def test_ssh_enabled_and_telnet_disabled():
    import re

    running_secure = """
line vty 0 4
 transport input ssh
 login local
end
"""
    has_telnet = bool(re.search(r"transport input\s+(?:all|telnet\b)", running_secure, re.IGNORECASE))
    has_ssh = bool(re.search(r"transport input\s+(?:ssh\b)", running_secure, re.IGNORECASE))
    assert has_ssh is True
    assert has_telnet is False

    running_insecure = """
line vty 0 4
 transport input telnet ssh
 login local
end
"""
    has_telnet_bad = bool(re.search(r"transport input\s+(?:all|telnet\b)", running_insecure, re.IGNORECASE))
    assert has_telnet_bad is True


def test_startup_persistence_diff():
    # If startup and running differ, persistence is broken
    running = """
hostname RTR-UFFICIO
interface Ethernet0/0
 ip address 10.10.10.1 255.255.255.0
 no shutdown
end
"""
    startup_unsaved = """
hostname Router
interface Ethernet0/0
 no ip address
 shutdown
end
"""
    d = diff_config(running, startup_unsaved)
    assert len(d["missing"]) > 0 or len(d["extra"]) > 0

    startup_saved = """
hostname RTR-UFFICIO
interface Ethernet0/0
 ip address 10.10.10.1 255.255.255.0
 no shutdown
end
"""
    d_saved = diff_config(running, startup_saved)
    assert not d_saved["missing"] and not d_saved["extra"]


def test_traceroute_hops_parsing():
    import re

    traceroute_output = """
traceroute to 10.10.30.10 (10.10.30.10), 10 hops max, 46 byte packets
 1  10.10.10.1 (10.10.10.1)  0.724 ms  0.512 ms  0.412 ms
 2  10.10.30.10 (10.10.30.10)  1.420 ms  1.120 ms  0.980 ms
"""
    target = "10.10.30.10"
    hop_matches = re.findall(r"^\s*(\d+)\s+([0-9.]+)", traceroute_output, re.M)
    assert len(hop_matches) == 2
    assert hop_matches[0] == ("1", "10.10.10.1")
    assert hop_matches[1] == ("2", "10.10.30.10")
    reached = any(h[1] == target for h in hop_matches)
    assert reached is True


@pytest.mark.asyncio
async def test_port_stat_leds_check_integration(monkeypatch):
    rm = RoomManager()
    rm._set("office", "ready", "ready")

    # Mock ports() return
    async def mock_ports(room_id, fresh=False):
        return {
            "room_id": room_id,
            "ready": True,
            "ports": [
                {"node": "SW-PIANO1", "iface": "Et0/0", "color": "green", "connected": True},
                {"node": "SW-PIANO1", "iface": "Et0/1", "color": "green", "connected": True},
                {"node": "SW-PIANO1", "iface": "Et0/2", "color": "amber", "connected": True},
            ],
        }

    monkeypatch.setattr(rm, "ports", mock_ports)

    # Mock find_lab and run_console_commands to test verify()
    async def mock_find_lab(title):
        return "lab-123"

    def mock_run_console_commands(title, node, cml_def, cmds, timeout=10, credentials=None):
        if "show running-config" in cmds[0]:
            return [room_spec("office")["nodes"][0]["config"]]
        return ["inet 10.10.10.50/24"]

    monkeypatch.setattr(rm, "find_lab", mock_find_lab)
    import backend.room_labs as rl
    monkeypatch.setattr(rl, "run_console_commands", mock_run_console_commands)

    # Enable check_leds on office room spec temporarily
    orig_spec = rl.room_spec("office")
    spec_with_leds = dict(orig_spec)
    spec_with_leds["check_leds"] = True
    monkeypatch.setattr(rl, "room_spec", lambda r: spec_with_leds if r == "office" else orig_spec)

    res = await rm.verify("office")
    assert "checks" in res
    led_checks = [c for c in res["checks"] if "Port LED" in c.get("label", "")]
    assert len(led_checks) == 3
    assert all(c["ok"] for c in led_checks)
