"""
Unit tests for Windows Command Translator (A6).
Tests translation of:
- ipconfig
- ipconfig /all
- arp -a
- arp -d *
- ping
- tracert
and validates standard Windows CLI output formats.
"""

from backend.windows_translator import (
    cidr_to_netmask,
    format_arp_a,
    format_arp_d,
    format_ipconfig,
    format_ipconfig_all,
    format_ping,
    format_tracert,
    translate_windows_command,
)


def test_cidr_to_netmask():
    assert cidr_to_netmask(24) == "255.255.255.0"
    assert cidr_to_netmask(16) == "255.255.0.0"
    assert cidr_to_netmask(8) == "255.0.0.0"
    assert cidr_to_netmask(30) == "255.255.255.252"


def test_translate_ipconfig():
    res = translate_windows_command("ipconfig")
    assert res is not None
    cmd, formatter = res
    assert "ip -4 addr show" in cmd

    linux_stdout = """
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN
    inet 127.0.0.1/8 scope host lo
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast state UP
    inet 10.10.10.50/24 brd 10.10.10.255 scope global eth0
---ROUTES---
default via 10.10.10.1 dev eth0
10.10.10.0/24 dev eth0 scope link
"""
    formatted = formatter(linux_stdout)
    assert "Windows IP Configuration" in formatted
    assert "Ethernet adapter eth0:" in formatted
    assert "IPv4 Address. . . . . . . . . . . : 10.10.10.50" in formatted
    assert "Subnet Mask . . . . . . . . . . . : 255.255.255.0" in formatted
    assert "Default Gateway . . . . . . . . . : 10.10.10.1" in formatted


def test_translate_ipconfig_all():
    res = translate_windows_command("ipconfig /all")
    assert res is not None
    cmd, formatter = res
    assert "ip addr show" in cmd
    assert "resolv.conf" in cmd
    assert "hostname" in cmd

    linux_stdout = """
1: lo: <LOOPBACK>
    link/loopback 00:00:00:00:00:00
2: eth0: <BROADCAST,MULTICAST,UP>
    link/ether 52:54:00:12:34:56
    inet 10.10.20.15/24 scope global eth0
---ROUTES---
default via 10.10.20.1 dev eth0
---RESOLV---
nameserver 10.10.30.10
---HOSTNAME---
PC-MARKETING
"""
    formatted = formatter(linux_stdout)
    assert "Windows IP Configuration" in formatted
    assert "Host Name . . . . . . . . . . . . : PC-MARKETING" in formatted
    assert "Physical Address. . . . . . . . . : 52-54-00-12-34-56" in formatted
    assert "IPv4 Address. . . . . . . . . . . : 10.10.20.15" in formatted
    assert "Subnet Mask . . . . . . . . . . . : 255.255.255.0" in formatted
    assert "Default Gateway . . . . . . . . . : 10.10.20.1" in formatted
    assert "DNS Servers . . . . . . . . . . . : 10.10.30.10" in formatted


def test_translate_arp_a():
    res = translate_windows_command("arp -a")
    assert res is not None
    cmd, formatter = res
    assert "arp" in cmd or "neigh" in cmd

    linux_stdout = """
10.10.10.1 dev eth0 lladdr 52:54:00:aa:bb:cc REACHABLE
10.10.10.2 dev eth0 lladdr 52:54:00:11:22:33 STALE
"""
    formatted = formatter(linux_stdout)
    assert "Interface:" in formatted
    assert "Internet Address" in formatted
    assert "Physical Address" in formatted
    assert "10.10.10.1" in formatted
    assert "52-54-00-aa-bb-cc" in formatted


def test_translate_arp_d():
    res = translate_windows_command("arp -d *")
    assert res is not None
    cmd, formatter = res
    assert "flush" in cmd

    formatted = formatter("")
    assert "deleted" in formatted.lower()


def test_translate_ping():
    res = translate_windows_command("ping 10.10.10.1")
    assert res is not None
    cmd, formatter = res
    assert cmd == "ping -c 4 10.10.10.1"

    # Also test ping with -n count
    res_n = translate_windows_command("ping -n 2 10.10.10.1")
    assert res_n is not None
    assert res_n[0] == "ping -c 2 10.10.10.1"

    linux_stdout = """
PING 10.10.10.1 (10.10.10.1): 56 data bytes
64 bytes from 10.10.10.1: seq=0 ttl=64 time=0.450 ms
64 bytes from 10.10.10.1: seq=1 ttl=64 time=1.230 ms
64 bytes from 10.10.10.1: seq=2 ttl=64 time=0.890 ms
64 bytes from 10.10.10.1: seq=3 ttl=64 time=0.910 ms

--- 10.10.10.1 ping statistics ---
4 packets transmitted, 4 packets received, 0% packet loss
round-trip min/avg/max = 0.450/0.870/1.230 ms
"""
    formatted = formatter(linux_stdout)
    assert "Pinging 10.10.10.1 with 32 bytes of data:" in formatted
    assert "Reply from 10.10.10.1: bytes=32" in formatted
    assert "Packets: Sent = 4, Received = 4, Lost = 0 (0% loss)" in formatted


def test_translate_tracert():
    res = translate_windows_command("tracert 10.10.30.10")
    assert res is not None
    cmd, formatter = res
    assert "traceroute" in cmd
    assert "10.10.30.10" in cmd

    linux_stdout = """
traceroute to 10.10.30.10 (10.10.30.10), 30 hops max, 46 byte packets
 1  10.10.10.1 (10.10.10.1)  0.621 ms  0.412 ms  0.380 ms
 2  10.10.30.10 (10.10.30.10)  1.210 ms  1.100 ms  0.980 ms
"""
    formatted = formatter(linux_stdout)
    assert "Tracing route to 10.10.30.10 over a maximum of 30 hops" in formatted
    assert "10.10.10.1" in formatted
    assert "10.10.30.10" in formatted
    assert "Trace complete." in formatted


def test_non_windows_command_returns_none():
    assert translate_windows_command("show ip route") is None
    assert translate_windows_command("ls -la") is None
