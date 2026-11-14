"""Diff tra la configurazione target (file della stanza) e la running-config vera di un apparato IOS.

Il confronto e' per sezioni, come le legge un tecnico:
  - "mancanti": righe del target che sull'apparato non ci sono (nella sezione giusta);
  - "in piu'":  righe presenti in una sezione che il target descrive ma che il target non prevede
                (es. uno `shutdown`, una VLAN d'accesso diversa), piu' sezioni rilevanti in piu'
                (VLAN, interfacce configurate, pool DHCP) che il target non conosce.
Le righe che IOS aggiunge da solo (default) sono ignorate.
"""
from __future__ import annotations

import re
from typing import Dict, List, Optional, Tuple

# righe di default che IOS scrive da solo e che non sono una differenza
IGNORED_TOP = re.compile(
    r"^(!|end$|version |service |no service |platform |boot-|logging |no logging |memory|no aaa|aaa |"
    r"clock |ip cef|no ipv6 cef|ipv6 cef|multilink|redundancy|subscriber|license |diagnostic |"
    r"spanning-tree extend system-id|vlan internal allocation|ip forward-protocol|ip http |"
    r"ip ssh |control-plane|line aux|line vty|login|archive|crypto |certificate|quit|"
    r"Building configuration|Current configuration|Last configuration|NVRAM config|"
    r"username |enable |no ip http|ip tcp|hostname$|errdisable|port-channel load-balance|"
    r"mmi |no mmi|ip routing$|track |alias |call-home|ip domain name|no ip routing)"
)
IGNORED_CHILD = re.compile(
    r"^(no ip address|negotiation auto|duplex auto|speed auto|no mop|media-type|"
    r"no ip route-cache|ip route-cache|no ip mroute-cache|activation-character|stopbits|"
    r"login|transport |no switchport$|no keepalive|no cdp|cdp |no nameif|snmp trap)"
)
# sezioni per cui ha senso segnalare righe "in piu'"
TRACKED_SECTIONS = re.compile(r"^(interface |vlan \d+|ip dhcp pool |ip access-list |router |line con)")


def _norm(line: str) -> str:
    return re.sub(r"\s+", " ", line.strip())


def _expand_range(spec: str) -> List[str]:
    """`interface range Ethernet0/1 - 2, Ethernet1/0` -> [Ethernet0/1, Ethernet0/2, Ethernet1/0]."""
    out: List[str] = []
    for part in spec.split(","):
        part = part.strip()
        m = re.match(r"^([A-Za-z-]+)\s*(\d+)/(\d+)\s*-\s*(\d+)$", part)
        if m:
            name, slot, a, b = m.group(1), m.group(2), int(m.group(3)), int(m.group(4))
            out += [f"{name}{slot}/{i}" for i in range(a, b + 1)]
        elif part:
            out.append(part.replace(" ", ""))
    return out


def parse_sections(text: str, expand_ranges: bool = False) -> Tuple[Dict[str, List[str]], List[str]]:
    """Restituisce ({sezione: [righe figlie]}, [righe di primo livello senza figli])."""
    sections: Dict[str, List[str]] = {}
    order: List[str] = []
    current: Optional[List[str]] = None
    current_keys: List[str] = []
    for raw in text.replace("\r", "").splitlines():
        if not raw.strip() or raw.strip() == "!":
            current, current_keys = None, []
            continue
        if raw.startswith(" ") and current_keys:
            for k in current_keys:
                sections[k].append(_norm(raw))
            continue
        line = _norm(raw)
        if expand_ranges and line.startswith("interface range "):
            current_keys = [f"interface {i}" for i in _expand_range(line[len("interface range "):])]
        else:
            current_keys = [line]
        for k in current_keys:
            if k not in sections:
                sections[k] = []
                order.append(k)
        current = sections[current_keys[0]]
    top_only = [k for k in order if not sections[k]]
    return sections, top_only


def _is_default_top(line: str) -> bool:
    return bool(IGNORED_TOP.match(line))


