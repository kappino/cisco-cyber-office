"""Console session manager for stateful HTTP console access (Milestone 1 - A10).

Provides persistent ConsoleBridge wrapping with:
- Unique session IDs
- Raw keystroke/command forwarding WITHOUT intrusive resets (\\x03\\x15\\r or enable)
- Long-polling read with timeout and ANSI escape code stripping
- Inactivity TTL (10 minutes)
- Integration with OPEN_CONSOLES and OPEN_BRIDGES concurrency mechanisms
"""
from __future__ import annotations

import asyncio
import time
import uuid
from typing import Dict, List, Optional

from backend.room_labs import ANSI_ESC, ConsoleBridge


class ConsoleSession:
    """Sessione HTTP stateful per una console CML."""

    def __init__(self, session_id: str, room_id: str, node: str, bridge: ConsoleBridge) -> None:
        self.session_id = session_id
        self.room_id = room_id
        self.node = node
        self.bridge = bridge
        self.created_at = time.time()
        self.last_activity = time.time()
        self._closed = False

    def touch(self) -> None:
        self.last_activity = time.time()

    def is_expired(self, ttl: float = 600.0) -> bool:
        return (time.time() - self.last_activity) > ttl

    def send(self, data: str) -> int:
        """Invia dati/tasti alla console seriale senza sequenze di reset spurie."""
        if self._closed:
            raise RuntimeError(f"Session {self.session_id} is closed")
        self.touch()
        self.bridge.send(data)
        return len(data.encode("utf-8"))

    async def read(self, wait: float = 2.0) -> str:
        """Lettura a long-polling con timeout, rimozione codici ANSI e mantenimento stato."""
        if self._closed:
            raise RuntimeError(f"Session {self.session_id} is closed")
        self.touch()
        wait = max(0.0, min(10.0, float(wait)))
        chunks: List[bytes] = []

        # Se la coda e' vuota e wait > 0, attendi il primo pezzo di output
        if self.bridge.queue.empty() and wait > 0:
            try:
                item = await asyncio.wait_for(self.bridge.queue.get(), timeout=wait)
                if item is not None:
                    chunks.append(item)
            except asyncio.TimeoutError:
                pass

        # Raccogli tutti i chunk gia' disponibili nella coda
        while not self.bridge.queue.empty():
            try:
                item = self.bridge.queue.get_nowait()
                if item is not None:
                    chunks.append(item)
            except asyncio.QueueEmpty:
                break

        # Se abbiamo ricevuto dati, attendi un brevissimo istante (20ms) per raccogliere eventuali byte immediati
        if chunks:
            await asyncio.sleep(0.02)
            while not self.bridge.queue.empty():
                try:
                    item = self.bridge.queue.get_nowait()
                    if item is not None:
                        chunks.append(item)
                except asyncio.QueueEmpty:
                    break

        if not chunks:
            return ""

        raw_text = b"".join(chunks).decode(errors="ignore")
        return ANSI_ESC.sub("", raw_text)

    def close(self) -> None:
        if not self._closed:
            self._closed = True
            try:
                self.bridge.close()
            except Exception:
                pass


class ConsoleSessionManager:
    """Gestore del ciclo di vita delle sessioni console HTTP."""

    def __init__(self) -> None:
        self._sessions: Dict[str, ConsoleSession] = {}

    def create_session(self, room_id: str, node: str, bridge: ConsoleBridge) -> ConsoleSession:
        self.cleanup_expired()
        session_id = str(uuid.uuid4())
        session = ConsoleSession(session_id, room_id, node, bridge)
        self._sessions[session_id] = session
        return session

    def get_session(self, session_id: str) -> Optional[ConsoleSession]:
        session = self._sessions.get(session_id)
        if not session:
            return None
        if session.is_expired():
            self.close_session(session_id)
            return None
        return session

    def close_session(self, session_id: str) -> bool:
        session = self._sessions.pop(session_id, None)
        if session:
            session.close()
            return True
        return False

    def cleanup_expired(self, ttl: float = 600.0) -> int:
        now = time.time()
        expired_ids = [sid for sid, s in self._sessions.items() if (now - s.last_activity) > ttl]
        for sid in expired_ids:
            self.close_session(sid)
        return len(expired_ids)


console_session_manager = ConsoleSessionManager()
