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
        self.assertEqual(request(self.base, "/api/vault", "PUT", {"vault": self.vault("one")}, token)[0], 200)
        self.assertEqual(request(self.base, "/api/vault", "PUT", {"vault": self.vault("two")}, token)[0], 200)

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


if __name__ == "__main__":
    unittest.main()
