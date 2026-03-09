import sys
from pathlib import Path

# Ensure backend package is importable in the Vercel runtime.
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.app.main import app as backend_app


def _normalize_path(path: str) -> str:
    if path == "/api" or path == "/api/":
        return "/"
    if path.startswith("/api/index.py/"):
        return "/" + path[len("/api/index.py/") :]
    if path == "/api/index.py":
        return "/"
    if path.startswith("/api/"):
        return "/" + path[len("/api/") :]
    return path


async def vercel_app(scope, receive, send):
    if scope.get("type") in {"http", "websocket"}:
        scope = dict(scope)
        scope["path"] = _normalize_path(scope.get("path", "/"))
    await backend_app(scope, receive, send)


app = vercel_app
