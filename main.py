"""
CareTag API Server Entrypoint
Allows running directly from workspace root:
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload
or:
    python3 main.py
"""
import sys
from pathlib import Path

# Add project root and backend directory to python path
ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"

for p in (ROOT_DIR, BACKEND_DIR):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

from backend.main import app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
