#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "=== Cisco Cyber Office - M4 Demo Launcher ==="

if [ ! -d "backend/.venv" ]; then
  echo "[1/4] Creating Python virtualenv in backend/.venv..."
  python3 -m venv backend/.venv
fi

source backend/.venv/bin/activate
echo "[2/4] Installing backend dependencies..."
pip install -q -r backend/requirements.txt

echo "[3/4] Checking local infrastructure..."
if ping -c 1 -W 1 192.168.122.110 >/dev/null 2>&1; then
  echo "  - CML 192.168.122.110: REACHABLE"
else
  echo "  - CML 192.168.122.110: UNREACHABLE (will use SIM_FALLBACK)"
fi

if curl -s --max-time 1 http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  echo "  - Ollama 127.0.0.1:11434: REACHABLE"
else
  echo "  - Ollama 127.0.0.1:11434: UNREACHABLE (will use SIM_FALLBACK)"
fi

echo "[4/4] Installing frontend deps, starting FastAPI backend (port 8000) and Vite frontend..."
npm install --no-audit --no-fund --loglevel=error
uvicorn backend.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
trap 'kill $BACKEND_PID 2>/dev/null || true' EXIT

npm run dev -- --host
