"""
Windows Command Translator for Alpine Linux nodes in Cisco CML labs.

Translates standard Windows network commands into Linux/BusyBox equivalents:
- ipconfig / ipconfig /all
- arp -a / arp -d *
- ping
- tracert

And parses Linux stdout back into standard Windows CLI formatting.
"""

import ipaddress
import re
from typing import Callable, Optional, Tuple


def cidr_to_netmask(prefix: int) -> str:
    """Convert CIDR prefix length (e.g. 24) to subnet mask (e.g. 255.255.255.0)."""
    try:
        return str(ipaddress.IPv4Network(f"0.0.0.0/{prefix}").netmask)
    except Exception:
        return "255.255.255.0"


def format_ipconfig(linux_stdout: str) -> str:
    """Format `ip -4 addr show; echo '---ROUTES---'; ip route show` into Windows ipconfig."""
    lines = linux_stdout.splitlines()
    ipv4 = None
    mask = "255.255.255.0"
    gateway = None
    iface = "Ethernet"

    in_routes = False
    for line in lines:
        line_str = line.strip()
        if "---ROUTES---" in line_str:
            in_routes = True
            continue

        if not in_routes:
            # Match inet 10.10.10.50/24 brd ... eth0
            m_inet = re.search(r"inet\s+([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/([0-9]+)", line_str)
            if m_inet and not m_inet.group(1).startswith("127."):
                ipv4 = m_inet.group(1)
                mask = cidr_to_netmask(int(m_inet.group(2)))
            m_dev = re.search(r"^[0-9]+:\s+([a-zA-Z0-9]+):", line_str)
            if m_dev and not m_dev.group(1).startswith("lo"):
                iface = m_dev.group(1)
        else:
            # Match default via 10.10.10.1 dev eth0
            m_gw = re.search(r"default\s+via\s+([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)", line_str)
            if m_gw:
                gateway = m_gw.group(1)

    out = [
        "Windows IP Configuration",
        "",
        f"Ethernet adapter {iface}:",
        "",
        "   Connection-specific DNS Suffix  . : ",
        f"   IPv4 Address. . . . . . . . . . . : {ipv4 or '0.0.0.0'}",
        f"   Subnet Mask . . . . . . . . . . . : {mask}",
        f"   Default Gateway . . . . . . . . . : {gateway or ''}",
    ]
    return "\r\n".join(out) + "\r\n"


def format_ipconfig_all(linux_stdout: str) -> str:
    """Format combined linux output into Windows `ipconfig /all`."""
    lines = linux_stdout.splitlines()
    hostname = "PC"
    ipv4 = None
    mask = "255.255.255.0"
    mac = "00-00-00-00-00-00"
    gateway = None
    dns_servers = []
    iface = "Ethernet"

    section = "ADDR"
    for line in lines:
        line_str = line.strip()
        if "---ROUTES---" in line_str:
            section = "ROUTES"
            continue
        elif "---RESOLV---" in line_str:
            section = "RESOLV"
            continue
        elif "---HOSTNAME---" in line_str:
            section = "HOSTNAME"
            continue

        if section == "ADDR":
            m_dev = re.search(r"^[0-9]+:\s+([a-zA-Z0-9]+):", line_str)
            if m_dev and not m_dev.group(1).startswith("lo"):
                iface = m_dev.group(1)
            m_mac = re.search(r"link/ether\s+([0-9a-fA-F:]{17})", line_str)
            if m_mac:
                mac = m_mac.group(1).upper().replace(":", "-")
            m_inet = re.search(r"inet\s+([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/([0-9]+)", line_str)
            if m_inet and not m_inet.group(1).startswith("127."):
                ipv4 = m_inet.group(1)
                mask = cidr_to_netmask(int(m_inet.group(2)))
        elif section == "ROUTES":
            m_gw = re.search(r"default\s+via\s+([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)", line_str)
            if m_gw:
                gateway = m_gw.group(1)
        elif section == "RESOLV":
            m_ns = re.search(r"nameserver\s+([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)", line_str)
            if m_ns:
                dns_servers.append(m_ns.group(1))
        elif section == "HOSTNAME":
            if line_str and not line_str.startswith("---"):
                hostname = line_str

    dns_str = dns_servers[0] if dns_servers else ""
    out = [
        "Windows IP Configuration",
        "",
        f"   Host Name . . . . . . . . . . . . : {hostname}",
        "   Primary Dns Suffix  . . . . . . . : ",
        "   Node Type . . . . . . . . . . . . : Hybrid",
        "   IP Routing Enabled. . . . . . . . : No",
        "   WINS Proxy Enabled. . . . . . . . : No",
        "",
        f"Ethernet adapter {iface}:",
        "",
        "   Connection-specific DNS Suffix  . : ",
        "   Description . . . . . . . . . . . : Ethernet Adapter",
        f"   Physical Address. . . . . . . . . : {mac}",
        "   DHCP Enabled. . . . . . . . . . . : Yes",
        "   Autoconfiguration Enabled . . . . : Yes",
        f"   IPv4 Address. . . . . . . . . . . : {ipv4 or '0.0.0.0'}",
        f"   Subnet Mask . . . . . . . . . . . : {mask}",
        f"   Default Gateway . . . . . . . . . : {gateway or ''}",
        f"   DNS Servers . . . . . . . . . . . : {dns_str}",
    ]
    if len(dns_servers) > 1:
        for extra_dns in dns_servers[1:]:
            out.append(f"                                       {extra_dns}")

    return "\r\n".join(out) + "\r\n"


