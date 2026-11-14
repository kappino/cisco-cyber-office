import json
import os
import time
from typing import Any, Dict
import httpx

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma4:12b")
AI_TIMEOUT_SEC = 10.0

NPC_PERSONAS: Dict[str, str] = {
    "alessia": (
        "Sei Alessia, receptionist accogliente all'ingresso del Cisco Cyber Office. "
        "Fornisci indicazioni chiare di primo orientamento su stanze, apparati e persone dell'ufficio. "
        "Rispondi in italiano cordiale e solare, max 2 frasi brevi."
    ),
    "davide": (
        "Sei Davide, Red Team lead ed esperto di offensive security. "
        "Sei ironico, cinico e pungente, ma brillante nell'individuare vulnerabilità, misconfigurazioni e porte aperte. "
        "Rispondi in italiano tagliente e sarcastico, max 2 frasi brevi sfidando il giocatore."
    ),
    "luca": (
        "Sei Luca, Senior Network Architect e Mentore didattico Cisco. "
        "Aiuti il giocatore a comprendere VLAN, trunk 802.1Q, routing e spanning-tree guidandolo con metodo socratico. "
        "Rispondi in italiano chiaro, incoraggiante e didattico, max 2 frasi brevi."
    ),
    "gaia": (
        "Sei Gaia, Head of Infrastructure & Quality Assurance (capo team e responsabile collaudi). "
        "Sei rigorosa, precisa e inflessibile sulla conformità: pretendi verifiche complete, startup-config salvata, porte UP e zero allarmi. "
        "Rispondi in italiano autorevole e operativo, max 2 frasi brevi."
    ),
    "marco": (
        "Sei Marco, Senior Network Engineer dell'ufficio Cisco a Napoli. "
        "Conosci le 4 missioni dell'ufficio: 1) Rack SW1 al Piano -1 (cablaggio L1/L2), "
        "2) Terminale CRT al Corridoio 1F (IOS CLI), 3) Umbrella SOC al Corridoio 1F (sinkhole DNS), "
        "4) Wireshark al Piano -1 (analisi pacchetti). "
        "Rispondi in italiano pratico, max 2 frasi brevi, dando un consiglio concreto basato sullo stato reale."
    ),
    "ciro": (
        "Sei Ciro, SysAdmin di turno al Datacenter Piano -1 di Napoli. "
        "Aiuti su cablaggio Rack SW1, porte Catalyst e nodi CML della stanza (es. SW-PIANO1, SW-DIST, SW-ACC, RTR-CORE). "
        "Rispondi in italiano diretto e ironico da sala server, max 2 frasi brevi e utili."
    ),
    "rosaria": (
        "Sei Rosaria, Lead SOC Analyst & Mentor Cisco a Napoli. "
        "Guidi il giocatore tra le 4 missioni (Rack SW1, CLI IOS, Umbrella DNS Sinkhole, Wireshark). "
        "Rispondi in italiano chiaro e operativo, max 2 frasi brevi indicando esattamente dove andare o cosa controllare."
    ),
    "secbot": (
        "Sei SecBot, assistente AI tattico Cisco. "
        "Dai comandi IOS precisi (es. show ip interface brief, no shutdown) o check OSI in max 2 frasi brevi in italiano."
    ),
}

FALLBACK_NPC: Dict[str, str] = {
    "alessia": "Benvenuto in Cisco Cyber Office! Dirigiti verso la reception o il corridoio per iniziare le verifiche di rete.",
    "davide": "Se lasci le interfacce in shutdown o le VLAN a caso, per il Red Team è un gioco da ragazzi entrare.",
    "luca": "Prima di tutto controlla il trunk e le VLAN: se il livello 2 non è coerente, il routing non potrà mai funzionare.",
    "gaia": "Non accetto collaudi parziali. Verifica subito la startup-config, i LED delle porte e le regole ACL.",
    "marco": "Guagliò, controlla prima il Layer 1 sul rack: se la porta sullo switch è in shutdown non passa manco un ping.",
    "ciro": "Qui in sala server è tutto sotto controllo, ma verifica i cavi trunk prima di toccare la CLI.",
    "rosaria": "Tieni d'occhio i domini sospetti su Umbrella: appena vedi un C2, mandalo subito in sinkhole.",
    "secbot": "Verifica la connettività L1/L2, poi esegui `show ip interface brief` sulla console IOS.",
}