def diff_config(target: str, running: str) -> Dict[str, List[Dict[str, str]]]:
    """Confronta target e running-config. Ritorna {"missing": [...], "extra": [...]} con
    elementi {"section": <sezione o "">, "line": <riga>}."""
    t_sec, _ = parse_sections(target, expand_ranges=True)
    r_sec, _ = parse_sections(running)
    missing: List[Dict[str, str]] = []
    extra: List[Dict[str, str]] = []

    for sec, children in t_sec.items():
        if sec in ("end",) or _is_default_top(sec) and not children:
            continue
        if sec not in r_sec:
            missing.append({"section": "", "line": sec})
            for c in children:
                if c != "no shutdown":
                    missing.append({"section": sec, "line": c})
            continue
        have = set(r_sec[sec])
        for c in children:
            if c == "no shutdown":
                if "shutdown" in have:
                    extra.append({"section": sec, "line": "shutdown"})
                continue
            if c not in have:
                missing.append({"section": sec, "line": c})
        if TRACKED_SECTIONS.match(sec):
            want = set(children)
            for c in r_sec[sec]:
                if c in want or IGNORED_CHILD.match(c):
                    continue
                if c == "shutdown" and "no shutdown" not in want:
                    # shutdown non previsto: e' una differenza vera (porta spenta)
                    extra.append({"section": sec, "line": c})
                    continue
                if c != "shutdown":
                    extra.append({"section": sec, "line": c})

    # sezioni rilevanti presenti sull'apparato ma sconosciute al target
    for sec, children in r_sec.items():
        if sec in t_sec or not TRACKED_SECTIONS.match(sec) or sec.startswith("line con"):
            continue
        meaningful = [c for c in children if not IGNORED_CHILD.match(c) and c != "shutdown"]
        if sec.startswith("interface ") and not meaningful:
            continue  # interfaccia non usata, solo default
        extra.append({"section": "", "line": sec})
        for c in meaningful:
            extra.append({"section": sec, "line": c})
    return {"missing": missing, "extra": extra}


# ---------------------------------------------------------------------------
# Ping: parser da netAgent (tools/ping_parser.py), formato busybox/VPCS
# ---------------------------------------------------------------------------
_SENT = re.compile(r"(\d+) packets? transmitted")
_RECV = re.compile(r"(\d+) packets? received")
_LOSS = re.compile(r"(\d+(?:\.\d+)?)% packet loss")


def parse_ping(output: str) -> Dict[str, object]:
    low = output.lower()
    if "unreachable" in low or "bad address" in low:
        return {"success": False, "sent": 0, "received": 0, "loss": 100.0}
    s, r, l = _SENT.search(output), _RECV.search(output), _LOSS.search(output)
    if s and r and l:
        recv = int(r.group(1))
        loss = float(l.group(1))
        return {"success": recv > 0 and loss < 100.0, "sent": int(s.group(1)), "received": recv, "loss": loss}
    replies = re.findall(r"\b\d+\s+bytes\s+from\s+", output, re.IGNORECASE)
    return {"success": bool(replies), "sent": len(replies), "received": len(replies), "loss": 0.0 if replies else 100.0}


# ---------------------------------------------------------------------------
# ACL Order Verification (A4 Gaia Suite)
# ---------------------------------------------------------------------------
def verify_acl_order(target_config: str, running_config: str) -> bool:
    """
    Verifies that access-list rules in running_config preserve the exact top-down
    sequence defined in target_config (Cisco ACL first-match semantics).
    Strips optional Cisco line sequence numbers (e.g. '10 permit ...').
    """
    t_sec, _ = parse_sections(target_config)
    r_sec, _ = parse_sections(running_config)

    def clean_rule(line: str) -> Optional[str]:
        n = _norm(line)
        n_stripped = re.sub(r"^\d+\s+", "", n)
        if n_stripped.startswith(("permit", "deny", "remark")):
            return n_stripped
        return None

    for sec, t_lines in t_sec.items():
        if "access-list" in sec.lower():
            r_lines = r_sec.get(sec, [])
            t_rules = [clean_rule(l) for l in t_lines if clean_rule(l)]
            r_rules = [clean_rule(l) for l in r_lines if clean_rule(l)]

            if not t_rules:
                continue

            curr_idx = -1
            for rule in t_rules:
                try:
                    next_idx = r_rules.index(rule, curr_idx + 1)
                    curr_idx = next_idx
                except ValueError:
                    return False
    return True