def format_arp_a(linux_stdout: str) -> str:
    """Format Linux arp output into standard Windows `arp -a` format."""
    lines = linux_stdout.splitlines()
    entries = []
    local_ip = "192.168.1.1"

    for line in lines:
        line_str = line.strip()
        # BusyBox arp -n / Linux arp: Address HWtype HWaddress Flags Mask Iface
        # or ip neigh: 10.10.10.1 dev eth0 lladdr 52:54:00:11:22:33 REACHABLE
        m_ip_neigh = re.search(r"([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)\s+dev\s+\S+\s+lladdr\s+([0-9a-fA-F:]{17})", line_str)
        if m_ip_neigh:
            ip = m_ip_neigh.group(1)
            hw = m_ip_neigh.group(2).lower().replace(":", "-")
            entries.append((ip, hw, "dynamic"))
            continue

        # Standard /proc/net/arp or arp -n
        m_arp = re.search(r"([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)\s+(?:0x\S+|\S+)\s+(?:0x\S+|\S+)\s+([0-9a-fA-F:]{17})", line_str)
        if m_arp:
            ip = m_arp.group(1)
            hw = m_arp.group(2).lower().replace(":", "-")
            entries.append((ip, hw, "dynamic"))

    out = [
        f"Interface: {local_ip} --- 0x2",
        "  Internet Address      Physical Address      Type",
    ]
    if not entries:
        out.append("  No ARP Entries Found.")
    else:
        for ip, hw, t in entries:
            out.append(f"  {ip:<21} {hw:<21} {t}")

    return "\r\n".join(out) + "\r\n"


def format_arp_d(linux_stdout: str) -> str:
    """Format Windows `arp -d *`."""
    return "The ARP entries have been successfully deleted.\r\n"


def format_ping(linux_stdout: str, target: str) -> str:
    """Format Linux ping output into Windows ping format."""
    lines = linux_stdout.splitlines()
    replies = []
    sent = 0
    received = 0
    rtts = []

    for line in lines:
        line_str = line.strip()
        # 64 bytes from 10.10.10.1: seq=1 ttl=64 time=0.456 ms
        m = re.search(r"from\s+([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+).*?ttl=([0-9]+).*?time=([0-9.]+)\s*ms", line_str, re.IGNORECASE)
        if m:
            sent += 1
            received += 1
            ip = m.group(1)
            ttl = m.group(2)
            time_val = float(m.group(3))
            rtts.append(time_val)
            time_str = "<1ms" if time_val < 1.0 else f"{int(round(time_val))}ms"
            replies.append(f"Reply from {ip}: bytes=32 time{time_str if time_str.startswith('<') else '=' + time_str} TTL={ttl}")
        elif "packet loss" in line_str:
            # 4 packets transmitted, 4 packets received, 0% packet loss
            m_stat = re.search(r"([0-9]+)\s+packets transmitted,\s+([0-9]+)\s+packets received", line_str)
            if m_stat:
                sent = int(m_stat.group(1))
                received = int(m_stat.group(2))

    if not sent:
        sent = 4
        received = len(replies)

    lost = sent - received
    loss_pct = int(round((lost / sent) * 100)) if sent > 0 else 0

    out = [
        f"Pinging {target} with 32 bytes of data:",
    ]
    if replies:
        out.extend(replies)
    else:
        out.extend(["Request timed out."] * sent)

    out.append("")
    out.append(f"Ping statistics for {target}:")
    out.append(f"    Packets: Sent = {sent}, Received = {received}, Lost = {lost} ({loss_pct}% loss),")

    if rtts:
        min_ms = int(round(min(rtts)))
        max_ms = int(round(max(rtts)))
        avg_ms = int(round(sum(rtts) / len(rtts)))
        out.append("Approximate round trip times in milli-seconds:")
        out.append(f"    Minimum = {min_ms}ms, Maximum = {max_ms}ms, Average = {avg_ms}ms")

    return "\r\n".join(out) + "\r\n"


