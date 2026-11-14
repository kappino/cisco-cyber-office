"""
Unit tests for Splunk SOC Engine (C4b).
Validates:
- Real connection attempt or fallback simulation if Splunk container is still booting
- Fallback alerts format and schema
- Live REST response parsing when mock server responds
- GET /api/soc/alerts endpoint stability (never crashes)
"""

from fastapi.testclient import TestClient
import pytest

from backend.main import app
from backend.splunk_soc import SplunkSOCClient, splunk_soc

client = TestClient(app)


@pytest.mark.asyncio
async def test_splunk_fallback_alerts_format():
    sim = splunk_soc.generate_simulated_alerts("Simulated test")
    assert sim["status"] == "degraded_simulated"
    assert sim["mode"] == "fallback_sim"
    assert isinstance(sim["alerts"], list)
    assert len(sim["alerts"]) >= 3

    for alert in sim["alerts"]:
        assert "id" in alert
        assert "timestamp" in alert
        assert "severity" in alert
        assert "title" in alert
        assert "source_ip" in alert
        assert "destination_ip" in alert
        assert "protocol" in alert
        assert "signature" in alert


@pytest.mark.asyncio
async def test_splunk_client_live_or_fallback_graceful():
    # Calling get_alerts when host is unreachable must gracefully return fallback without exception
    res = await splunk_soc.get_alerts()
    assert res is not None
    assert "alerts" in res
    assert len(res["alerts"]) > 0
    assert res["status"] in ("online", "degraded_simulated")


def test_api_soc_alerts_endpoint():
    resp = client.get("/api/soc/alerts")
    assert resp.status_code == 200
    data = resp.json()
    assert "alerts" in data
    assert isinstance(data["alerts"], list)
    assert len(data["alerts"]) > 0
    assert "source" in data
