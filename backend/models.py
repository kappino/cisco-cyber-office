"""Pydantic request schemas for the FastAPI -> CML / Ollama / netAgent orchestrator."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class PatchRequest(BaseModel):
    """Physical Layer 1/2 cable patch event from PatchRackGame."""

    port_id: str = Field(..., description="Switch port identifier (e.g. 'sw-1', 'sw-g1')")
    cable_id: Optional[str] = Field(None, description="Patch panel source port ID")
    connected: bool = Field(True, description="True to bring interface/node UP, False for DOWN")


class TerminalCommandRequest(BaseModel):
    """Cisco IOS CLI command forwarded from CrtTerminalGame."""

    node: str = Field("SW-CORE-01", description="Target CML node label")
    command: str = Field(..., description="IOS command string entered by the player")


class SocSinkholeRequest(BaseModel):
    """DNS sinkhole action forwarded from UmbrellaSocGame."""

    domain: str = Field(..., description="Malicious domain to block or unblock")
    action: str = Field("block", description="'block' or 'unblock'")


class AiInteractRequest(BaseModel):
    """Request payload for live NPC dialogue or Socratic mentor hints via Ollama."""

    mode: str = Field("npc", description="'npc' for character chat, 'hint' for structured minigame hint")
    npc_id: str = Field("secbot", description="NPC identifier: marco | ciro | rosaria | secbot")
    prompt: str = Field("", description="Player question or context trigger")
    minigame: str = Field("terminal", description="Active minigame identifier when mode='hint'")
    context: str = Field("", description="Additional minigame state context")


class MissionVerifyRequest(BaseModel):
    """Request payload to verify player configuration against ideal netAgent spec."""

    mission_id: str = Field(..., description="Mission ID: 'rack' | 'terminal' | 'umbrella' | 'wireshark' | custom")
    player_commands: List[str] = Field(default_factory=list, description="CLI commands or config lines produced by player")
    player_state: Dict[str, Any] = Field(default_factory=dict, description="Structured minigame state (ports, domains, etc.)")


class MissionGenerateRequest(BaseModel):
    """Prompt-driven topology and mission generation request (netAgent + Ollama -> CML)."""

    prompt: str = Field(..., description="Natural language description of the network mission & fault")
    deploy_to_cml: bool = Field(True, description="If True, instantiate the generated topology on CML")


class RoomSyncRequest(BaseModel):
    """Sync CML active lab with the player's current game room."""

    room_id: str = Field(..., description="Current room ID: office | corridor | datacenter_vault")