def format_tracert(linux_stdout: str, target: str) -> str:
    """Format Linux traceroute output into Windows tracert format."""
    lines = linux_stdout.splitlines()
    hops = []

    for line in lines:
        line_str = line.strip()
        # 1  10.10.10.1  0.512 ms  0.421 ms  0.389 ms
        # or 1  10.10.10.1 (10.10.10.1)  0.512 ms
        m = re.match(r"^([0-9]+)\s+([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+|[a-zA-Z0-9.\-_]+)", line_str)
        if m:
            hop_num = int(m.group(1))
            host = m.group(2)
            # Find all ms values
            ms_vals = re.findall(r"([0-9.]+)\s*ms", line_str)
            formatted_times = []
            for v in ms_vals[:3]:
                fv = float(v)
                formatted_times.append("<1 ms" if fv < 1.0 else f"{int(round(fv))} ms")
            while len(formatted_times) < 3:
                formatted_times.append("<1 ms" if formatted_times else "*")
            time_part = "    ".join(f"{t:>6}" for t in formatted_times)
            hops.append(f"  {hop_num:>2}    {time_part}  {host}")

    out = [
        f"Tracing route to {target} over a maximum of 30 hops",
        "",
    ]
    if hops:
        out.extend(hops)
    else:
        out.append("  1     *        *        *     Request timed out.")

    out.append("")
    out.append("Trace complete.")
    return "\r\n".join(out) + "\r\n"


def translate_windows_command(cmd: str) -> Optional[Tuple[str, Callable[[str], str]]]:
    """
    Translates a Windows CLI command into a Linux/BusyBox command and returns a tuple:
    (translated_linux_command, formatter_function).
    If the command is not a recognized Windows command, returns None.
    """
    cmd_clean = cmd.strip()
    if not cmd_clean:
        return None

    tokens = cmd_clean.split()
    verb = tokens[0].lower()

    if verb == "ipconfig":
        # Check flags
        args = [t.lower() for t in tokens[1:]]
        if "/all" in args or "-all" in args:
            linux_cmd = (
                "ip addr show; echo '---ROUTES---'; ip route show; "
                "echo '---RESOLV---'; cat /etc/resolv.conf 2>/dev/null; "
                "echo '---HOSTNAME---'; hostname"
            )
            return (linux_cmd, format_ipconfig_all)
        else:
            linux_cmd = "ip -4 addr show; echo '---ROUTES---'; ip route show"
            return (linux_cmd, format_ipconfig)

    elif verb == "arp":
        args = [t.lower() for t in tokens[1:]]
        if "-a" in args or "/a" in args:
            linux_cmd = "arp -n 2>/dev/null || cat /proc/net/arp || ip neigh show"
            return (linux_cmd, format_arp_a)
        elif "-d" in args or "/d" in args:
            linux_cmd = "ip -s -s neigh flush all 2>/dev/null || true"
            return (linux_cmd, format_arp_d)

    elif verb == "ping":
        # Windows ping defaults to 4 packets if not specified
        count = 4
        target = None
        idx = 1
        while idx < len(tokens):
            tok = tokens[idx]
            if tok.lower() in ("-n", "/n") and idx + 1 < len(tokens):
                try:
                    count = int(tokens[idx + 1])
                except ValueError:
                    pass
                idx += 2
            elif not tok.startswith("-") and not tok.startswith("/"):
                target = tok
                idx += 1
            else:
                idx += 1

        if not target:
            target = "127.0.0.1"

        linux_cmd = f"ping -c {count} {target}"
        return (linux_cmd, lambda out: format_ping(out, target))

    elif verb == "tracert":
        target = None
        for tok in tokens[1:]:
            if not tok.startswith("-") and not tok.startswith("/"):
                target = tok
                break
        if not target:
            target = "127.0.0.1"

        linux_cmd = f"traceroute -n {target}"
        return (linux_cmd, lambda out: format_tracert(out, target))

    return None
