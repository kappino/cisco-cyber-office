"""Test del diff configurazioni SENZA CML: usa running-config vere salvate dall'ufficio.

Uso (dalla radice del repository):
    python -m tests.cml.test_config_diff        # oppure: pytest tests/cml/test_config_diff.py
"""
from pathlib import Path

import yaml

from backend.config_diff import diff_config, parse_ping

ROOT = Path(__file__).resolve().parents[2]
FIX = Path(__file__).parent / "fixtures"


def _target(room: str, node: str) -> str:
    spec = yaml.safe_load((ROOT / "backend" / "rooms" / f"{room}.yaml").read_text(encoding="utf-8"))
    return next(n["config"] for n in spec["nodes"] if n["label"] == node)


def _running(node: str) -> str:
    return (FIX / f"office_{node}.running.txt").read_text(encoding="utf-8")


def test_running_uguale_al_target_nessuna_differenza():
    for node in ("RTR-UFFICIO", "SW-PIANO1"):
        d = diff_config(_target("office", node), _running(node))
        assert d == {"missing": [], "extra": []}, (node, d)


def test_guasti_tipici_trovati_nella_sezione_giusta():
    sw = _running("SW-PIANO1")
    sw = sw.replace(" description PC-MARKETING\n switchport access vlan 10",
                    " description PC-MARKETING\n switchport access vlan 20")          # PC nella VLAN sbagliata
    sw = sw.replace("vlan 99\n name GESTIONE\n", "")                                  # VLAN cancellata
    sw = sw.replace("switchport trunk allowed vlan 10,20,30,99",
                    "switchport trunk allowed vlan 10,30,99")                          # VLAN tolta dal trunk
    d = diff_config(_target("office", "SW-PIANO1"), sw)
    missing = {(m["section"], m["line"]) for m in d["missing"]}
    extra = {(m["section"], m["line"]) for m in d["extra"]}
    assert ("", "vlan 99") in missing
    assert ("interface Ethernet0/1", "switchport access vlan 10") in missing
    assert ("interface Ethernet0/1", "switchport access vlan 20") in extra
    assert ("interface Ethernet0/0", "switchport trunk allowed vlan 10,20,30,99") in missing
    assert ("interface Ethernet0/0", "switchport trunk allowed vlan 10,30,99") in extra

    rt = _running("RTR-UFFICIO").replace(
        "interface Ethernet0/0\n description TRUNK verso SW-PIANO1 Et0/0\n no ip address\n",
        "interface Ethernet0/0\n description TRUNK verso SW-PIANO1 Et0/0\n no ip address\n shutdown\n")  # interfaccia spenta
    d = diff_config(_target("office", "RTR-UFFICIO"), rt)
    assert d["missing"] == []
    assert d["extra"] == [{"section": "interface Ethernet0/0", "line": "shutdown"}]


def test_interface_range_espanso():
    target = "interface range Ethernet0/1 - 2\n switchport mode access\n"
    running = "interface Ethernet0/1\n switchport mode access\n!\ninterface Ethernet0/2\n switchport mode trunk\n!\n"
    d = diff_config(target, running)
    assert d["missing"] == [{"section": "interface Ethernet0/2", "line": "switchport mode access"}]


def test_parser_ping_busybox():
    ok = "3 packets transmitted, 3 packets received, 0% packet loss"
    ko = "3 packets transmitted, 0 packets received, 100% packet loss"
    assert parse_ping(ok)["success"] is True
    assert parse_ping(ko)["success"] is False
    assert parse_ping("ping: sendto: Network unreachable")["success"] is False


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print("ok", name)
