"""
Splunk SOC Engine (C4b).

Connects to the Splunk Enterprise REST API in CML (https://192.168.122.110:8089 or bridge0)
with credentials admin / Cisc0123#.
Provides high-fidelity fallback simulation if the CML Splunk container is offline or still
booting so the endpoint never crashes.
"""

from datetime import datetime, timezone
import os
import time
from typing import Any, Dict, List
import httpx
from loguru import logger

SPLUNK_HOST = os.getenv("SPLUNK_HOST", "192.168.122.110")
SPLUNK_PORT = int(os.getenv("SPLUNK_PORT", "8089"))
SPLUNK_USER = os.getenv("SPLUNK_USER", "admin")
SPLUNK_PASS = os.getenv("SPLUNK_PASS", "Cisc0123#")
SPLUNK_BASE_URL = f"https://{SPLUNK_HOST}:{SPLUNK_PORT}"


class SplunkSOCClient:
    """Client for Splunk REST API with resilient fallback simulation."""

    def __init__(self, base_url: str = SPLUNK_BASE_URL, user: str = SPLUNK_USER, password: str = SPLUNK_PASS) -> None:
        self.base_url = base_url.rstrip("/")
        self.user = user
        self.password = password

    def generate_simulated_alerts(self, detail: str = "Container starting up") -> Dict[str, Any]:
        now_iso = datetime.now(timezone.utc).isoformat()
        alerts = [
            {
                "id": "alert-soc-001",
                "timestamp": now_iso,
                "severity": "high",
                "title": "Port Scanning Activity Detected",
                "source_ip": "10.10.10.50",
                "destination_ip": "10.10.20.1",
                "protocol": "TCP",
                "signature": "ET SCAN Potential NMAP SYN Scan against VLAN Gateway",
                "status": "fired",
            },
            {
                "id": "alert-soc-002",
                "timestamp": now_iso,
                "severity": "critical",
                "title": "Suspicious Outbound C2 Communication",
                "source_ip": "10.10.20.15",
                "destination_ip": "198.51.100.22",
                "protocol": "DNS",
                "signature": "MALWARE-CNC Cobalt Strike DNS Beaconing",
                "status": "fired",
            },
            {
                "id": "alert-soc-003",
                "timestamp": now_iso,
                "severity": "medium",
                "title": "Unauthorized VLAN Trunk Negotiation",
                "source_ip": "10.10.99.2",
                "destination_ip": "10.10.99.1",
                "protocol": "DTP",
                "signature": "SWITCH-ATTACK Dynamic Trunking Protocol Injection",
                "status": "investigating",
            },
        ]
        return {
            "status": "degraded_simulated",
            "mode": "fallback_sim",
            "alerts": alerts,
            "total": len(alerts),
            "source": "Splunk SOC Engine (CML In-Progress Fallback)",
            "detail": detail,
        }

    async def get_alerts(self) -> Dict[str, Any]:
        """Queries Splunk REST API for fired alerts or returns high-fidelity fallback."""
        t0 = time.perf_counter()
        url = f"{self.base_url}/services/alerts/fired_alerts?output_mode=json"
        try:
            async with httpx.AsyncClient(verify=False, timeout=1.5) as client:
                resp = await client.get(url, auth=(self.user, self.password))
                if resp.status_code == 200:
                    data = resp.json()
                    entries = data.get("entry", [])
                    alerts: List[Dict[str, Any]] = []
                    for idx, entry in enumerate(entries):
                        content = entry.get("content", {})
                        alerts.append({
                            "id": entry.get("id", f"splunk-{idx}"),
                            "timestamp": entry.get("updated", datetime.now(timezone.utc).isoformat()),
                            "severity": content.get("severity", "medium"),
                            "title": entry.get("name", "Splunk Alert"),
                            "source_ip": content.get("src", "unknown"),
                            "destination_ip": content.get("dest", "unknown"),
                            "protocol": content.get("proto", "IP"),
                            "signature": content.get("signature", "Triggered Alert"),
                            "status": "fired",
                        })
                    latency = round((time.perf_counter() - t0) * 1000, 1)
                    return {
                        "status": "online",
                        "mode": "live_splunk",
                        "alerts": alerts,
                        "total": len(alerts),
                        "source": f"Splunk Enterprise REST API ({self.base_url})",
                        "latency_ms": latency,
                    }
                else:
                    return self.generate_simulated_alerts(f"Splunk HTTP {resp.status_code}: {resp.text[:100]}")
        except Exception as exc:
            logger.debug(f"Splunk connection failed: {exc}, using fallback")
            return self.generate_simulated_alerts(str(exc))


splunk_soc = SplunkSOCClient()