# ---------------------------------------------------------------------------
# 3-Level Diff Hints (B1 & C6)
# ---------------------------------------------------------------------------
def generate_hints(diff_result: Dict[str, Any], level: int = 1, device_filter: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Generates progressive 3-level troubleshooting hints from diff output:
    - Level 1: Device / High-level
    - Level 2: Section / Scope
    - Level 3: Exact command
    """
    if level not in (1, 2, 3):
        level = 1

    device_diffs: List[Tuple[str, Dict[str, List[Dict[str, str]]]]] = []

    if "devices" in diff_result and isinstance(diff_result["devices"], list):
        for d in diff_result["devices"]:
            lbl = d.get("label") or d.get("device") or "unknown"
            diff = d.get("diff", {})
            if isinstance(diff, dict):
                device_diffs.append((lbl, diff))
    elif "missing" in diff_result or "extra" in diff_result:
        lbl = diff_result.get("device", "device")
        device_diffs.append((lbl, diff_result))
    else:
        for k, v in diff_result.items():
            if isinstance(v, dict) and ("missing" in v or "extra" in v):
                device_diffs.append((k, v))

    hints: List[Dict[str, Any]] = []

    for dev_label, diff in device_diffs:
        if device_filter and dev_label.lower() != device_filter.lower():
            continue

        missing = diff.get("missing", [])
        extra = diff.get("extra", [])

        if not missing and not extra:
            continue

        if level == 1:
            # Level 1: Device / High-level
            categories = set()
            for item in missing + extra:
                sec = item.get("section", "")
                if sec.startswith("interface"):
                    categories.add("interfacce di rete")
                elif sec.startswith("vlan"):
                    categories.add("VLAN")
                elif sec.startswith("ip dhcp"):
                    categories.add("servizi DHCP")
                elif sec.startswith("ip route"):
                    categories.add("routing")
                elif sec.startswith("ip access-list"):
                    categories.add("liste di controllo accessi (ACL)")
                else:
                    categories.add("configurazioni generali")
            cat_str = ", ".join(sorted(categories)) if categories else "parametri di rete"
            hints.append({
                "level": 1,
                "device": dev_label,
                "hint": f"Rilevata discrepanza di configurazione su {dev_label}. Controlla l'area: {cat_str}.",
            })

        elif level == 2:
            # Level 2: Section / Scope
            sections: Dict[str, List[str]] = {}
            for item in missing:
                sec = item.get("section") or "global"
                sections.setdefault(sec, []).append(f"mancante: {item.get('line')}")
            for item in extra:
                sec = item.get("section") or "global"
                sections.setdefault(sec, []).append(f"non previsto: {item.get('line')}")

            for sec, details in sections.items():
                if sec == "global":
                    hints.append({
                        "level": 2,
                        "device": dev_label,
                        "section": "global",
                        "hint": f"Su {dev_label}, controlla la configurazione globale ({len(details)} discrepanze).",
                    })
                else:
                    hints.append({
                        "level": 2,
                        "device": dev_label,
                        "section": sec,
                        "hint": f"Su {dev_label}, verifica la sezione '{sec}': rilevate impostazioni non allineate ({len(details)} discrepanze).",
                    })

        elif level == 3:
            # Level 3: Exact command
            for item in missing:
                sec = item.get("section", "")
                line = item.get("line", "")
                if sec:
                    cmd = f"configure terminal\n{sec}\n{line}\nend"
                    hint_text = f"Su {dev_label}, entra in '{sec}' ed esegui '{line}'"
                else:
                    cmd = f"configure terminal\n{line}\nend"
                    hint_text = f"Su {dev_label}, esegui il comando globale '{line}'"
                hints.append({
                    "level": 3,
                    "device": dev_label,
                    "section": sec or "global",
                    "command": cmd,
                    "hint": hint_text,
                })

            for item in extra:
                sec = item.get("section", "")
                line = item.get("line", "")
                if line == "shutdown" and sec:
                    cmd = f"configure terminal\n{sec}\nno shutdown\nend"
                    hint_text = f"Su {dev_label}, riattiva la porta '{sec}' eseguendo 'no shutdown'"
                elif sec:
                    cmd = f"configure terminal\n{sec}\nno {line}\nend"
                    hint_text = f"Su {dev_label}, rimuovi da '{sec}' la riga inattesa eseguendo 'no {line}'"
                else:
                    cmd = f"configure terminal\nno {line}\nend"
                    hint_text = f"Su {dev_label}, rimuovi la configurazione inattesa con 'no {line}'"
                hints.append({
                    "level": 3,
                    "device": dev_label,
                    "section": sec or "global",
                    "command": cmd,
                    "hint": hint_text,
                })

    return hints

