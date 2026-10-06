#!/usr/bin/env python3
"""Security-focused local Plutus server.

Serves the application while keeping User_data private. Vault contents are only
available after PIN verification and every save is atomic and backed up.
"""

from __future__ import annotations

import hmac
import json
import os
import re
import secrets
import shutil
import sys
import tempfile
import time
from collections import defaultdict, deque
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

RESOURCE_ROOT = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
APP_ROOT = Path(sys.executable).resolve().parent if getattr(sys, "frozen", False) else RESOURCE_ROOT.parent
USER_DATA = APP_ROOT / "User_data"
REGISTRY_FILE = USER_DATA / "users.json"
PORT = 8765
MAX_BODY = 2 * 1024 * 1024
SESSION_TTL = 30 * 60
MAX_BACKUPS = 50
SAFE_FOLDER = re.compile(r"^[A-Za-z0-9._-]{1,64}$")
TOKENS: dict[str, tuple[str, float]] = {}
ATTEMPTS: dict[str, deque[float]] = defaultdict(deque)


def atomic_json(path: Path, value: object, make_backup: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if make_backup and path.exists():
        backup_dir = path.parent / "backups"
        backup_dir.mkdir(exist_ok=True)
        stamp = time.strftime("%Y%m%d-%H%M%S") + f"-{time.time_ns() % 1_000_000:06d}"
        shutil.copy2(path, backup_dir / f"data-{stamp}.json")
        backups = sorted(backup_dir.glob("data-*.json"), reverse=True)
        for old in backups[MAX_BACKUPS:]:
            old.unlink(missing_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(value, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_name, path)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def read_json(path: Path, default: object) -> object:
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, json.JSONDecodeError):
        return default


def registry() -> dict:
    value = read_json(REGISTRY_FILE, {"users": []})
    return value if isinstance(value, dict) and isinstance(value.get("users"), list) else {"users": []}


def find_user(username: str) -> dict | None:
    wanted = username.casefold().strip()
    return next((u for u in registry()["users"] if str(u.get("username", "")).casefold() == wanted), None)


def public_profile(user: dict) -> dict:
    return {
        "username": user.get("username"),
        "folder": user.get("folder"),
        "salt": user.get("salt"),
        "iterations": user.get("iterations", 100000),
        "createdAt": user.get("createdAt"),
        "needsPinSetup": not bool(user.get("pinHash")),
    }


class PlutusHandler(SimpleHTTPRequestHandler):
    server_version = "Plutus/2"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(RESOURCE_ROOT), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; "
            "frame-ancestors 'none'; form-action 'self'",
        )
        super().end_headers()

    def translate_path(self, path: str) -> str:
        requested = unquote(urlsplit(path).path).replace("\\", "/")
        parts = [part for part in requested.split("/") if part]
        if any(part.startswith(".") for part in parts) or (parts and parts[0].casefold() == "user_data"):
            return str(RESOURCE_ROOT / "__private_path_blocked__")
        return super().translate_path(path)

    def do_GET(self) -> None:
        path = urlsplit(self.path).path
        if path == "/api/profiles":
            self._json(HTTPStatus.OK, {"users": [public_profile(u) for u in registry()["users"]]})
            return
        if path in {"/api/recovery/status", "/api/recovery/legacy"}:
            folder = self._authorized_folder()
            if not folder:
                return
            legacy_registry = read_json(APP_ROOT / "Recovery" / "legacy-registry.json", {"users": []})
            legacy_vault = read_json(APP_ROOT / "Recovery" / "legacy-vault.json", None)
            legacy_user = next(
                (u for u in legacy_registry.get("users", []) if str(u.get("folder", "")).casefold() == folder.casefold()),
                None,
            )
            if path == "/api/recovery/status":
                self._json(HTTPStatus.OK, {
                    "available": bool(legacy_user and self._valid_vault(legacy_vault))
                })
                return
            if not legacy_user or not self._valid_vault(legacy_vault):
                self._json(HTTPStatus.NOT_FOUND, {"error": "No matching legacy vault was found"})
                return
            self._json(HTTPStatus.OK, {
                "profile": {
                    "username": legacy_user.get("username"),
                    "salt": legacy_user.get("salt"),
                    "iterations": legacy_user.get("iterations", 100000),
                },
                "vault": legacy_vault,
            })
            return
        if path.startswith("/api/") or path.casefold().startswith("/user_data"):
            self._json(HTTPStatus.NOT_FOUND, {"error": "Not found"})
            return
        super().do_GET()

    def do_POST(self) -> None:
        path = urlsplit(self.path).path
        if not self._same_origin():
            self._json(HTTPStatus.FORBIDDEN, {"error": "Cross-origin request denied"})
            return
        body = self._body()
        if body is None:
            return
        if path == "/api/session":
            self._open_session(body)
        elif path == "/api/profiles":
            self._create_profile(body)
        elif path == "/api/setup":
            self._setup_profile(body)
        else:
            self._json(HTTPStatus.NOT_FOUND, {"error": "Not found"})

    def do_PUT(self) -> None:
        if urlsplit(self.path).path != "/api/vault" or not self._same_origin():
            self._json(HTTPStatus.NOT_FOUND, {"error": "Not found"})
            return
        folder = self._authorized_folder()
        if not folder:
            return
        body = self._body()
        if body is None or not self._valid_vault(body.get("vault")):
            self._json(HTTPStatus.BAD_REQUEST, {"error": "Invalid encrypted vault"})
            return
        atomic_json(USER_DATA / folder / "data.json", body["vault"], make_backup=True)
        self._json(HTTPStatus.OK, {"saved": True})

    def _open_session(self, body: dict) -> None:
        username = str(body.get("username", "")).strip()
        supplied = str(body.get("pinHash", ""))
        # Rate-limit by client address so rotating usernames cannot bypass it.
        key = self.client_address[0]
        now = time.time()
        attempts = ATTEMPTS[key]
        while attempts and attempts[0] < now - 300:
            attempts.popleft()
        if len(attempts) >= 5:
            self._json(HTTPStatus.TOO_MANY_REQUESTS, {"error": "Too many attempts. Try again in five minutes."})
            return
        user = find_user(username)
        expected = str(user.get("pinHash", "")) if user else ""
        if not expected or not supplied or not hmac.compare_digest(expected, supplied):
            attempts.append(now)
            time.sleep(0.25)
            self._json(HTTPStatus.UNAUTHORIZED, {"error": "Incorrect username or PIN"})
            return
        ATTEMPTS.pop(key, None)
        token = secrets.token_urlsafe(32)
        folder = str(user["folder"])
        TOKENS[token] = (folder, now + SESSION_TTL)
        vault = read_json(USER_DATA / folder / "data.json", None)
        vault_path = USER_DATA / folder / "data.json"
        updated_at = vault_path.stat().st_mtime * 1000 if vault_path.exists() else 0
        self._json(HTTPStatus.OK, {"token": token, "profile": public_profile(user), "vault": vault, "vaultUpdatedAt": updated_at})

    def _create_profile(self, body: dict) -> None:
        profile, vault = body.get("profile"), body.get("vault")
        if not self._valid_profile(profile) or not self._valid_vault(vault):
            self._json(HTTPStatus.BAD_REQUEST, {"error": "Invalid profile or vault"})
            return
        if find_user(profile["username"]) or any(str(u.get("folder", "")).casefold() == profile["folder"].casefold() for u in registry()["users"]):
            self._json(HTTPStatus.CONFLICT, {"error": "That profile already exists"})
            return
        data = registry()
        data["users"].append(profile)
        atomic_json(REGISTRY_FILE, data)
        folder = profile["folder"]
        atomic_json(USER_DATA / folder / "profile.json", public_profile(profile))
        atomic_json(USER_DATA / folder / "data.json", vault)
        token = secrets.token_urlsafe(32)
        TOKENS[token] = (folder, time.time() + SESSION_TTL)
        self._json(HTTPStatus.CREATED, {"token": token, "profile": public_profile(profile)})

    def _setup_profile(self, body: dict) -> None:
        username, pin_hash, salt, vault = (body.get(k) for k in ("username", "pinHash", "salt", "vault"))
        user = find_user(str(username or ""))
        if not user or user.get("pinHash") or not isinstance(pin_hash, str) or not isinstance(salt, str) or not self._valid_vault(vault):
            self._json(HTTPStatus.BAD_REQUEST, {"error": "Profile cannot be set up"})
            return
        data = registry()
        stored = next(u for u in data["users"] if str(u.get("username", "")).casefold() == str(username).casefold())
        stored["pinHash"], stored["salt"], stored["iterations"] = pin_hash, salt, 310000
        atomic_json(REGISTRY_FILE, data)
        folder = stored["folder"]
        previous = read_json(USER_DATA / folder / "data.json", None)
        legacy = previous if isinstance(previous, dict) and isinstance(previous.get("wallets"), list) else None
        atomic_json(USER_DATA / folder / "profile.json", public_profile(stored))
        # Do not preserve an old unencrypted migration file in the backup set.
        atomic_json(USER_DATA / folder / "data.json", vault)
        token = secrets.token_urlsafe(32)
        TOKENS[token] = (folder, time.time() + SESSION_TTL)
        self._json(HTTPStatus.OK, {"token": token, "profile": public_profile(stored), "legacy": legacy})

    def _authorized_folder(self) -> str | None:
        header = self.headers.get("Authorization", "")
        token = header[7:] if header.startswith("Bearer ") else ""
        session = TOKENS.get(token)
        if not session or session[1] < time.time():
            TOKENS.pop(token, None)
            self._json(HTTPStatus.UNAUTHORIZED, {"error": "Session expired. Sign in again."})
            return None
        TOKENS[token] = (session[0], time.time() + SESSION_TTL)
        return session[0]

    def _same_origin(self) -> bool:
        origin = self.headers.get("Origin")
        return not origin or origin in {f"http://127.0.0.1:{PORT}", f"http://localhost:{PORT}"}

    def _body(self) -> dict | None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY:
                raise ValueError
            value = json.loads(self.rfile.read(length).decode("utf-8"))
            if not isinstance(value, dict):
                raise ValueError
            return value
        except (ValueError, UnicodeDecodeError, json.JSONDecodeError):
            self._json(HTTPStatus.BAD_REQUEST, {"error": "Invalid request body"})
            return None

    @staticmethod
    def _valid_vault(vault: object) -> bool:
        return isinstance(vault, dict) and vault.get("v") == 1 and vault.get("alg") == "AES-GCM" and all(
            isinstance(vault.get(k), str) and vault[k] for k in ("iv", "cipher")
        )

    @staticmethod
    def _valid_profile(profile: object) -> bool:
        return isinstance(profile, dict) and bool(re.fullmatch(r"[A-Za-z][A-Za-z0-9._ -]{1,31}", str(profile.get("username", "")))) and bool(SAFE_FOLDER.fullmatch(str(profile.get("folder", "")))) and all(
            isinstance(profile.get(k), str) and profile[k] for k in ("username", "salt", "pinHash", "createdAt")
        ) and profile.get("iterations") == 310000

    def _json(self, status: HTTPStatus, body: dict) -> None:
        encoded = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, fmt: str, *args) -> None:
        if sys.stdout:
            print("[%s] %s" % (self.log_date_time_string(), fmt % args))


def create_server() -> ThreadingHTTPServer:
    USER_DATA.mkdir(exist_ok=True)
    return ThreadingHTTPServer(("127.0.0.1", PORT), PlutusHandler)


def main() -> None:
    server = create_server()
    print(f"Plutus running securely at http://127.0.0.1:{PORT}")
    print("User_data is blocked from direct web access. Press Ctrl+C to stop.")
    server.serve_forever()


if __name__ == "__main__":
    main()
