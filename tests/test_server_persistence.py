from __future__ import annotations

import json
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "app"))
import server as plutus_server


def request(base: str, path: str, method: str = "GET", body=None, token=None):
    headers = {}
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(base + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            return response.status, json.loads(response.read())
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read())


class PersistenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.original_user_data = plutus_server.USER_DATA
        self.original_registry = plutus_server.REGISTRY_FILE
        plutus_server.USER_DATA = Path(self.temp.name) / "User_data"
        plutus_server.REGISTRY_FILE = plutus_server.USER_DATA / "users.json"
        plutus_server.TOKENS.clear()
        plutus_server.ATTEMPTS.clear()
        self.httpd = plutus_server.ThreadingHTTPServer(("127.0.0.1", 0), plutus_server.PlutusHandler)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        self.base = f"http://127.0.0.1:{self.httpd.server_port}"

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        self.thread.join(timeout=5)
        plutus_server.USER_DATA = self.original_user_data
        plutus_server.REGISTRY_FILE = self.original_registry
        self.temp.cleanup()

    @staticmethod
    def vault(marker: str):
        return {"v": 1, "alg": "AES-GCM", "iv": f"iv-{marker}", "cipher": f"cipher-{marker}"}

    def test_create_save_backup_restart_and_private_path(self):
        profile = {
            "username": "TestUser",
            "folder": "TestUser",
            "salt": "test-salt",
            "pinHash": "test-verifier",
            "iterations": 310000,
            "createdAt": "2026-10-05T00:00:00.000Z",
        }
        status, created = request(
            self.base,
            "/api/profiles",
            "POST",
            {"profile": profile, "vault": self.vault("initial")},
        )
        self.assertEqual(status, 201)
        self.assertNotIn("pinHash", created["profile"])

        status, profiles = request(self.base, "/api/profiles")
        self.assertEqual(status, 200)
        self.assertNotIn("pinHash", profiles["users"][0])

        token = created["token"]
        registry_on_disk = json.loads(plutus_server.REGISTRY_FILE.read_text("utf-8"))
        stored_user = registry_on_disk["users"][0]
        self.assertNotIn("pinHash", stored_user)
        self.assertIn("pinVerifier", stored_user)
        self.assertIn("verifierSalt", stored_user)
        self.assertNotEqual(stored_user["pinVerifier"], "test-verifier")

        self.assertEqual(request(self.base, "/api/vault", "PUT", {"vault": self.vault("one")}, token)[0], 200)
        self.assertEqual(request(self.base, "/api/vault", "PUT", {"vault": self.vault("two")}, token)[0], 200)

        # Revoking session token via DELETE /api/session must invalidate it immediately
        self.assertEqual(request(self.base, "/api/session", "DELETE", token=token)[0], 200)
        self.assertEqual(request(self.base, "/api/vault", "PUT", {"vault": self.vault("three")}, token)[0], 401)

        current = json.loads((plutus_server.USER_DATA / "TestUser" / "data.json").read_text("utf-8"))
        self.assertEqual(current, self.vault("two"))
        backups = list((plutus_server.USER_DATA / "TestUser" / "backups").glob("data-*.json"))
        self.assertGreaterEqual(len(backups), 2)
        backup_values = [json.loads(path.read_text("utf-8")) for path in backups]
        self.assertIn(self.vault("initial"), backup_values)
        self.assertIn(self.vault("one"), backup_values)

        plutus_server.TOKENS.clear()
        status, session = request(
            self.base,
            "/api/session",
            "POST",
            {"username": "TestUser", "pinHash": "test-verifier"},
        )
        self.assertEqual(status, 200)
        self.assertEqual(session["vault"], self.vault("two"))
        self.assertGreater(session["vaultUpdatedAt"], 0)

        status, _ = request(self.base, "/User_data/TestUser/data.json")
        self.assertEqual(status, 404)
        temporary_files = list(plutus_server.USER_DATA.rglob(".*.json.*"))
        self.assertEqual(temporary_files, [])

    def test_legacy_pin_hash_migration_and_corrupted_registry_guard(self):
        plutus_server.USER_DATA.mkdir(parents=True, exist_ok=True)
        legacy_registry = {
            "users": [
                {
                    "username": "LegacyUser",
                    "folder": "LegacyUser",
                    "salt": "legacy-salt",
                    "pinHash": "legacy-raw-pbkdf2-b64",
                    "iterations": 100000,
                    "createdAt": "2026-01-01T00:00:00.000Z",
                }
            ]
        }
        plutus_server.REGISTRY_FILE.write_text(json.dumps(legacy_registry), encoding="utf-8")
        v2_supplied = plutus_server.upgrade_legacy_pin_hash("legacy-raw-pbkdf2-b64")
        status, session = request(
            self.base,
            "/api/session",
            "POST",
            {"username": "LegacyUser", "pinHash": v2_supplied},
        )
        self.assertEqual(status, 200)
        self.assertIn("token", session)
        migrated_user = json.loads(plutus_server.REGISTRY_FILE.read_text("utf-8"))["users"][0]
        self.assertNotIn("pinHash", migrated_user)
        self.assertIn("pinVerifier", migrated_user)

        # Corrupted registry must not be silently overwritten on profile creation
        plutus_server.REGISTRY_FILE.write_text("{corrupted-json", encoding="utf-8")
        status, _ = request(
            self.base,
            "/api/profiles",
            "POST",
            {
                "profile": {
                    "username": "NewUser",
                    "folder": "NewUser",
                    "salt": "s",
                    "pinHash": "h",
                    "iterations": 310000,
                    "createdAt": "2026-10-05T00:00:00.000Z",
                },
                "vault": self.vault("init"),
            },
        )
        self.assertEqual(status, 500)
        self.assertEqual(plutus_server.REGISTRY_FILE.read_text("utf-8"), "{corrupted-json")


if __name__ == "__main__":
    unittest.main()
