#!/usr/bin/env bash
# CareTag AI Server Runner
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ -f "$SCRIPT_DIR/.venv/bin/uvicorn" ]; then
    echo "Starting CareTag AI Server using project .venv..."
    exec "$SCRIPT_DIR/.venv/bin/uvicorn" backend.main:app --host 0.0.0.0 --port 8000 --reload
else
    echo "Starting CareTag AI Server using system uvicorn..."
    exec uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
fi
