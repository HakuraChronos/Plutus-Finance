"""Read-only Chromium localStorage recovery scanner with privacy-safe output."""

from __future__ import annotations

import json
import sys
from pathlib import Path

TOOL_ROOT = Path(__file__).resolve().parents[1] / ".recovery" / "ccl_chromium_reader"
SNAPPY_ROOT = Path(__file__).resolve().parents[1] / ".recovery" / "ccl_simplesnappy"
sys.path.insert(0, str(SNAPPY_ROOT))
sys.path.insert(0, str(TOOL_ROOT))

from ccl_chromium_reader import ccl_chromium_localstorage  # noqa: E402


def main() -> None:
    if len(sys.argv) not in (2, 3):
        raise SystemExit("Usage: inspect_chromium_storage.py <leveldb-folder> [export-folder]")
    folder = Path(sys.argv[1]).resolve()
    export_folder = Path(sys.argv[2]).resolve() if len(sys.argv) == 3 else None
    if export_folder:
        export_folder.mkdir(parents=True, exist_ok=True)
    print(f"database={folder}")
    matches = 0
    with ccl_chromium_localstorage.LocalStoreDb(folder) as storage:
        for record in storage.iter_all_records(include_deletions=True):
            if "plutus" not in record.script_key.lower():
                continue
            matches += 1
            value = record.value
            if value is None:
                print(
                    f"origin={record.storage_key} | key={record.script_key} | "
                    f"live={record.is_live} | sequence={record.leveldb_seq_number} | deleted-value"
                )
                continue
            if export_folder and record.storage_key == "file://" and record.script_key in {
                "plutus_users_registry", "plutus_vault_chronos"
            }:
                output_name = (
                    "legacy-registry.json"
                    if record.script_key == "plutus_users_registry"
                    else "legacy-vault.json"
                )
                (export_folder / output_name).write_text(value, encoding="utf-8")
            summary = [
                f"origin={record.storage_key}",
                f"key={record.script_key}",
                f"live={record.is_live}",
                f"sequence={record.leveldb_seq_number}",
                f"bytes={len(value)}",
            ]
            try:
                parsed = json.loads(value)
                if isinstance(parsed, dict):
                    for name in ("wallets", "transactions", "budgets", "goals"):
                        items = parsed.get(name)
                        if isinstance(items, list):
                            summary.append(f"{name}={len(items)}")
            except (json.JSONDecodeError, TypeError):
                pass
            print(" | ".join(summary))
    if not matches:
        print("no Plutus records found")


if __name__ == "__main__":
    main()
