#!/usr/bin/env python3
"""Security-focused local Plutus server.

Serves the application while keeping User_data private. Vault contents are only
available after PIN verification and every save is atomic and backed up.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import shutil
import sys
import tempfile
import threading
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
STATE_LOCK = threading.RLock()
TOKENS: dict[str, tuple[str, float]] = {}
ATTEMPTS: dict[str, deque[float]] = defaultdict(deque)


class StorageCorruptionError(RuntimeError):
    """Raised when an existing critical JSON file is corrupted."""


def hash_verifier(pin_hash: str, verifier_salt: str) -> str:
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        pin_hash.encode("utf-8"),
        verifier_salt.encode("utf-8"),
        100_000,
    )
    return base64.b64encode(digest).decode("ascii")


def upgrade_legacy_pin_hash(legacy_pin_hash: str) -> str:
    digest = hashlib.sha256(f"plutus-auth-v2:{legacy_pin_hash}".encode("utf-8")).digest()
    return base64.b64encode(digest).decode("ascii")


def seal_user_verifier(user: dict, pin_hash: str) -> None:
    verifier_salt = secrets.token_urlsafe(16)
    user["verifierSalt"] = verifier_salt
    user["pinVerifier"] = hash_verifier(pin_hash, verifier_salt)
    user.pop("pinHash", None)


def verify_user_pin(user: dict, supplied_pin_hash: str) -> tuple[bool, bool]:
    """Verify supplied pinHash against stored verifier or legacy pinHash.

    Returns (is_valid, needs_migration).
    """
    if not supplied_pin_hash:
        return False, False
    verifier = user.get("pinVerifier")
    verifier_salt = user.get("verifierSalt")
    if isinstance(verifier, str) and verifier and isinstance(verifier_salt, str) and verifier_salt:
        expected = hash_verifier(supplied_pin_hash, verifier_salt)
        if hmac.compare_digest(verifier, expected):
            return True, False

    legacy = str(user.get("pinHash", ""))
    if not legacy:
        return False, False
    if hmac.compare_digest(legacy, supplied_pin_hash):
        return True, True
    upgraded = upgrade_legacy_pin_hash(legacy)
    if hmac.compare_digest(upgraded, supplied_pin_hash):
        return True, True
    return False, False


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


def read_json(path: Path, default: object, strict: bool = False) -> object:
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except FileNotFoundError:
        return default
    except (OSError, json.JSONDecodeError) as error:
        if strict:
            raise StorageCorruptionError(f"Storage file {path.name} is corrupted or unreadable.") from error
        return default


def registry(strict: bool = False) -> dict:
    value = read_json(REGISTRY_FILE, {"users": []}, strict=strict)
    if isinstance(value, dict) and isinstance(value.get("users"), list):
        return value
    if strict and REGISTRY_FILE.exists():
        raise StorageCorruptionError("Profile registry structure is invalid.")
    return {"users": []}


def find_user(username: str, strict: bool = False) -> dict | None:
    wanted = username.casefold().strip()
    return next((u for u in registry(strict=strict)["users"] if str(u.get("username", "")).casefold() == wanted), None)


def public_profile(user: dict) -> dict:
    has_pin = bool(user.get("pinVerifier") or user.get("pinHash"))
    return {
        "username": user.get("username"),
        "folder": user.get("folder"),
        "salt": user.get("salt"),
        "iterations": user.get("iterations", 100000),
        "createdAt": user.get("createdAt"),
        "needsPinSetup": not has_pin,
    }


def _prune_attempts(key: str, now: float) -> deque[float]:
    attempts = ATTEMPTS[key]
    while attempts and attempts[0] < now - 300:
        attempts.popleft()
    if not attempts:
        ATTEMPTS.pop(key, None)
        return deque()
    return attempts


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
            with STATE_LOCK:
                self._json(HTTPStatus.OK, {"users": [public_profile(u) for u in registry()["users"]]})
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
        if path == "/api/logout":
            self._close_session()
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

    def do_DELETE(self) -> None:
        path = urlsplit(self.path).path
        if not self._same_origin():
            self._json(HTTPStatus.FORBIDDEN, {"error": "Cross-origin request denied"})
            return
        if path == "/api/session":
            self._close_session()
            return
        self._json(HTTPStatus.NOT_FOUND, {"error": "Not found"})

    def do_PUT(self) -> None:
        if urlsplit(self.path).path != "/api/vault" or not self._same_origin():
            self._json(HTTPStatus.NOT_FOUND, {"error": "Not found"})
            return
        with STATE_LOCK:
            folder = self._authorized_folder()
            if not folder:
                return
            body = self._body()
            if body is None or not self._valid_vault(body.get("vault")):
                self._json(HTTPStatus.BAD_REQUEST, {"error": "Invalid encrypted vault"})
                return
            atomic_json(USER_DATA / folder / "data.json", body["vault"], make_backup=True)
            self._json(HTTPStatus.OK, {"saved": True})

    def _close_session(self) -> None:
        header = self.headers.get("Authorization", "")
        token = header[7:] if header.startswith("Bearer ") else ""
        with STATE_LOCK:
            if token:
                TOKENS.pop(token, None)
        self._json(HTTPStatus.OK, {"revoked": True})

    def _open_session(self, body: dict) -> None:
        username = str(body.get("username", "")).strip()
        supplied = str(body.get("pinHash", ""))
        ip_key = f"ip:{self.client_address[0]}"
        user_key = f"user:{username.casefold()}" if username else ip_key
        now = time.time()
        with STATE_LOCK:
            ip_attempts = _prune_attempts(ip_key, now)
            user_attempts = _prune_attempts(user_key, now)
            if len(ip_attempts) >= 5 or len(user_attempts) >= 5:
                self._json(HTTPStatus.TOO_MANY_REQUESTS, {"error": "Too many attempts. Try again in five minutes."})
                return
            try:
                data = registry(strict=True)
            except StorageCorruptionError:
                self._json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "Profile registry is corrupted or unreadable."})
                return
            wanted = username.casefold()
            user = next((u for u in data["users"] if str(u.get("username", "")).casefold() == wanted), None)
            valid, needs_migration = verify_user_pin(user, supplied) if user else (False, False)
            if not valid:
                ATTEMPTS[ip_key].append(now)
                if user_key != ip_key:
                    ATTEMPTS[user_key].append(now)
            else:
                ATTEMPTS.pop(ip_key, None)
                ATTEMPTS.pop(user_key, None)
                if needs_migration and user is not None:
                    seal_user_verifier(user, supplied)
                    atomic_json(REGISTRY_FILE, data)

        if not valid:
            time.sleep(0.25)
            self._json(HTTPStatus.UNAUTHORIZED, {"error": "Incorrect username or PIN"})
            return

        with STATE_LOCK:
            token = secrets.token_urlsafe(32)
            folder = str(user["folder"])
            TOKENS[token] = (folder, now + SESSION_TTL)
            vault_path = USER_DATA / folder / "data.json"
            try:
                vault = read_json(vault_path, None, strict=True)
            except StorageCorruptionError:
                vault = None
            updated_at = vault_path.stat().st_mtime * 1000 if vault is not None and vault_path.exists() else 0
            self._json(HTTPStatus.OK, {"token": token, "profile": public_profile(user), "vault": vault, "vaultUpdatedAt": updated_at})

    def _create_profile(self, body: dict) -> None:
        profile, vault = body.get("profile"), body.get("vault")
        if not self._valid_profile(profile) or not self._valid_vault(vault):
            self._json(HTTPStatus.BAD_REQUEST, {"error": "Invalid profile or vault"})
            return
        with STATE_LOCK:
            try:
                data = registry(strict=True)
            except StorageCorruptionError:
                self._json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "Profile registry is corrupted or unreadable."})
                return
            wanted = str(profile["username"]).casefold().strip()
            if any(str(u.get("username", "")).casefold() == wanted or str(u.get("folder", "")).casefold() == profile["folder"].casefold() for u in data["users"]):
                self._json(HTTPStatus.CONFLICT, {"error": "That profile already exists"})
                return
            stored_profile = dict(profile)
            seal_user_verifier(stored_profile, str(profile["pinHash"]))
            folder = stored_profile["folder"]
            atomic_json(USER_DATA / folder / "profile.json", public_profile(stored_profile))
            atomic_json(USER_DATA / folder / "data.json", vault)
            data["users"].append(stored_profile)
            atomic_json(REGISTRY_FILE, data)
            token = secrets.token_urlsafe(32)
            TOKENS[token] = (folder, time.time() + SESSION_TTL)
            self._json(HTTPStatus.CREATED, {"token": token, "profile": public_profile(stored_profile)})

    def _setup_profile(self, body: dict) -> None:
        username, pin_hash, salt, vault = (body.get(k) for k in ("username", "pinHash", "salt", "vault"))
        with STATE_LOCK:
            try:
                data = registry(strict=True)
            except StorageCorruptionError:
                self._json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "Profile registry is corrupted or unreadable."})
                return
            wanted = str(username or "").casefold().strip()
            stored = next((u for u in data["users"] if str(u.get("username", "")).casefold() == wanted), None)
            if not stored or stored.get("pinHash") or stored.get("pinVerifier") or not isinstance(pin_hash, str) or not pin_hash or not isinstance(salt, str) or not self._valid_vault(vault):
                self._json(HTTPStatus.BAD_REQUEST, {"error": "Profile cannot be set up"})
                return
            stored["salt"], stored["iterations"] = salt, 310000
            seal_user_verifier(stored, pin_hash)
            folder = stored["folder"]
            previous = read_json(USER_DATA / folder / "data.json", None)
            legacy = previous if isinstance(previous, dict) and isinstance(previous.get("wallets"), list) else None
            atomic_json(USER_DATA / folder / "profile.json", public_profile(stored))
            # Do not preserve an old unencrypted migration file in the backup set.
            atomic_json(USER_DATA / folder / "data.json", vault)
            atomic_json(REGISTRY_FILE, data)
            token = secrets.token_urlsafe(32)
            TOKENS[token] = (folder, time.time() + SESSION_TTL)
            self._json(HTTPStatus.OK, {"token": token, "profile": public_profile(stored), "legacy": legacy})

    def _authorized_folder(self) -> str | None:
        header = self.headers.get("Authorization", "")
        token = header[7:] if header.startswith("Bearer ") else ""
        with STATE_LOCK:
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
    from launcher import PlutusDesktop

    PlutusDesktop().run()


if __name__ == "__main__":
    main()