class AIService:
    """Async client for local Ollama (gemma4:12b) with 2.5s timeout and deterministic fallback."""

    async def get_status(self) -> Dict[str, Any]:
        t0 = time.perf_counter()
        try:
            async with httpx.AsyncClient(base_url=OLLAMA_URL, timeout=1.5) as client:
                resp = await client.get("/api/tags")
                resp.raise_for_status()
                models = [m.get("name", "") for m in resp.json().get("models", [])]
                has_model = any(OLLAMA_MODEL in m for m in models)
                latency = round((time.perf_counter() - t0) * 1000, 1)
                return {
                    "status": "online" if has_model else "online",
                    "mode": "live_ai",
                    "model": OLLAMA_MODEL,
                    "model_loaded": has_model,
                    "latency_ms": latency,
                }
        except Exception as exc:
            latency = round((time.perf_counter() - t0) * 1000, 1)
            return {
                "status": "fallback",
                "mode": "fallback_sim",
                "model": OLLAMA_MODEL,
                "model_loaded": False,
                "latency_ms": latency,
                "detail": str(exc),
            }

    async def ask_npc(
        self, npc_id: str, player_prompt: str, infra_state: Dict[str, Any]
    ) -> Dict[str, Any]:
        t0 = time.perf_counter()
        persona = NPC_PERSONAS.get(npc_id, NPC_PERSONAS["secbot"])
        hints = infra_state.get("hints")
        if not hints and "diff" in infra_state:
            from backend.config_diff import generate_hints
            hints = generate_hints(infra_state["diff"], level=2)

        grounding = f"\nIndizi diff attivi: {json.dumps(hints, ensure_ascii=False)}." if hints else ""
        system_prompt = (
            f"{persona}\n"
            f"Stato attuale infrastruttura CML/SOC: {json.dumps(infra_state, ensure_ascii=False)}.{grounding}"
        )
        try:
            async with httpx.AsyncClient(base_url=OLLAMA_URL, timeout=AI_TIMEOUT_SEC) as client:
                resp = await client.post(
                    "/api/chat",
                    json={
                        "model": OLLAMA_MODEL,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": player_prompt or "Dammi un aggiornamento rapido sulla rete."},
                        ],
                        "stream": False,
                        "think": False,
                        "keep_alive": -1,
                        "options": {"num_ctx": 1024, "num_predict": 120, "temperature": 0.35},
                    },
                )
                resp.raise_for_status()
                reply = resp.json().get("message", {}).get("content", "").strip()
                if not reply:
                    raise ValueError("Empty Ollama response")
                latency = round((time.perf_counter() - t0) * 1000, 1)
                return {
                    "source": "live_ai",
                    "npc_id": npc_id,
                    "reply": reply,
                    "model": OLLAMA_MODEL,
                    "latency_ms": latency,
                }
        except Exception:
            latency = round((time.perf_counter() - t0) * 1000, 1)
            fallback_text = FALLBACK_NPC.get(npc_id, FALLBACK_NPC["secbot"])
            if hints and npc_id in ("luca", "gaia"):
                first_hint = hints[0].get("hint")
                if first_hint:
                    fallback_text = f"{fallback_text} Nota: {first_hint}"
            return {
                "source": "fallback_sim",
                "npc_id": npc_id,
                "reply": fallback_text,
                "model": OLLAMA_MODEL,
                "latency_ms": latency,
            }

    async def ask_mentor_hint(
        self, minigame: str, context: str, infra_state: Dict[str, Any]
    ) -> Dict[str, Any]:
        t0 = time.perf_counter()
        system_prompt = (
            "Sei un Senior Cisco Engineer. Rispondi SOLO in JSON valido con le chiavi: "
            '{"hint": "...", "osi_layer": "Layer X", "suggested_check": "..."}. '
            "Dai un consiglio socratico breve in italiano."
        )
        user_msg = f"Minigame: {minigame}. Contesto: {context}. Stato infra: {json.dumps(infra_state, ensure_ascii=False)}"
        try:
            async with httpx.AsyncClient(base_url=OLLAMA_URL, timeout=AI_TIMEOUT_SEC) as client:
                resp = await client.post(
                    "/api/chat",
                    json={
                        "model": OLLAMA_MODEL,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_msg},
                        ],
                        "stream": False,
                        "think": False,
                        "keep_alive": -1,
                        "format": "json",
                        "options": {"num_ctx": 1024, "num_predict": 120, "temperature": 0.35},
                    },
                )
                resp.raise_for_status()
                raw = resp.json().get("message", {}).get("content", "{}")
                parsed = json.loads(raw)
                latency = round((time.perf_counter() - t0) * 1000, 1)
                return {
                    "source": "live_ai",
                    "hint": parsed.get("hint", "Controlla lo stato dell'interfaccia e il routing."),
                    "osi_layer": parsed.get("osi_layer", "Layer 2/3"),
                    "suggested_check": parsed.get("suggested_check", "show ip interface brief"),
                    "latency_ms": latency,
                }
        except Exception:
            latency = round((time.perf_counter() - t0) * 1000, 1)
            return {
                "source": "fallback_sim",
                "hint": "Verifica che l'interfaccia non sia in administrative shutdown e che la VLAN sia corretta.",
                "osi_layer": "Layer 1/2/3",
                "suggested_check": "show ip interface brief",
                "latency_ms": latency,
            }


ai_service = AIService()
